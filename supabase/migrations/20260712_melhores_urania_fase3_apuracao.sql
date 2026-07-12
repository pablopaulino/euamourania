-- Eu Amo Urania - Melhores de Urania - Fase 3
-- Instagram manual, apuracao ponderada e publicacao do resultado oficial.

begin;

create table if not exists public.melhores_instagram_votos(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  categoria_id uuid not null,
  indicado_id uuid not null,
  votos integer not null default 0,
  comprovante_url text,
  observacao text,
  coletado_em timestamptz,
  lancado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_instagram_categoria_mesma_edicao_fk
    foreign key(categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id)
    on delete cascade,
  constraint melhores_instagram_indicado_mesma_categoria_fk
    foreign key(indicado_id, categoria_id, edicao_id)
    references public.melhores_indicados(id, categoria_id, edicao_id)
    on delete cascade,
  constraint melhores_instagram_votos_check check(votos >= 0),
  constraint melhores_instagram_unico_indicado unique(edicao_id, categoria_id, indicado_id)
);

create index if not exists melhores_instagram_edicao_categoria_idx
  on public.melhores_instagram_votos(edicao_id, categoria_id);

drop trigger if exists melhores_instagram_atualizado on public.melhores_instagram_votos;
create trigger melhores_instagram_atualizado before update on public.melhores_instagram_votos
for each row execute function public.set_atualizado_em();

create or replace function public.melhores_instagram_autoria()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    new.lancado_por := coalesce(new.lancado_por, (select auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists melhores_instagram_autoria_trigger on public.melhores_instagram_votos;
create trigger melhores_instagram_autoria_trigger before insert on public.melhores_instagram_votos
for each row execute function public.melhores_instagram_autoria();

drop trigger if exists melhores_instagram_auditoria on public.melhores_instagram_votos;
create trigger melhores_instagram_auditoria after insert or update or delete on public.melhores_instagram_votos
for each row execute function public.melhores_registrar_auditoria();

alter table public.melhores_instagram_votos enable row level security;

drop policy if exists "melhores_instagram_select" on public.melhores_instagram_votos;
create policy "melhores_instagram_select" on public.melhores_instagram_votos
for select to authenticated using(public.tem_permissao_admin('melhores','ler'));

drop policy if exists "melhores_instagram_insert" on public.melhores_instagram_votos;
create policy "melhores_instagram_insert" on public.melhores_instagram_votos
for insert to authenticated with check(public.tem_permissao_admin('melhores','editar'));

drop policy if exists "melhores_instagram_update" on public.melhores_instagram_votos;
create policy "melhores_instagram_update" on public.melhores_instagram_votos
for update to authenticated using(public.tem_permissao_admin('melhores','editar')) with check(public.tem_permissao_admin('melhores','editar'));

drop policy if exists "melhores_instagram_delete" on public.melhores_instagram_votos;
create policy "melhores_instagram_delete" on public.melhores_instagram_votos
for delete to authenticated using(public.tem_permissao_admin('melhores','excluir'));

create or replace view public.melhores_apuracao_previa as
with site as(
  select edicao_id, categoria_id, indicado_id, count(*) filter(where status='valido')::integer as votos_site
  from public.melhores_votos
  group by edicao_id, categoria_id, indicado_id
),
instagram as(
  select edicao_id, categoria_id, indicado_id, sum(votos)::integer as votos_instagram
  from public.melhores_instagram_votos
  group by edicao_id, categoria_id, indicado_id
),
base as(
  select
    i.edicao_id,
    i.categoria_id,
    i.id as indicado_id,
    i.nome as indicado_nome,
    c.nome as categoria_nome,
    coalesce(s.votos_site,0) as votos_site,
    coalesce(inst.votos_instagram,0) as votos_instagram
  from public.melhores_indicados i
  join public.melhores_categorias c on c.id=i.categoria_id
  left join site s on s.indicado_id=i.id
  left join instagram inst on inst.indicado_id=i.id
  where i.status='ativo' and i.aprovado=true
),
totais as(
  select
    edicao_id,
    categoria_id,
    sum(votos_site)::numeric as total_site,
    sum(votos_instagram)::numeric as total_instagram
  from base
  group by edicao_id, categoria_id
)
select
  b.edicao_id,
  b.categoria_id,
  b.indicado_id,
  b.categoria_nome,
  b.indicado_nome,
  b.votos_site,
  b.votos_instagram,
  case when t.total_site > 0 then round((b.votos_site::numeric / t.total_site) * 100, 4) else 0 end as percentual_site,
  case when t.total_instagram > 0 then round((b.votos_instagram::numeric / t.total_instagram) * 100, 4) else 0 end as percentual_instagram,
  e.peso_site,
  e.peso_instagram,
  round(
    (case when t.total_site > 0 then (b.votos_site::numeric / t.total_site) * e.peso_site else 0 end)
    + (case when t.total_instagram > 0 then (b.votos_instagram::numeric / t.total_instagram) * e.peso_instagram else 0 end),
    6
  ) as pontuacao_final,
  dense_rank() over(
    partition by b.edicao_id, b.categoria_id
    order by
      round(
        (case when t.total_site > 0 then (b.votos_site::numeric / t.total_site) * e.peso_site else 0 end)
        + (case when t.total_instagram > 0 then (b.votos_instagram::numeric / t.total_instagram) * e.peso_instagram else 0 end),
        6
      ) desc,
      b.votos_site desc,
      b.votos_instagram desc,
      b.indicado_nome asc
  ) as colocacao,
  count(*) over(
    partition by b.edicao_id, b.categoria_id,
    round(
      (case when t.total_site > 0 then (b.votos_site::numeric / t.total_site) * e.peso_site else 0 end)
      + (case when t.total_instagram > 0 then (b.votos_instagram::numeric / t.total_instagram) * e.peso_instagram else 0 end),
      6
    )
  ) > 1 as empate
from base b
join totais t on t.edicao_id=b.edicao_id and t.categoria_id=b.categoria_id
join public.melhores_edicoes e on e.id=b.edicao_id;

create or replace function public.melhores_obter_apuracao(p_edicao uuid)
returns setof public.melhores_apuracao_previa
language sql
security definer
set search_path=public
as $$
  select *
  from public.melhores_apuracao_previa
  where edicao_id=p_edicao
    and public.tem_permissao_admin('melhores','ler')
  order by categoria_nome, colocacao, indicado_nome;
$$;

create or replace function public.melhores_publicar_resultado(
  p_edicao uuid,
  p_metodologia text default null
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer := 0;
  v_status text;
begin
  if not public.tem_permissao_admin('melhores','editar') then
    raise exception 'Sem permissao para publicar resultado.' using errcode='42501';
  end if;

  select status into v_status from public.melhores_edicoes where id=p_edicao for update;
  if not found then
    raise exception 'Edicao nao encontrada.' using errcode='P0002';
  end if;
  if v_status not in('votacao_encerrada','apuracao','resultado_publicado') then
    raise exception 'A edicao precisa estar encerrada ou em apuracao para publicar resultado.' using errcode='22023';
  end if;

  delete from public.melhores_resultados where edicao_id=p_edicao;

  insert into public.melhores_resultados(
    edicao_id,
    categoria_id,
    indicado_id,
    votos_site,
    percentual_site,
    votos_instagram,
    percentual_instagram,
    peso_site,
    peso_instagram,
    pontuacao_final,
    colocacao,
    vencedor,
    selo,
    empate,
    criterio_aplicado,
    metodologia_resumida,
    publicado,
    publicado_por,
    publicado_em
  )
  select
    edicao_id,
    categoria_id,
    indicado_id,
    votos_site,
    percentual_site,
    votos_instagram,
    percentual_instagram,
    peso_site,
    peso_instagram,
    pontuacao_final,
    colocacao,
    colocacao=1,
    case when colocacao=1 then 'vencedor' else 'finalista' end,
    empate,
    case
      when empate and colocacao=1 then 'Empate identificado; revisar criterio da organizacao.'
      else 'Pontuacao ponderada por percentuais de site e Instagram.'
    end,
    p_metodologia,
    true,
    (select auth.uid()),
    now()
  from public.melhores_apuracao_previa
  where edicao_id=p_edicao;

  get diagnostics v_count = row_count;

  update public.melhores_edicoes
  set status='resultado_publicado',
      resultado_publicado_em=coalesce(resultado_publicado_em, now()),
      encerramento_em=coalesce(encerramento_em, votacao_fim, now())
  where id=p_edicao;

  perform public.melhores_consolidar_edicao(p_edicao);

  insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
  values(p_edicao, (select auth.uid()), 'resultado_publicado', 'melhores_resultados', p_edicao,
    jsonb_build_object('resultados_publicados', v_count, 'metodologia', p_metodologia));

  return v_count;
end;
$$;

revoke all on function public.melhores_obter_apuracao(uuid) from public;
revoke all on function public.melhores_publicar_resultado(uuid,text) from public;
grant execute on function public.melhores_obter_apuracao(uuid) to authenticated;
grant execute on function public.melhores_publicar_resultado(uuid,text) to authenticated;

commit;
