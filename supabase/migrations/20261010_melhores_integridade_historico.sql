-- Melhores de Urania: continuidade publica, sigilo da apuracao e historico imutavel.
-- Aplicar somente apos revisar em homologacao; esta migration nao e executada pelo deploy.
begin;

-- A escolha do desempate nao pode ficar na categoria publicamente legivel,
-- pois anteciparia o vencedor antes da divulgacao. Somente o painel a le.
create table if not exists public.melhores_desempates (
  categoria_id uuid primary key,
  edicao_id uuid not null,
  indicado_id uuid not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_desempates_categoria_fk
    foreign key (categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id) on delete cascade,
  constraint melhores_desempates_indicado_fk
    foreign key (indicado_id, categoria_id, edicao_id)
    references public.melhores_indicados(id, categoria_id, edicao_id) on delete cascade
);
create index if not exists melhores_desempates_edicao_idx
  on public.melhores_desempates(edicao_id);

alter table public.melhores_desempates enable row level security;
revoke all on public.melhores_desempates from public, anon, authenticated;
grant select, insert, update, delete on public.melhores_desempates to authenticated;

create policy "melhores_desempates_select" on public.melhores_desempates
for select to authenticated using (public.tem_permissao_admin('melhores','ler'));
create policy "melhores_desempates_insert" on public.melhores_desempates
for insert to authenticated with check (public.tem_permissao_admin('melhores','editar'));
create policy "melhores_desempates_update" on public.melhores_desempates
for update to authenticated using (public.tem_permissao_admin('melhores','editar'))
with check (public.tem_permissao_admin('melhores','editar'));
create policy "melhores_desempates_delete" on public.melhores_desempates
for delete to authenticated using (public.tem_permissao_admin('melhores','editar'));

-- A policy publica de categoria/indicado precisa reconhecer registros de um
-- resultado antigo, mas o SELECT bruto dos resultados sera restrito ao admin.
-- Este helper retorna somente um booleano, sem contagens nem dados internos.
create or replace function public.melhores_consta_em_resultado_publicado(
  p_categoria uuid default null,
  p_indicado uuid default null
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (p_categoria is not null or p_indicado is not null) and exists (
    select 1
    from public.melhores_resultados r
    join public.melhores_edicoes e on e.id = r.edicao_id
    where r.publicado = true
      and (e.status = 'resultado_publicado'
        or (e.status = 'arquivada' and e.resultado_publicado_em is not null))
      and (p_categoria is null or r.categoria_id = p_categoria)
      and (p_indicado is null or r.indicado_id = p_indicado)
  );
$$;

revoke all on function public.melhores_consta_em_resultado_publicado(uuid,uuid) from public;
grant execute on function public.melhores_consta_em_resultado_publicado(uuid,uuid)
  to anon, authenticated;

-- Entre indicacoes e votacao o calendario/categorias seguem publicos, mas a
-- lista final de indicados permanece privada ate a abertura da votacao.
drop policy if exists "melhores_edicoes_select" on public.melhores_edicoes;
create policy "melhores_edicoes_select" on public.melhores_edicoes
for select to anon, authenticated using (
  public.tem_permissao_admin('melhores','ler')
  or status in (
    'indicacoes_abertas','indicacoes_encerradas','votacao_aberta',
    'votacao_encerrada','apuracao','resultado_publicado'
  )
  or (status = 'arquivada' and resultado_publicado_em is not null)
);

drop policy if exists "melhores_categorias_select" on public.melhores_categorias;
create policy "melhores_categorias_select" on public.melhores_categorias
for select to anon, authenticated using (
  public.tem_permissao_admin('melhores','ler')
  or (
    status = 'ativo' and visibilidade_publica = true
    and exists (
      select 1 from public.melhores_edicoes e
      where e.id = edicao_id
        and (e.status in (
          'indicacoes_abertas','indicacoes_encerradas','votacao_aberta',
          'votacao_encerrada','apuracao','resultado_publicado'
        ) or (e.status = 'arquivada' and e.resultado_publicado_em is not null))
    )
  )
  or public.melhores_consta_em_resultado_publicado(id, null)
);

drop policy if exists "melhores_indicados_select" on public.melhores_indicados;
create policy "melhores_indicados_select" on public.melhores_indicados
for select to anon, authenticated using (
  public.tem_permissao_admin('melhores','ler')
  or (
    status = 'ativo' and aprovado = true
    and exists (
      select 1 from public.melhores_edicoes e
      where e.id = edicao_id
        and (e.status in (
          'votacao_aberta','votacao_encerrada','apuracao',
          'resultado_publicado'
        ) or (e.status = 'arquivada' and e.resultado_publicado_em is not null))
    )
  )
  or public.melhores_consta_em_resultado_publicado(null, id)
);

-- A tabela bruta e o consolidado contem contagens. RLS continua permitindo
-- leitura administrativa, mas nunca leitura direta a anon/usuarios comuns.
-- Nao revogamos SELECT de authenticated: o painel depende dessa role e RLS
-- diferencia os administradores pelo RBAC existente.
drop policy if exists "melhores_resultados_select" on public.melhores_resultados;
create policy "melhores_resultados_select" on public.melhores_resultados
for select to anon, authenticated using (
  public.tem_permissao_admin('melhores','ler')
);

-- O painel apenas le resultados; a gravacao oficial ocorre exclusivamente
-- pela RPC administrativa SECURITY DEFINER, nunca por REST direto.
drop policy if exists "melhores_resultados_write" on public.melhores_resultados;
revoke insert, update, delete on public.melhores_resultados
  from public, anon, authenticated;

drop policy if exists "melhores_consolidados_select" on public.melhores_consolidados;
create policy "melhores_consolidados_select" on public.melhores_consolidados
for select to authenticated using (
  public.tem_permissao_admin('melhores','ler')
);

-- Contrato publico estrito. Funcao STABLE para GET no PostgREST; nenhum campo
-- administrativo e retornado. Guia Comercial so e incorporado se publicado.
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
    case when e.mostrar_votos_publicamente then r.votos_site else null end,
    case when e.mostrar_votos_publicamente then r.percentual_site else null end,
    case when e.mostrar_votos_publicamente then r.votos_instagram else null end,
    case when e.mostrar_votos_publicamente then r.percentual_instagram else null end,
    case when e.mostrar_votos_publicamente then r.pontuacao_final else null end,
    r.colocacao, r.vencedor, r.selo, r.empate, r.criterio_aplicado,
    r.metodologia_resumida, r.publicado, r.publicado_em,
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
  where r.publicado = true
    and (e.status = 'resultado_publicado'
      or (e.status = 'arquivada' and e.resultado_publicado_em is not null))
    and (p_edicao is null or r.edicao_id = p_edicao)
    and (not coalesce(p_somente_vencedores, false) or r.vencedor = true)
  order by e.ano desc, r.categoria_id, r.colocacao, i.nome;
$$;

revoke all on function public.melhores_listar_resultados_publicos(uuid,boolean) from public;
grant execute on function public.melhores_listar_resultados_publicos(uuid,boolean)
  to anon, authenticated;

-- Evita que a interface administrativa ou uma chamada direta apague/corrija
-- silenciosamente um resultado ja publicado, inclusive por FK ON DELETE CASCADE.
create or replace function public.melhores_proteger_historico()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_historica boolean;
  v_vinculo_id uuid;
begin
  if tg_table_name = 'melhores_resultados' then
    if tg_op = 'INSERT' then
      select e.status in ('resultado_publicado','arquivada') into v_historica
      from public.melhores_edicoes e where e.id = new.edicao_id;
      if coalesce(v_historica, false) then
        raise exception 'Resultado publicado e imutavel.' using errcode = '23514';
      end if;
      return new;
    end if;
    select e.status in ('resultado_publicado','arquivada') into v_historica
    from public.melhores_edicoes e where e.id = old.edicao_id;
    if old.publicado or coalesce(v_historica, false) then
      raise exception 'Resultado publicado e imutavel.' using errcode = '23514';
    end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_table_name = 'melhores_edicoes' then
    if tg_op = 'DELETE' then
      v_historica := old.status in ('resultado_publicado','arquivada')
        or exists (
          select 1 from public.melhores_resultados r
          where r.edicao_id = old.id and r.publicado = true
        );
      if v_historica then
        raise exception 'Edicao com resultado publicado deve permanecer no historico.'
          using errcode = '23514';
      end if;
      return old;
    end if;
    if new.status = 'arquivada'
       and old.status not in ('resultado_publicado','arquivada') then
      raise exception 'Somente uma edicao com resultado publicado pode ser arquivada.'
        using errcode = '23514';
    end if;
    if new.status = 'resultado_publicado'
       and old.status not in ('resultado_publicado','arquivada') then
      if not exists (
        select 1 from public.melhores_resultados r
        where r.edicao_id = old.id and r.publicado = true and r.vencedor = true
      ) or exists (
        select 1 from public.melhores_categorias c
        where c.edicao_id = old.id and c.status = 'ativo'
          and c.visibilidade_publica = true
          and not exists (
            select 1 from public.melhores_resultados r
            where r.edicao_id = old.id and r.categoria_id = c.id
              and r.publicado = true and r.vencedor = true
          )
      ) then
        raise exception 'Publique a apuracao com vencedores antes de mudar o status da edicao.'
          using errcode = '23514';
      end if;
    end if;
    if old.status in ('resultado_publicado','arquivada') then
      if old.status = 'arquivada' and new.status <> 'arquivada' then
        raise exception 'Edicao arquivada nao pode voltar a fase anterior.'
          using errcode = '23514';
      end if;
      if old.status = 'resultado_publicado'
         and new.status not in ('resultado_publicado','arquivada') then
        raise exception 'Resultado publicado nao pode voltar a fase anterior.'
          using errcode = '23514';
      end if;
      if (pg_catalog.to_jsonb(new) - 'status' - 'atualizado_em'
          - 'atualizado_por' - 'votos_individuais_removidos_em'
          - 'votos_individuais_limpos_em')
         is distinct from
         (pg_catalog.to_jsonb(old) - 'status' - 'atualizado_em'
          - 'atualizado_por' - 'votos_individuais_removidos_em'
          - 'votos_individuais_limpos_em') then
        raise exception 'Dados de edicao com resultado publicado sao imutaveis.'
          using errcode = '23514';
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    select e.status in ('resultado_publicado','arquivada') into v_historica
    from public.melhores_edicoes e where e.id = new.edicao_id;
    if coalesce(v_historica, false) or exists (
      select 1 from public.melhores_resultados r
      where r.edicao_id = new.edicao_id and r.publicado = true
    ) then
      raise exception 'Nao e possivel adicionar dados a uma edicao com resultado publicado.'
        using errcode = '23514';
    end if;
    return new;
  end if;

  select e.status in ('resultado_publicado','arquivada') into v_historica
  from public.melhores_edicoes e
  where e.id = old.edicao_id;

  -- As tres tabelas usam chaves diferentes. Escolher o campo antes da
  -- consulta evita acessar OLD.id em desempates ou OLD.categoria_id nas demais.
  if tg_table_name = 'melhores_desempates' then
    v_vinculo_id := old.categoria_id;
  else
    v_vinculo_id := old.id;
  end if;
  if coalesce(v_historica, false) or exists (
    select 1 from public.melhores_resultados r
    where r.publicado = true
      and (
        (tg_table_name in ('melhores_categorias','melhores_desempates')
          and r.categoria_id = v_vinculo_id)
        or (tg_table_name = 'melhores_indicados'
          and r.indicado_id = v_vinculo_id)
      )
  ) then
    -- O Guia Comercial usa ON DELETE SET NULL no vinculo opcional. Uma
    -- empresa removida nao deve impedir a preservacao do nome/foto premiados.
    if tg_table_name = 'melhores_indicados' and tg_op = 'UPDATE' then
      if old.guia_comercial_id is not null and new.guia_comercial_id is null
         and (pg_catalog.to_jsonb(new) - 'guia_comercial_id' - 'atualizado_em'
              - 'atualizado_por') =
             (pg_catalog.to_jsonb(old) - 'guia_comercial_id' - 'atualizado_em'
              - 'atualizado_por') then
        return new;
      end if;
    end if;
    raise exception 'Dados vinculados a resultado publicado sao imutaveis.'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.edicao_id is distinct from old.edicao_id then
      select e.status in ('resultado_publicado','arquivada') into v_historica
      from public.melhores_edicoes e where e.id = new.edicao_id;
      if coalesce(v_historica, false) or exists (
        select 1 from public.melhores_resultados r
        where r.edicao_id = new.edicao_id and r.publicado = true
      ) then
        raise exception 'Nao e possivel mover dados para uma edicao com resultado publicado.'
          using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists zz_melhores_edicoes_proteger_historico on public.melhores_edicoes;
create trigger zz_melhores_edicoes_proteger_historico
before update or delete on public.melhores_edicoes
for each row execute function public.melhores_proteger_historico();

drop trigger if exists zz_melhores_categorias_proteger_historico on public.melhores_categorias;
create trigger zz_melhores_categorias_proteger_historico
before insert or update or delete on public.melhores_categorias
for each row execute function public.melhores_proteger_historico();

drop trigger if exists zz_melhores_indicados_proteger_historico on public.melhores_indicados;
create trigger zz_melhores_indicados_proteger_historico
before insert or update or delete on public.melhores_indicados
for each row execute function public.melhores_proteger_historico();

drop trigger if exists zz_melhores_resultados_proteger_historico on public.melhores_resultados;
create trigger zz_melhores_resultados_proteger_historico
before insert or update or delete on public.melhores_resultados
for each row execute function public.melhores_proteger_historico();

drop trigger if exists zz_melhores_desempates_proteger_historico on public.melhores_desempates;
create trigger zz_melhores_desempates_proteger_historico
before insert or update or delete on public.melhores_desempates
for each row execute function public.melhores_proteger_historico();

revoke all on function public.melhores_proteger_historico() from public;

-- A primeira publicacao e unica. Cada categoria publica ativa precisa ter
-- votos e um vencedor inequívoco. Em empate superior, a selecao deve ser um
-- indicado empatado da mesma categoria e vir acompanhada de regra textual.
create or replace function public.melhores_publicar_resultado(
  p_edicao uuid,
  p_metodologia text default null
) returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer := 0;
  v_status text;
  v_categoria record;
begin
  if not public.tem_permissao_admin('melhores','editar') then
    raise exception 'Sem permissao para publicar resultado.' using errcode = '42501';
  end if;

  select e.status into v_status
  from public.melhores_edicoes e where e.id = p_edicao for update;
  if not found then
    raise exception 'Edicao nao encontrada.' using errcode = 'P0002';
  end if;
  if v_status in ('resultado_publicado','arquivada')
     or exists (
       select 1 from public.melhores_resultados r
       where r.edicao_id = p_edicao and r.publicado = true
     ) then
    raise exception 'Resultado ja publicado: o historico nao pode ser republicado.'
      using errcode = '23514';
  end if;
  if v_status not in ('votacao_encerrada','apuracao') then
    raise exception 'A edicao precisa estar encerrada ou em apuracao para publicar resultado.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.melhores_categorias c
    where c.edicao_id = p_edicao and c.status = 'ativo'
      and c.visibilidade_publica = true
  ) then
    raise exception 'Nenhuma categoria publica ativa para publicar.'
      using errcode = '22023';
  end if;

  for v_categoria in
    select c.id, c.nome, d.indicado_id as desempate_vencedor_id,
      coalesce(nullif(pg_catalog.btrim(c.regra_desempate), ''),
        nullif(pg_catalog.btrim(e.criterio_desempate), '')) as regra,
      coalesce(pg_catalog.sum(a.votos_site + a.votos_instagram), 0) as votos
    from public.melhores_categorias c
    join public.melhores_edicoes e on e.id = c.edicao_id
    left join public.melhores_desempates d
      on d.categoria_id = c.id and d.edicao_id = c.edicao_id
    left join public.melhores_apuracao_previa a
      on a.categoria_id = c.id and a.edicao_id = c.edicao_id
    where c.edicao_id = p_edicao and c.status = 'ativo'
      and c.visibilidade_publica = true
    group by c.id, c.nome, d.indicado_id,
      c.regra_desempate, e.criterio_desempate
  loop
    if v_categoria.votos <= 0 then
      raise exception 'A categoria "%" nao possui votos validos para publicar.',
        v_categoria.nome using errcode = '22023';
    end if;

    if (
      select pg_catalog.count(*)
      from public.melhores_apuracao_previa a
      where a.edicao_id = p_edicao and a.categoria_id = v_categoria.id
        and a.pontuacao_final = (
          select pg_catalog.max(b.pontuacao_final)
          from public.melhores_apuracao_previa b
          where b.edicao_id = p_edicao and b.categoria_id = v_categoria.id
        )
    ) > 1 then
      if v_categoria.desempate_vencedor_id is null
         or v_categoria.regra is null
         or not exists (
           select 1 from public.melhores_apuracao_previa a
           where a.edicao_id = p_edicao and a.categoria_id = v_categoria.id
             and a.indicado_id = v_categoria.desempate_vencedor_id
             and a.pontuacao_final = (
               select pg_catalog.max(b.pontuacao_final)
               from public.melhores_apuracao_previa b
               where b.edicao_id = p_edicao and b.categoria_id = v_categoria.id
             )
         ) then
        raise exception 'Empate na categoria "%": escolha um indicado empatado e registre a regra de desempate.',
          v_categoria.nome using errcode = '22023';
      end if;
    end if;
  end loop;

  -- Resultados antigos ainda nao publicados podem ser recalculados. Uma vez
  -- publicados, os triggers acima impedem qualquer substituicao do snapshot.
  delete from public.melhores_resultados where edicao_id = p_edicao;

  insert into public.melhores_resultados (
    edicao_id, categoria_id, indicado_id, votos_site, percentual_site,
    votos_instagram, percentual_instagram, peso_site, peso_instagram,
    pontuacao_final, colocacao, vencedor, selo, empate, criterio_aplicado,
    metodologia_resumida, publicado, publicado_por, publicado_em
  )
  with classificados as (
    select a.*, d.indicado_id as desempate_vencedor_id,
      coalesce(nullif(pg_catalog.btrim(c.regra_desempate), ''),
        nullif(pg_catalog.btrim(e.criterio_desempate), '')) as regra,
      pg_catalog.max(a.pontuacao_final) over (
        partition by a.categoria_id
      ) as maior_pontuacao,
      pg_catalog.row_number() over (
        partition by a.categoria_id
        order by a.pontuacao_final desc,
          case when a.indicado_id = d.indicado_id then 0 else 1 end,
          a.votos_site desc, a.votos_instagram desc, a.indicado_nome asc
      )::integer as posicao_final
    from public.melhores_apuracao_previa a
    join public.melhores_categorias c on c.id = a.categoria_id
    join public.melhores_edicoes e on e.id = a.edicao_id
    left join public.melhores_desempates d
      on d.categoria_id = c.id and d.edicao_id = c.edicao_id
    where a.edicao_id = p_edicao and c.status = 'ativo'
      and c.visibilidade_publica = true
  )
  select
    a.edicao_id, a.categoria_id, a.indicado_id,
    a.votos_site, a.percentual_site, a.votos_instagram,
    a.percentual_instagram, a.peso_site, a.peso_instagram,
    a.pontuacao_final, a.posicao_final, a.posicao_final = 1,
    case when a.posicao_final = 1 then 'vencedor' else 'indicado' end,
    a.empate,
    case when a.empate and a.pontuacao_final = a.maior_pontuacao then
      'Desempate registrado: ' || a.regra
    else 'Pontuacao ponderada por percentuais de site e Instagram.' end,
    p_metodologia, true, (select auth.uid()), pg_catalog.now()
  from classificados a;

  get diagnostics v_count = row_count;

  update public.melhores_edicoes
  set status = 'resultado_publicado',
      resultado_publicado_em = pg_catalog.now(),
      encerramento_em = coalesce(encerramento_em, votacao_fim, pg_catalog.now())
  where id = p_edicao;

  perform public.melhores_consolidar_edicao(p_edicao);

  insert into public.melhores_auditoria (
    edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores
  ) values (
    p_edicao, (select auth.uid()), 'resultado_publicado',
    'melhores_resultados', p_edicao,
    pg_catalog.jsonb_build_object(
      'resultados_publicados', v_count, 'metodologia', p_metodologia
    )
  );

  return v_count;
end;
$$;

revoke all on function public.melhores_publicar_resultado(uuid,text) from public;
grant execute on function public.melhores_publicar_resultado(uuid,text)
  to authenticated;

commit;
