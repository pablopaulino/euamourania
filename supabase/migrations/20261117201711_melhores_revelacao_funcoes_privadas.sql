-- Mantém verificadores usados pelas políticas fora do esquema público da API.
begin;
create schema premios_api;
revoke all on schema premios_api from public,anon,authenticated;
grant usage on schema premios_api to anon,authenticated;
alter function public.melhores_revelacao_resultado_visivel(uuid) set schema premios_api;
alter function public.melhores_revelacao_campanha_visivel(uuid) set schema premios_api;
alter function public.melhores_revelacao_app_visivel(uuid) set schema premios_api;
create or replace function premios_api.melhores_revelacao_resultado_visivel(p_resultado uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,premios_privado as $$
  select exists(select 1 from public.melhores_resultados r
    join public.melhores_edicoes e on e.id=r.edicao_id
    join premios_privado.agendamentos a on a.edicao_id=r.edicao_id
    join premios_privado.revelacoes x on x.edicao_id=r.edicao_id and x.categoria_id=r.categoria_id
    where r.id=p_resultado and r.vencedor is true and e.ano=2026 and e.status='apuracao'
      and a.publicado_em is null and x.publicar_em<=now());
$$;
revoke all on function premios_api.melhores_revelacao_resultado_visivel(uuid) from public,anon,authenticated;
grant execute on function premios_api.melhores_revelacao_resultado_visivel(uuid) to anon,authenticated;

create or replace function premios_api.melhores_revelacao_campanha_visivel(p_campanha uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,premios_privado as $$
  select exists(select 1 from premios_privado.revelacao_campanhas m
    join public.app_melhores_campanhas c on c.id=m.campanha_id and c.edicao_id=m.edicao_id
    join public.melhores_edicoes e on e.id=m.edicao_id and e.ano=2026 and e.status='apuracao'
    join premios_privado.agendamentos a on a.edicao_id=e.id and a.publicado_em is null
    where m.campanha_id=p_campanha and c.ativo and c.status in ('ativa','agendada')
      and c.exibir_inicio<=now() and c.exibir_fim>=now()
      and exists(select 1 from premios_privado.revelacoes x where x.edicao_id=e.id and x.publicar_em<=now()));
$$;
revoke all on function premios_api.melhores_revelacao_campanha_visivel(uuid) from public,anon,authenticated;
grant execute on function premios_api.melhores_revelacao_campanha_visivel(uuid) to anon,authenticated;

create or replace function premios_api.melhores_revelacao_app_visivel(p_vencedor uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,premios_privado as $$
  select exists(select 1 from public.app_melhores_vencedores w
    join premios_privado.revelacao_campanhas m on m.campanha_id=w.campanha_id
    join public.melhores_resultados r on r.id=w.resultado_id and r.edicao_id=m.edicao_id and r.categoria_id=w.categoria_id and r.indicado_id=w.indicado_id
    where w.id=p_vencedor and w.status='ativo' and premios_api.melhores_revelacao_campanha_visivel(w.campanha_id)
      and premios_api.melhores_revelacao_resultado_visivel(r.id));
$$;
revoke all on function premios_api.melhores_revelacao_app_visivel(uuid) from public,anon,authenticated;
grant execute on function premios_api.melhores_revelacao_app_visivel(uuid) to anon,authenticated;

create or replace function public.melhores_listar_resultados_publicos(
  p_edicao uuid default null,
  p_somente_vencedores boolean default false
)
returns table (
  id uuid,
  edicao_id uuid,
  categoria_id uuid,
  indicado_id uuid,
  votos_site integer,
  percentual_site numeric,
  votos_instagram integer,
  percentual_instagram numeric,
  pontuacao_final numeric,
  colocacao integer,
  vencedor boolean,
  selo text,
  empate boolean,
  criterio_aplicado text,
  metodologia_resumida text,
  publicado boolean,
  publicado_em timestamptz,
  melhores_categorias jsonb,
  melhores_indicados jsonb,
  melhores_edicoes jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    r.id, r.edicao_id, r.categoria_id, r.indicado_id,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.votos_site else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.percentual_site else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.votos_instagram else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.percentual_instagram else null end,
    case when e.status <> 'apuracao' and e.mostrar_votos_publicamente then r.pontuacao_final else null end,
    r.colocacao, r.vencedor, r.selo, r.empate, r.criterio_aplicado,
    r.metodologia_resumida, true, coalesce(r.publicado_em, (select x.publicar_em from premios_privado.revelacoes x where x.edicao_id=r.edicao_id and x.categoria_id=r.categoria_id)),
    pg_catalog.jsonb_build_object('nome', c.nome),
    pg_catalog.jsonb_build_object(
      'nome', i.nome,
      'imagem_url', i.imagem_url,
      'descricao_curta', i.descricao_curta,
      'guia_comercial_id', i.guia_comercial_id,
      'guia_comercial', case when g.id is null then null else
        pg_catalog.jsonb_build_object(
          'id', g.id, 'nome', g.nome, 'slug', g.slug,
          'imagem_url', g.imagem_url, 'categoria_nome', g.categoria_nome,
          'status', g.status
        ) end
    ),
    pg_catalog.jsonb_build_object('ano', e.ano, 'nome', e.nome)
  from public.melhores_resultados r
  join public.melhores_edicoes e on e.id = r.edicao_id
  join public.melhores_categorias c on c.id = r.categoria_id
  join public.melhores_indicados i on i.id = r.indicado_id
  left join public.guia_comercial g
    on g.id = i.guia_comercial_id and g.status = 'publicado'
  where ((r.publicado = true and (e.status = 'resultado_publicado' or (e.status = 'arquivada' and e.resultado_publicado_em is not null)))
    or (e.ano=2026 and e.status='apuracao' and r.vencedor is true and premios_api.melhores_revelacao_resultado_visivel(r.id)))
    and (p_edicao is null or r.edicao_id = p_edicao)
    and (not coalesce(p_somente_vencedores, false) or r.vencedor = true)
  order by e.ano desc, r.categoria_id, r.colocacao, i.nome;
$$;

revoke all on function public.melhores_listar_resultados_publicos(uuid,boolean) from public;
grant execute on function public.melhores_listar_resultados_publicos(uuid,boolean)
  to anon, authenticated;



commit;
