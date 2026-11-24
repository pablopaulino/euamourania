begin;

-- Vínculo de catálogo independente da apuração e dos dados históricos do indicado.
create table if not exists premios_privado.indicados_turismo (
  indicado_id uuid primary key references public.melhores_indicados(id) on delete cascade,
  turismo_id uuid not null references public.turismo(id) on delete cascade
);
alter table premios_privado.indicados_turismo enable row level security;
revoke all on premios_privado.indicados_turismo from public, anon, authenticated;
create index if not exists indicados_turismo_por_atrativo on premios_privado.indicados_turismo(turismo_id);

insert into premios_privado.indicados_turismo (indicado_id, turismo_id)
select i.id, t.id from public.melhores_indicados i cross join public.turismo t
where i.id='ff50425a-feef-44ad-a92a-2a0fe7b88c99'
  and t.id='0f874982-7dad-4dc8-aa6d-9d5a60a2a03e'
on conflict (indicado_id) do nothing;

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
      'turismo', case when t.id is not null then pg_catalog.jsonb_build_object(
        'id', t.id, 'nome', t.nome, 'slug', t.slug, 'status', t.status) end,
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
  left join premios_privado.indicados_turismo vinculo on vinculo.indicado_id = i.id
  left join public.turismo t on t.id = vinculo.turismo_id and t.status = 'publicado'
  left join public.guia_comercial g
    on g.id = i.guia_comercial_id and g.status = 'publicado'
  where ((r.publicado = true and (e.status = 'resultado_publicado' or (e.status = 'arquivada' and e.resultado_publicado_em is not null)))
    or (e.ano=2026 and e.status='apuracao' and r.vencedor is true and premios_api.melhores_revelacao_resultado_visivel(r.id)))
    and (p_edicao is null or r.edicao_id = p_edicao)
    and (not coalesce(p_somente_vencedores, false) or r.vencedor = true)
  order by e.ano desc, r.categoria_id, r.colocacao, i.nome;
$$;

commit;
