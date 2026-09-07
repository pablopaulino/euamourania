-- Viva Urânia — audiência do app com contas, dispositivos e desempenho comercial.
-- Migration incremental: não altera nem remove eventos existentes.

alter table public.analytics_eventos drop constraint if exists analytics_eventos_tipo_check;

do $$
declare
  v_allowed text;
begin
  select string_agg(quote_literal(tipo), ', ' order by tipo)
    into v_allowed
  from (
    select distinct tipo
    from public.analytics_eventos
    where tipo is not null
    union
    select unnest(array[
      'account_session_start'
    ])
  ) allowed(tipo);

  execute format(
    'alter table public.analytics_eventos add constraint analytics_eventos_tipo_check check (tipo is null or tipo in (%s))',
    v_allowed
  );
end $$;

create or replace function public.registrar_evento_app(
  p_tipo text,
  p_anonymous_id text default null,
  p_sessao_hash text default null,
  p_recurso_tipo text default null,
  p_recurso_id uuid default null,
  p_notification_id uuid default null,
  p_plataforma text default null,
  p_app_version text default null,
  p_metadados jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metadata jsonb;
  v_user_id uuid;
begin
  if p_tipo not in (
    'app_open', 'app_screen_view', 'account_session_start',
    'empresa_view', 'home_empresa_impression', 'empresa_whatsapp_click',
    'empresa_phone_click', 'empresa_map_click', 'turismo_view',
    'turismo_map_click', 'evento_view', 'noticia_view', 'favorite_add',
    'favorite_remove', 'search', 'notification_open', 'share_click',
    'telefone_util_view', 'telefone_util_call_click',
    'telefone_util_whatsapp_click', 'ai_guide_question',
    'ai_guide_itinerary_create', 'itinerary_save', 'itinerary_share'
  ) then
    return;
  end if;

  if p_plataforma not in ('ios', 'android') then
    return;
  end if;

  v_user_id := auth.uid();
  v_metadata := coalesce(p_metadados, '{}'::jsonb)
    - 'email' - 'telefone' - 'phone' - 'token' - 'access_token'
    - 'refresh_token' - 'jwt' - 'headers' - 'senha' - 'password';

  if length(coalesce(v_metadata::text, '{}')) > 4000 then
    v_metadata := jsonb_build_object('truncated', true);
  end if;

  insert into public.analytics_eventos (
    tipo, pagina, recurso_tipo, recurso_id, destino, sessao_hash, origem,
    dispositivo, metadados, anonymous_id, usuario_id, app_version, notification_id
  ) values (
    p_tipo, '/app', left(p_recurso_tipo, 40), p_recurso_id, null,
    left(p_sessao_hash, 80), 'app', p_plataforma, v_metadata,
    left(p_anonymous_id, 80), v_user_id, left(p_app_version, 30), p_notification_id
  );

  if p_tipo = 'notification_open' and p_notification_id is not null then
    update public.app_notificacoes
       set cliques = coalesce(cliques, 0) + 1,
           ultimo_clique_em = now()
     where id = p_notification_id;
  end if;
end;
$$;

revoke all on function public.registrar_evento_app(text,text,text,text,uuid,uuid,text,text,jsonb) from public;
grant execute on function public.registrar_evento_app(text,text,text,text,uuid,uuid,text,text,jsonb) to anon, authenticated;

create or replace function public.obter_audiencia_app(p_inicio date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_resultado jsonb;
begin
  if not public.tem_permissao_admin('insights', 'ler') then
    raise exception 'Sem permissão para consultar audiência.' using errcode = '42501';
  end if;

  if p_inicio is null or p_fim is null or p_inicio > p_fim or p_fim - p_inicio > 366 then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;

  with eventos_app as (
    select *
      from public.analytics_eventos
     where dia between p_inicio and p_fim
       and (origem = 'app' or dispositivo in ('ios', 'android') or anonymous_id is not null)
  ),
  resumo as (
    select
      count(distinct anonymous_id) filter (where anonymous_id is not null) as dispositivos_ativos,
      count(distinct usuario_id) filter (where usuario_id is not null) as contas_ativas,
      count(distinct sessao_hash) filter (where sessao_hash is not null) as sessoes,
      count(*) filter (where tipo = 'app_open') as aberturas,
      count(*) filter (where tipo in ('empresa_view', 'turismo_view', 'evento_view', 'noticia_view')) as conteudos_vistos,
      count(*) filter (where tipo in ('empresa_whatsapp_click', 'empresa_phone_click', 'empresa_map_click', 'turismo_map_click', 'telefone_util_call_click', 'telefone_util_whatsapp_click')) as acoes_uteis,
      count(*) filter (where tipo = 'favorite_add') as favoritos,
      count(*) filter (where tipo = 'favorite_remove') as favoritos_removidos,
      count(*) filter (where tipo = 'search') as buscas,
      count(*) filter (where tipo = 'notification_open') as aberturas_push,
      count(*) filter (where tipo = 'share_click') as compartilhamentos,
      count(*) filter (where tipo = 'ai_guide_question') as perguntas_guia,
      count(*) filter (where tipo = 'ai_guide_itinerary_create') as roteiros_criados,
      count(*) filter (where tipo = 'itinerary_save') as roteiros_salvos
    from eventos_app
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'accountsTotal', (select count(*) from auth.users),
      'accountsCreated', (select count(*) from auth.users where (created_at at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim),
      'activeSignedAccounts', coalesce((select contas_ativas from resumo), 0),
      'activeDevices', coalesce((select dispositivos_ativos from resumo), 0),
      'sessions', coalesce((select sessoes from resumo), 0),
      'opens', coalesce((select aberturas from resumo), 0),
      'views', coalesce((select conteudos_vistos from resumo), 0),
      'commercialActions', coalesce((select acoes_uteis from resumo), 0),
      'favorites', coalesce((select favoritos from resumo), 0),
      'favoriteRemovals', coalesce((select favoritos_removidos from resumo), 0),
      'searches', coalesce((select buscas from resumo), 0),
      'notificationOpens', coalesce((select aberturas_push from resumo), 0),
      'shares', coalesce((select compartilhamentos from resumo), 0),
      'aiQuestions', coalesce((select perguntas_guia from resumo), 0),
      'aiItineraries', coalesce((select roteiros_criados from resumo), 0),
      'itinerarySaves', coalesce((select roteiros_salvos from resumo), 0)
    ),
    'companies', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.acoes desc, item.visualizacoes desc, item.nome)
      from (
        select
          e.recurso_id as id,
          coalesce(g.nome, 'Empresa não encontrada') as nome,
          count(*) filter (where e.tipo = 'home_empresa_impression')::integer as impressoes,
          count(*) filter (where e.tipo = 'empresa_view')::integer as visualizacoes,
          count(*) filter (where e.tipo = 'empresa_whatsapp_click')::integer as whatsapp,
          count(*) filter (where e.tipo = 'empresa_phone_click')::integer as ligacoes,
          count(*) filter (where e.tipo = 'empresa_map_click')::integer as rotas,
          count(*) filter (where e.tipo = 'share_click')::integer as compartilhamentos,
          count(*) filter (where e.tipo = 'favorite_add')::integer as favoritos,
          (count(*) filter (where e.tipo in ('empresa_whatsapp_click', 'empresa_phone_click', 'empresa_map_click')))::integer as acoes
        from eventos_app e
        left join public.guia_comercial g on g.id = e.recurso_id
        where e.recurso_tipo = 'empresa' and e.recurso_id is not null
        group by e.recurso_id, g.nome
        order by acoes desc, visualizacoes desc, impressoes desc, nome
        limit 500
      ) item
    ), '[]'::jsonb),
    'viewsByType', jsonb_build_array(
      jsonb_build_object('label', 'Empresas', 'total', (select count(*) from eventos_app where tipo = 'empresa_view')),
      jsonb_build_object('label', 'Turismo', 'total', (select count(*) from eventos_app where tipo = 'turismo_view')),
      jsonb_build_object('label', 'Eventos', 'total', (select count(*) from eventos_app where tipo = 'evento_view')),
      jsonb_build_object('label', 'Notícias', 'total', (select count(*) from eventos_app where tipo = 'noticia_view'))
    ),
    'screens', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'total', total) order by total desc, label)
      from (
        select coalesce(nullif(metadados ->> 'screen', ''), 'Tela não identificada') as label, count(*)::integer as total
          from eventos_app where tipo = 'app_screen_view'
         group by 1 order by 2 desc, 1 limit 20
      ) item
    ), '[]'::jsonb),
    'searches', coalesce((
      select jsonb_agg(jsonb_build_object('label', label, 'total', total, 'withoutResults', sem_resultado) order by total desc, label)
      from (
        select left(trim(metadados ->> 'query'), 100) as label,
               count(*)::integer as total,
               count(*) filter (where case
                 when coalesce(metadados ->> 'results_count', '') ~ '^\\d+$'
                   then (metadados ->> 'results_count')::integer
                 else 0
               end = 0)::integer as sem_resultado
          from eventos_app
         where tipo = 'search' and nullif(trim(metadados ->> 'query'), '') is not null
         group by 1 order by 2 desc, 1 limit 30
      ) item
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.obter_audiencia_app(date, date) from public;
grant execute on function public.obter_audiencia_app(date, date) to authenticated;

comment on function public.obter_audiencia_app(date, date)
  is 'Retorna métricas agregadas do app, contas e desempenho comercial apenas para administradores com permissão de insights.';
