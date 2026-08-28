-- Viva Urania - audiencia avancada do aplicativo
-- Migration incremental: libera novos eventos first-party do app sem criar tabelas novas.

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
      'page_view',
      'noticia_view',
      'guia_view',
      'evento_view',
      'turismo_view',
      'whatsapp_click',
      'instagram_click',
      'external_click',
      'busca',
      'app_open',
      'app_screen_view',
      'empresa_view',
      'empresa_whatsapp_click',
      'empresa_phone_click',
      'empresa_map_click',
      'turismo_map_click',
      'evento_view',
      'noticia_view',
      'favorite_add',
      'favorite_remove',
      'search',
      'notification_open',
      'share_click',
      'telefone_util_view',
      'telefone_util_call_click',
      'telefone_util_whatsapp_click',
      'ai_guide_question',
      'ai_guide_itinerary_create',
      'itinerary_save',
      'itinerary_share'
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
    'app_open',
    'app_screen_view',
    'empresa_view',
    'empresa_whatsapp_click',
    'empresa_phone_click',
    'empresa_map_click',
    'turismo_view',
    'turismo_map_click',
    'evento_view',
    'noticia_view',
    'favorite_add',
    'favorite_remove',
    'search',
    'notification_open',
    'share_click',
    'telefone_util_view',
    'telefone_util_call_click',
    'telefone_util_whatsapp_click',
    'ai_guide_question',
    'ai_guide_itinerary_create',
    'itinerary_save',
    'itinerary_share'
  ) then
    return;
  end if;

  if p_plataforma not in ('ios', 'android') then
    return;
  end if;

  v_user_id := auth.uid();
  v_metadata := coalesce(p_metadados, '{}'::jsonb)
    - 'email'
    - 'telefone'
    - 'phone'
    - 'token'
    - 'access_token'
    - 'refresh_token'
    - 'jwt'
    - 'headers'
    - 'senha'
    - 'password';

  if length(coalesce(v_metadata::text, '{}')) > 4000 then
    v_metadata := jsonb_build_object('truncated', true);
  end if;

  insert into public.analytics_eventos (
    tipo,
    pagina,
    recurso_tipo,
    recurso_id,
    destino,
    sessao_hash,
    origem,
    dispositivo,
    metadados,
    anonymous_id,
    usuario_id,
    app_version,
    notification_id
  ) values (
    p_tipo,
    '/app',
    left(p_recurso_tipo, 40),
    p_recurso_id,
    null,
    left(p_sessao_hash, 80),
    'app',
    p_plataforma,
    v_metadata,
    left(p_anonymous_id, 80),
    v_user_id,
    left(p_app_version, 30),
    p_notification_id
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

comment on function public.registrar_evento_app(text,text,text,text,uuid,uuid,text,text,jsonb)
  is 'Registra eventos first-party do aplicativo Viva Urania com minimizacao de dados pessoais e metricas avancadas de uso.';
