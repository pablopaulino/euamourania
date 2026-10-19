-- Expose the same verified status used by the public Guia to app home clients.
-- PostgreSQL requires dropping the RPC before changing its RETURNS TABLE row type.
BEGIN;
DROP FUNCTION IF EXISTS public.app_home_empresas(integer,text,timestamptz);
create function public.app_home_empresas(
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
  verificado boolean,
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
      public.verificado(g) as verificado,
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
    r.verificado,
    r.status,
    r.atualizado_em,
    r.opening_hours,
    r.opening_hours_note,
    r.rank_position as home_rank_position
  from ranked r
  where r.rank_position <= (select limit_value from params)
  order by r.rank_position;
$$;
REVOKE ALL ON FUNCTION public.app_home_empresas(integer,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_home_empresas(integer,text,timestamptz) TO anon, authenticated;
COMMENT ON FUNCTION public.app_home_empresas(integer,text,timestamptz) IS 'Ranked published Guia businesses for app home, including verified subscription status.';
NOTIFY pgrst, 'reload schema';
COMMIT;
