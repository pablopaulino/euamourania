-- Viva Urania - ranking profissional de empresas na Home do aplicativo
-- A Home passa a consumir uma RPC ranqueada no backend, com estabilidade por sessao
-- e balanceamento por impressoes reais recentes.

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
      'home_empresa_impression',
      'empresa_whatsapp_click',
      'empresa_phone_click',
      'empresa_map_click',
      'turismo_map_click',
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

create index if not exists analytics_eventos_home_empresa_impression_idx
  on public.analytics_eventos (criado_em desc, recurso_id)
  where tipo = 'home_empresa_impression'
    and recurso_tipo = 'empresa'
    and origem = 'app';

create index if not exists guia_comercial_home_empresas_idx
  on public.guia_comercial (status, recomendado, nome);

create or replace function public.app_home_empresa_opening_rank(
  p_opening_hours jsonb,
  p_now timestamptz default now()
) returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_now timestamp;
  v_current_minutes integer;
  v_today_key text;
  v_yesterday_key text;
  v_day jsonb;
  v_period jsonb;
  v_match text[];
  v_open_minutes integer;
  v_close_minutes integer;
  v_close_adjusted integer;
  v_has_schedule boolean := false;
begin
  if p_opening_hours is null or jsonb_typeof(p_opening_hours) <> 'object' then
    return 3;
  end if;

  v_now := p_now at time zone 'America/Sao_Paulo';
  v_current_minutes := extract(hour from v_now)::integer * 60 + extract(minute from v_now)::integer;

  v_today_key := case extract(isodow from v_now)::integer
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    when 6 then 'sat'
    else 'sun'
  end;

  v_yesterday_key := case v_today_key
    when 'mon' then 'sun'
    when 'tue' then 'mon'
    when 'wed' then 'tue'
    when 'thu' then 'wed'
    when 'fri' then 'thu'
    when 'sat' then 'fri'
    else 'sat'
  end;

  for v_day in
    select value
    from jsonb_each(p_opening_hours)
  loop
    if coalesce(nullif(v_day ->> 'closed', '')::boolean, false)
      or nullif(trim(v_day ->> 'open'), '') is not null
      or nullif(trim(v_day ->> 'close'), '') is not null
      or (
        jsonb_typeof(v_day -> 'periods') = 'array'
        and jsonb_array_length(v_day -> 'periods') > 0
      )
    then
      v_has_schedule := true;
      exit;
    end if;
  end loop;

  if not v_has_schedule then
    return 3;
  end if;

  -- Abertura que comecou ontem e atravessou a meia-noite.
  v_day := p_opening_hours -> v_yesterday_key;
  if v_day is not null and not coalesce(nullif(v_day ->> 'closed', '')::boolean, false) then
    for v_period in
      select value
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_day -> 'periods') = 'array' and jsonb_array_length(v_day -> 'periods') > 0
            then v_day -> 'periods'
          else jsonb_build_array(jsonb_build_object('open', v_day ->> 'open', 'close', v_day ->> 'close'))
        end
      )
    loop
      v_match := regexp_match(coalesce(v_period ->> 'open', ''), '^(\d{1,2}):(\d{2})');
      if v_match is null then continue; end if;
      v_open_minutes := ((v_match[1])::integer % 24) * 60 + (v_match[2])::integer;

      v_match := regexp_match(coalesce(v_period ->> 'close', ''), '^(\d{1,2}):(\d{2})');
      if v_match is null then continue; end if;
      v_close_minutes := ((v_match[1])::integer % 24) * 60 + (v_match[2])::integer;

      if v_close_minutes <= v_open_minutes and v_current_minutes < v_close_minutes then
        return 0;
      end if;
    end loop;
  end if;

  v_day := p_opening_hours -> v_today_key;
  if v_day is not null and not coalesce(nullif(v_day ->> 'closed', '')::boolean, false) then
    for v_period in
      select value
      from jsonb_array_elements(
        case
          when jsonb_typeof(v_day -> 'periods') = 'array' and jsonb_array_length(v_day -> 'periods') > 0
            then v_day -> 'periods'
          else jsonb_build_array(jsonb_build_object('open', v_day ->> 'open', 'close', v_day ->> 'close'))
        end
      )
    loop
      v_match := regexp_match(coalesce(v_period ->> 'open', ''), '^(\d{1,2}):(\d{2})');
      if v_match is null then continue; end if;
      v_open_minutes := ((v_match[1])::integer % 24) * 60 + (v_match[2])::integer;

      v_match := regexp_match(coalesce(v_period ->> 'close', ''), '^(\d{1,2}):(\d{2})');
      if v_match is null then continue; end if;
      v_close_minutes := ((v_match[1])::integer % 24) * 60 + (v_match[2])::integer;
      v_close_adjusted := case when v_close_minutes <= v_open_minutes then v_close_minutes + 1440 else v_close_minutes end;

      if v_current_minutes >= v_open_minutes and v_current_minutes < v_close_adjusted then
        return 0;
      end if;

      if v_open_minutes > v_current_minutes and v_open_minutes - v_current_minutes <= 30 then
        return 1;
      end if;
    end loop;
  end if;

  return 2;
end;
$$;

create or replace function public.app_home_empresas(
  p_limit integer default 15,
  p_session_key text default null,
  p_session_started_at timestamptz default null
) returns table (
  id uuid,
  nome text,
  slug text,
  categoria_id uuid,
  categoria_nome text,
  descricao text,
  imagem_url text,
  galeria_urls jsonb,
  whatsapp text,
  telefone text,
  instagram text,
  facebook text,
  site text,
  endereco text,
  horario text,
  mapa_url text,
  recomendado boolean,
  status text,
  atualizado_em timestamptz,
  opening_hours jsonb,
  opening_hours_note text,
  home_rank_position integer
)
language sql
stable
security definer
set search_path = public
as $$
  with server_clock as (
    select statement_timestamp() as server_now
  ),
  params as (
    select
      greatest(1, least(coalesce(p_limit, 15), 15)) as limit_value,
      coalesce(nullif(trim(p_session_key), ''), 'sem-sessao') as session_key,
      case
        when p_session_started_at is null then server_now
        when p_session_started_at > server_now + interval '5 minutes' then server_now
        when p_session_started_at < server_now - interval '24 hours' then server_now - interval '24 hours'
        else p_session_started_at
      end as session_started_at
    from server_clock
  ),
  impressions as (
    select
      ae.recurso_id as empresa_id,
      count(*)::integer as impression_count_7d,
      count(*) filter (
        where nullif(ae.metadados ->> 'position', '') ~ '^\d+$'
          and (ae.metadados ->> 'position')::integer <= 3
      )::integer as top3_impression_count_7d,
      avg((ae.metadados ->> 'position')::integer) filter (
        where nullif(ae.metadados ->> 'position', '') ~ '^\d+$'
      ) as avg_position_7d
    from public.analytics_eventos ae
    where ae.tipo = 'home_empresa_impression'
      and ae.recurso_tipo = 'empresa'
      and ae.origem = 'app'
      and ae.recurso_id is not null
      and ae.criado_em >= (select session_started_at from params) - interval '7 days'
      and ae.criado_em < (select session_started_at from params)
    group by ae.recurso_id
  ),
  candidates as (
    select
      g.id,
      g.nome,
      g.slug,
      g.categoria_id,
      g.categoria_nome,
      g.descricao,
      g.imagem_url,
      g.galeria_urls,
      g.whatsapp,
      g.telefone,
      g.instagram,
      g.facebook,
      g.site,
      g.endereco,
      g.horario,
      g.mapa_url,
      g.recomendado,
      g.status,
      g.atualizado_em,
      g.opening_hours,
      g.opening_hours_note,
      case when coalesce(g.recomendado, false) then 0 else 1 end as commercial_rank,
      public.app_home_empresa_opening_rank(g.opening_hours, (select session_started_at from params)) as operational_rank,
      coalesce(i.impression_count_7d, 0) as impression_count_7d,
      coalesce(i.top3_impression_count_7d, 0) as top3_impression_count_7d,
      i.avg_position_7d,
      md5((select session_key from params) || ':' || g.id::text) as session_sort_key
    from public.guia_comercial g
    left join impressions i on i.empresa_id = g.id
    where g.status = 'publicado'
  ),
  ranked as (
    select
      c.*,
      row_number() over (
        order by
          c.commercial_rank asc,
          c.impression_count_7d asc,
          c.top3_impression_count_7d asc,
          c.avg_position_7d desc nulls first,
          c.operational_rank asc,
          c.session_sort_key asc,
          lower(c.nome) asc,
          c.id asc
      )::integer as rank_position
    from candidates c
  )
  select
    r.id,
    r.nome,
    r.slug,
    r.categoria_id,
    r.categoria_nome,
    r.descricao,
    r.imagem_url,
    r.galeria_urls,
    r.whatsapp,
    r.telefone,
    r.instagram,
    r.facebook,
    r.site,
    r.endereco,
    r.horario,
    r.mapa_url,
    r.recomendado,
    r.status,
    r.atualizado_em,
    r.opening_hours,
    r.opening_hours_note,
    r.rank_position as home_rank_position
  from ranked r
  where r.rank_position <= (select limit_value from params)
  order by r.rank_position;
$$;

revoke all on function public.app_home_empresa_opening_rank(jsonb,timestamptz) from public;
revoke execute on function public.app_home_empresa_opening_rank(jsonb,timestamptz) from anon, authenticated;

drop function if exists public.app_home_empresas(integer,text,timestamptz,timestamptz);
revoke all on function public.app_home_empresas(integer,text,timestamptz) from public;
grant execute on function public.app_home_empresas(integer,text,timestamptz) to anon, authenticated;

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
    'home_empresa_impression',
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

comment on function public.app_home_empresas(integer,text,timestamptz)
  is $$Retorna empresas publicadas para a Home do app com prioridade comercial, status de funcionamento, balanceamento por impressoes recentes e ordem estavel por sessao.$$;

comment on function public.app_home_empresa_opening_rank(jsonb,timestamptz)
  is $$Calcula ranking operacional para a Home: aberto, abre em breve, fechado ou sem horario estruturado.$$;
