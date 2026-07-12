-- Eu Amo Urania - Melhores de Urania - Fase 1
-- Execute no SQL Editor do Supabase somente apos revisar a documentacao.
-- Esta migracao cria a base administrativa, constraints, RLS, auditoria
-- e a rotina de retencao dos votos individuais.

begin;

-- ---------------------------------------------------------------------------
-- Permissoes do CMS
-- ---------------------------------------------------------------------------
insert into public.admin_permissoes_funcao(funcao, modulo, acao) values
  ('administrador','melhores','acessar'),
  ('administrador','melhores','ler'),
  ('administrador','melhores','criar'),
  ('administrador','melhores','editar'),
  ('administrador','melhores','excluir'),
  ('editor','melhores','acessar'),
  ('editor','melhores','ler'),
  ('comercial','melhores','acessar'),
  ('comercial','melhores','ler'),
  ('visualizador','melhores','acessar'),
  ('visualizador','melhores','ler')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Edicoes
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_edicoes(
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ano integer not null,
  slug text not null,
  descricao text,
  regulamento text,
  metodologia text,
  imagem_capa_url text,
  status text not null default 'planejamento',
  indicacoes_inicio timestamptz,
  indicacoes_fim timestamptz,
  votacao_inicio timestamptz,
  votacao_fim timestamptz,
  encerramento_em timestamptz,
  divulgacao_em timestamptz,
  resultado_publicado_em timestamptz,
  peso_site numeric(5,2) not null default 50,
  peso_instagram numeric(5,2) not null default 50,
  criterio_desempate text,
  mostrar_votos_publicamente boolean not null default false,
  votos_individuais_remover_apos interval not null default interval '7 days',
  votos_individuais_removidos_em timestamptz,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_edicoes_ano_unico unique(ano),
  constraint melhores_edicoes_slug_unico unique(slug),
  constraint melhores_edicoes_status_check check(status in(
    'planejamento',
    'indicacoes_abertas',
    'indicacoes_encerradas',
    'votacao_aberta',
    'votacao_encerrada',
    'apuracao',
    'resultado_publicado',
    'arquivada'
  )),
  constraint melhores_edicoes_periodos_check check(
    (indicacoes_inicio is null or indicacoes_fim is null or indicacoes_inicio < indicacoes_fim)
    and (votacao_inicio is null or votacao_fim is null or votacao_inicio < votacao_fim)
  ),
  constraint melhores_edicoes_pesos_validos_check check(
    peso_site >= 0 and peso_site <= 100
    and peso_instagram >= 0 and peso_instagram <= 100
    and (peso_site + peso_instagram) = 100
  )
);

create unique index if not exists melhores_edicoes_id_ano_uidx
  on public.melhores_edicoes(id, ano);
create index if not exists melhores_edicoes_status_idx
  on public.melhores_edicoes(status, ano desc);

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_categorias(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao text,
  imagem_url text,
  icone text,
  ordem integer not null default 0,
  status text not null default 'ativo',
  limite_indicados integer,
  permite_indicacao_publica boolean not null default true,
  permite_multiplos_votos boolean not null default false,
  max_escolhas integer not null default 1,
  criterios_especificos text,
  regra_desempate text,
  visibilidade_publica boolean not null default true,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_categorias_slug_por_edicao unique(edicao_id, slug),
  constraint melhores_categorias_status_check check(status in('ativo','inativo','arquivado')),
  constraint melhores_categorias_limites_check check(
    (limite_indicados is null or limite_indicados > 0)
    and max_escolhas > 0
  )
);

create unique index if not exists melhores_categorias_id_edicao_uidx
  on public.melhores_categorias(id, edicao_id);
create index if not exists melhores_categorias_edicao_ordem_idx
  on public.melhores_categorias(edicao_id, ordem, nome);

-- ---------------------------------------------------------------------------
-- Indicados
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_indicados(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  categoria_id uuid not null,
  guia_comercial_id uuid references public.guia_comercial(id) on delete set null,
  nome text not null,
  slug text not null,
  imagem_url text,
  descricao_curta text,
  descricao_completa text,
  instagram text,
  whatsapp text,
  site text,
  endereco text,
  status text not null default 'rascunho',
  ordem integer not null default 0,
  aprovado boolean not null default false,
  motivo_reprovacao text,
  consentimento boolean not null default false,
  observacao_interna text,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_indicados_categoria_mesma_edicao_fk
    foreign key(categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id)
    on delete cascade,
  constraint melhores_indicados_slug_por_categoria unique(categoria_id, slug),
  constraint melhores_indicados_status_check check(status in('rascunho','ativo','inativo','reprovado','arquivado'))
);

create unique index if not exists melhores_indicados_nome_categoria_uidx
  on public.melhores_indicados(categoria_id, lower(nome));
create unique index if not exists melhores_indicados_id_categoria_edicao_uidx
  on public.melhores_indicados(id, categoria_id, edicao_id);
create unique index if not exists melhores_indicados_id_edicao_uidx
  on public.melhores_indicados(id, edicao_id);
create index if not exists melhores_indicados_edicao_categoria_idx
  on public.melhores_indicados(edicao_id, categoria_id, ordem, nome);

-- ---------------------------------------------------------------------------
-- Indicacoes publicas: base criada agora, uso publico fica para fase 2.
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_indicacoes(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  categoria_id uuid not null,
  nome_indicado text not null,
  justificativa text,
  contato_indicado text,
  nome_responsavel text,
  contato_responsavel text,
  aceite_regulamento boolean not null default false,
  status text not null default 'pendente',
  indicado_gerado_id uuid,
  moderado_por uuid references auth.users(id) on delete set null,
  moderado_em timestamptz,
  observacao_interna text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_indicacoes_categoria_mesma_edicao_fk
    foreign key(categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id)
    on delete cascade,
  constraint melhores_indicacoes_indicado_gerado_mesma_edicao_fk
    foreign key(indicado_gerado_id, edicao_id)
    references public.melhores_indicados(id, edicao_id)
    on delete restrict,
  constraint melhores_indicacoes_status_check check(status in('pendente','aprovada','rejeitada','convertida','duplicada','spam'))
);

create index if not exists melhores_indicacoes_fila_idx
  on public.melhores_indicacoes(status, criado_em desc);

-- ---------------------------------------------------------------------------
-- Votos individuais: base segura para fase 2.
-- Os registros individuais sao removidos apos 7 dias do encerramento/publicacao.
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_votos(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  categoria_id uuid not null,
  indicado_id uuid not null,
  identificador_hash text not null,
  user_agent_hash text,
  origem text not null default 'site',
  status text not null default 'valido',
  motivo_bloqueio text,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  constraint melhores_votos_categoria_mesma_edicao_fk
    foreign key(categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id)
    on delete cascade,
  constraint melhores_votos_indicado_mesma_categoria_fk
    foreign key(indicado_id, categoria_id, edicao_id)
    references public.melhores_indicados(id, categoria_id, edicao_id)
    on delete cascade,
  constraint melhores_votos_origem_check check(origem in('site','admin_teste','importacao')),
  constraint melhores_votos_status_check check(status in('valido','suspeito','bloqueado','anulado'))
);

create index if not exists melhores_votos_edicao_categoria_idx
  on public.melhores_votos(edicao_id, categoria_id, criado_em desc);
create index if not exists melhores_votos_indicado_idx
  on public.melhores_votos(indicado_id, status);
create index if not exists melhores_votos_identificador_idx
  on public.melhores_votos(edicao_id, categoria_id, identificador_hash, criado_em desc);

-- Um voto valido por categoria por identificador quando a categoria nao permite multiplas escolhas.
create unique index if not exists melhores_votos_um_valido_por_categoria_uidx
  on public.melhores_votos(edicao_id, categoria_id, identificador_hash)
  where status='valido';

-- ---------------------------------------------------------------------------
-- Consolidado permanente da edicao.
-- Mantem estatisticas apos a limpeza dos votos individuais.
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_consolidados(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  categoria_id uuid,
  indicado_id uuid,
  tipo text not null,
  total_votos integer not null default 0,
  votos_validos integer not null default 0,
  votos_suspeitos integer not null default 0,
  votos_bloqueados integer not null default 0,
  percentual numeric(9,4),
  estatisticas jsonb not null default '{}'::jsonb,
  consolidado_em timestamptz not null default now(),
  constraint melhores_consolidados_categoria_mesma_edicao_fk
    foreign key(categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id)
    on delete cascade,
  constraint melhores_consolidados_indicado_mesma_edicao_fk
    foreign key(indicado_id, edicao_id)
    references public.melhores_indicados(id, edicao_id)
    on delete cascade,
  constraint melhores_consolidados_tipo_check check(tipo in('edicao','categoria','indicado','dia','origem','dispositivo'))
);

create unique index if not exists melhores_consolidados_chave_uidx
  on public.melhores_consolidados(edicao_id, coalesce(categoria_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(indicado_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo);

-- ---------------------------------------------------------------------------
-- Resultados oficiais: snapshot historico publicado, nao recalculado.
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_resultados(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid not null references public.melhores_edicoes(id) on delete cascade,
  categoria_id uuid not null,
  indicado_id uuid not null,
  votos_site integer not null default 0,
  percentual_site numeric(9,4) not null default 0,
  votos_instagram integer not null default 0,
  percentual_instagram numeric(9,4) not null default 0,
  peso_site numeric(5,2) not null,
  peso_instagram numeric(5,2) not null,
  pontuacao_final numeric(12,6) not null default 0,
  colocacao integer not null,
  vencedor boolean not null default false,
  selo text,
  empate boolean not null default false,
  criterio_aplicado text,
  metodologia_resumida text,
  publicado boolean not null default false,
  publicado_por uuid references auth.users(id) on delete set null,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint melhores_resultados_categoria_mesma_edicao_fk
    foreign key(categoria_id, edicao_id)
    references public.melhores_categorias(id, edicao_id)
    on delete cascade,
  constraint melhores_resultados_indicado_mesma_categoria_fk
    foreign key(indicado_id, categoria_id, edicao_id)
    references public.melhores_indicados(id, categoria_id, edicao_id)
    on delete cascade,
  constraint melhores_resultados_unico_por_indicado unique(edicao_id, categoria_id, indicado_id),
  constraint melhores_resultados_colocacao_check check(colocacao > 0),
  constraint melhores_resultados_pesos_check check(
    peso_site >= 0 and peso_site <= 100
    and peso_instagram >= 0 and peso_instagram <= 100
    and (peso_site + peso_instagram) = 100
  )
);

create index if not exists melhores_resultados_publicos_idx
  on public.melhores_resultados(edicao_id, categoria_id, colocacao)
  where publicado = true;

-- ---------------------------------------------------------------------------
-- Auditoria propria do modulo.
-- ---------------------------------------------------------------------------
create table if not exists public.melhores_auditoria(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid references public.melhores_edicoes(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  valores_anteriores jsonb,
  valores_posteriores jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists melhores_auditoria_edicao_idx
  on public.melhores_auditoria(edicao_id, criado_em desc);
create index if not exists melhores_auditoria_entidade_idx
  on public.melhores_auditoria(entidade, entidade_id, criado_em desc);

-- ---------------------------------------------------------------------------
-- Triggers de atualizado_em e autoria.
-- ---------------------------------------------------------------------------
drop trigger if exists melhores_edicoes_atualizado on public.melhores_edicoes;
create trigger melhores_edicoes_atualizado before update on public.melhores_edicoes
for each row execute function public.set_atualizado_em();

drop trigger if exists melhores_categorias_atualizado on public.melhores_categorias;
create trigger melhores_categorias_atualizado before update on public.melhores_categorias
for each row execute function public.set_atualizado_em();

drop trigger if exists melhores_indicados_atualizado on public.melhores_indicados;
create trigger melhores_indicados_atualizado before update on public.melhores_indicados
for each row execute function public.set_atualizado_em();

drop trigger if exists melhores_indicacoes_atualizado on public.melhores_indicacoes;
create trigger melhores_indicacoes_atualizado before update on public.melhores_indicacoes
for each row execute function public.set_atualizado_em();

drop trigger if exists melhores_resultados_atualizado on public.melhores_resultados;
create trigger melhores_resultados_atualizado before update on public.melhores_resultados
for each row execute function public.set_atualizado_em();

create or replace function public.melhores_marcar_autoria()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    new.criado_por := coalesce(new.criado_por, (select auth.uid()));
  end if;
  if tg_op in('INSERT','UPDATE') then
    new.atualizado_por := (select auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists melhores_edicoes_autoria on public.melhores_edicoes;
create trigger melhores_edicoes_autoria before insert or update on public.melhores_edicoes
for each row execute function public.melhores_marcar_autoria();

drop trigger if exists melhores_categorias_autoria on public.melhores_categorias;
create trigger melhores_categorias_autoria before insert or update on public.melhores_categorias
for each row execute function public.melhores_marcar_autoria();

drop trigger if exists melhores_indicados_autoria on public.melhores_indicados;
create trigger melhores_indicados_autoria before insert or update on public.melhores_indicados
for each row execute function public.melhores_marcar_autoria();

-- ---------------------------------------------------------------------------
-- Auditoria automatica com valores anteriores e posteriores.
-- ---------------------------------------------------------------------------
create or replace function public.melhores_registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao uuid;
  v_entidade_id uuid;
  v_antes jsonb;
  v_depois jsonb;
begin
  v_antes := case when tg_op in('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_depois := case when tg_op in('INSERT','UPDATE') then to_jsonb(new) else null end;

  v_edicao := coalesce(
    nullif(v_depois->>'edicao_id','')::uuid,
    nullif(v_antes->>'edicao_id','')::uuid,
    nullif(v_depois->>'id','')::uuid,
    nullif(v_antes->>'id','')::uuid
  );
  if tg_table_name='melhores_edicoes' then
    v_edicao := coalesce(
      nullif(v_depois->>'id','')::uuid,
      nullif(v_antes->>'id','')::uuid
    );
  end if;
  v_entidade_id := coalesce(
    nullif(v_depois->>'id','')::uuid,
    nullif(v_antes->>'id','')::uuid
  );

  insert into public.melhores_auditoria(
    edicao_id,
    usuario_id,
    acao,
    entidade,
    entidade_id,
    valores_anteriores,
    valores_posteriores
  ) values(
    v_edicao,
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    v_entidade_id,
    v_antes,
    v_depois
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists melhores_edicoes_auditoria on public.melhores_edicoes;
create trigger melhores_edicoes_auditoria after insert or update or delete on public.melhores_edicoes
for each row execute function public.melhores_registrar_auditoria();

drop trigger if exists melhores_categorias_auditoria on public.melhores_categorias;
create trigger melhores_categorias_auditoria after insert or update or delete on public.melhores_categorias
for each row execute function public.melhores_registrar_auditoria();

drop trigger if exists melhores_indicados_auditoria on public.melhores_indicados;
create trigger melhores_indicados_auditoria after insert or update or delete on public.melhores_indicados
for each row execute function public.melhores_registrar_auditoria();

drop trigger if exists melhores_resultados_auditoria on public.melhores_resultados;
create trigger melhores_resultados_auditoria after insert or update or delete on public.melhores_resultados
for each row execute function public.melhores_registrar_auditoria();

-- ---------------------------------------------------------------------------
-- Consolidacao e limpeza dos votos individuais apos 7 dias.
-- ---------------------------------------------------------------------------
create or replace function public.melhores_consolidar_edicao(p_edicao uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.melhores_consolidados where edicao_id=p_edicao;

  insert into public.melhores_consolidados(edicao_id, tipo, total_votos, votos_validos, votos_suspeitos, votos_bloqueados, estatisticas)
  select
    p_edicao,
    'edicao',
    count(*)::int,
    count(*) filter(where status='valido')::int,
    count(*) filter(where status='suspeito')::int,
    count(*) filter(where status='bloqueado')::int,
    jsonb_build_object('consolidado_em', now())
  from public.melhores_votos
  where edicao_id=p_edicao;

  insert into public.melhores_consolidados(edicao_id, categoria_id, tipo, total_votos, votos_validos, votos_suspeitos, votos_bloqueados)
  select
    edicao_id,
    categoria_id,
    'categoria',
    count(*)::int,
    count(*) filter(where status='valido')::int,
    count(*) filter(where status='suspeito')::int,
    count(*) filter(where status='bloqueado')::int
  from public.melhores_votos
  where edicao_id=p_edicao
  group by edicao_id, categoria_id;

  insert into public.melhores_consolidados(edicao_id, categoria_id, indicado_id, tipo, total_votos, votos_validos, votos_suspeitos, votos_bloqueados, percentual)
  with base as(
    select edicao_id, categoria_id, indicado_id,
      count(*)::int as total_votos,
      count(*) filter(where status='valido')::int as votos_validos,
      count(*) filter(where status='suspeito')::int as votos_suspeitos,
      count(*) filter(where status='bloqueado')::int as votos_bloqueados
    from public.melhores_votos
    where edicao_id=p_edicao
    group by edicao_id, categoria_id, indicado_id
  ), totais as(
    select categoria_id, sum(votos_validos)::numeric as total_validos
    from base
    group by categoria_id
  )
  select
    b.edicao_id,
    b.categoria_id,
    b.indicado_id,
    'indicado',
    b.total_votos,
    b.votos_validos,
    b.votos_suspeitos,
    b.votos_bloqueados,
    case when t.total_validos > 0 then round((b.votos_validos::numeric / t.total_validos) * 100, 4) else 0 end
  from base b
  join totais t on t.categoria_id=b.categoria_id;
end;
$$;

create or replace function public.melhores_limpar_votos_expirados()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao record;
  v_total integer := 0;
  v_removidos integer := 0;
begin
  for v_edicao in
    select *
    from public.melhores_edicoes
    where status in('resultado_publicado','arquivada')
      and votos_individuais_removidos_em is null
      and coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em) is not null
      and now() >= coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em) + votos_individuais_remover_apos
  loop
    perform public.melhores_consolidar_edicao(v_edicao.id);

    delete from public.melhores_votos where edicao_id=v_edicao.id;
    get diagnostics v_removidos = row_count;
    v_total := v_total + v_removidos;

    update public.melhores_edicoes
    set votos_individuais_removidos_em=now()
    where id=v_edicao.id;

    insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
    values(v_edicao.id, null, 'limpeza_votos', 'melhores_votos', v_edicao.id,
      jsonb_build_object('votos_removidos', v_removidos, 'limpo_em', now()));
  end loop;
  return v_total;
end;
$$;

revoke all on function public.melhores_consolidar_edicao(uuid) from public;
revoke all on function public.melhores_limpar_votos_expirados() from public;

-- Agenda automatica quando pg_cron estiver disponivel.
-- Se a extensao nao estiver habilitada no projeto, a funcao acima continua
-- disponivel para agendamento manual pelo painel/rotina do Supabase.
do $$
begin
  begin
    create extension if not exists pg_cron with schema extensions;
  exception when others then
    raise notice 'pg_cron nao foi habilitado automaticamente: %', sqlerrm;
  end;

  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='cron' and p.proname='schedule') then
    if exists(select 1 from cron.job where jobname='melhores-limpeza-votos-expirados') then
      perform cron.unschedule('melhores-limpeza-votos-expirados');
    end if;
    perform cron.schedule(
      'melhores-limpeza-votos-expirados',
      '17 3 * * *',
      'select public.melhores_limpar_votos_expirados();'
    );
  end if;
exception when others then
  raise notice 'Agendamento automatico da limpeza nao foi criado: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.melhores_edicoes enable row level security;
alter table public.melhores_categorias enable row level security;
alter table public.melhores_indicados enable row level security;
alter table public.melhores_indicacoes enable row level security;
alter table public.melhores_votos enable row level security;
alter table public.melhores_consolidados enable row level security;
alter table public.melhores_resultados enable row level security;
alter table public.melhores_auditoria enable row level security;

drop policy if exists "melhores_edicoes_select" on public.melhores_edicoes;
create policy "melhores_edicoes_select" on public.melhores_edicoes
for select to anon, authenticated using(
  public.tem_permissao_admin('melhores','ler')
  or status in('indicacoes_abertas','votacao_aberta','votacao_encerrada','resultado_publicado','arquivada')
);
drop policy if exists "melhores_edicoes_insert" on public.melhores_edicoes;
create policy "melhores_edicoes_insert" on public.melhores_edicoes
for insert to authenticated with check(public.tem_permissao_admin('melhores','criar'));
drop policy if exists "melhores_edicoes_update" on public.melhores_edicoes;
create policy "melhores_edicoes_update" on public.melhores_edicoes
for update to authenticated using(public.tem_permissao_admin('melhores','editar')) with check(public.tem_permissao_admin('melhores','editar'));
drop policy if exists "melhores_edicoes_delete" on public.melhores_edicoes;
create policy "melhores_edicoes_delete" on public.melhores_edicoes
for delete to authenticated using(public.tem_permissao_admin('melhores','excluir'));

drop policy if exists "melhores_categorias_select" on public.melhores_categorias;
create policy "melhores_categorias_select" on public.melhores_categorias
for select to anon, authenticated using(
  public.tem_permissao_admin('melhores','ler')
  or (
    status='ativo'
    and visibilidade_publica=true
    and exists(select 1 from public.melhores_edicoes e where e.id=edicao_id and e.status in('indicacoes_abertas','votacao_aberta','votacao_encerrada','resultado_publicado','arquivada'))
  )
);
drop policy if exists "melhores_categorias_insert" on public.melhores_categorias;
create policy "melhores_categorias_insert" on public.melhores_categorias
for insert to authenticated with check(public.tem_permissao_admin('melhores','criar'));
drop policy if exists "melhores_categorias_update" on public.melhores_categorias;
create policy "melhores_categorias_update" on public.melhores_categorias
for update to authenticated using(public.tem_permissao_admin('melhores','editar')) with check(public.tem_permissao_admin('melhores','editar'));
drop policy if exists "melhores_categorias_delete" on public.melhores_categorias;
create policy "melhores_categorias_delete" on public.melhores_categorias
for delete to authenticated using(public.tem_permissao_admin('melhores','excluir'));

drop policy if exists "melhores_indicados_select" on public.melhores_indicados;
create policy "melhores_indicados_select" on public.melhores_indicados
for select to anon, authenticated using(
  public.tem_permissao_admin('melhores','ler')
  or (
    status='ativo'
    and aprovado=true
    and exists(select 1 from public.melhores_edicoes e where e.id=edicao_id and e.status in('votacao_aberta','votacao_encerrada','resultado_publicado','arquivada'))
  )
);
drop policy if exists "melhores_indicados_insert" on public.melhores_indicados;
create policy "melhores_indicados_insert" on public.melhores_indicados
for insert to authenticated with check(public.tem_permissao_admin('melhores','criar'));
drop policy if exists "melhores_indicados_update" on public.melhores_indicados;
create policy "melhores_indicados_update" on public.melhores_indicados
for update to authenticated using(public.tem_permissao_admin('melhores','editar')) with check(public.tem_permissao_admin('melhores','editar'));
drop policy if exists "melhores_indicados_delete" on public.melhores_indicados;
create policy "melhores_indicados_delete" on public.melhores_indicados
for delete to authenticated using(public.tem_permissao_admin('melhores','excluir'));

drop policy if exists "melhores_indicacoes_select" on public.melhores_indicacoes;
create policy "melhores_indicacoes_select" on public.melhores_indicacoes
for select to authenticated using(public.tem_permissao_admin('melhores','ler'));
drop policy if exists "melhores_indicacoes_write" on public.melhores_indicacoes;
create policy "melhores_indicacoes_write" on public.melhores_indicacoes
for all to authenticated using(public.tem_permissao_admin('melhores','editar')) with check(public.tem_permissao_admin('melhores','editar'));

drop policy if exists "melhores_votos_admin_select" on public.melhores_votos;
create policy "melhores_votos_admin_select" on public.melhores_votos
for select to authenticated using(public.tem_permissao_admin('melhores','ler'));
-- Sem INSERT anonimo nesta fase. Na fase 2, votos serao gravados por API/RPC segura.

drop policy if exists "melhores_consolidados_select" on public.melhores_consolidados;
create policy "melhores_consolidados_select" on public.melhores_consolidados
for select to anon, authenticated using(
  public.tem_permissao_admin('melhores','ler')
  or exists(select 1 from public.melhores_edicoes e where e.id=edicao_id and e.status in('resultado_publicado','arquivada'))
);

drop policy if exists "melhores_resultados_select" on public.melhores_resultados;
create policy "melhores_resultados_select" on public.melhores_resultados
for select to anon, authenticated using(
  public.tem_permissao_admin('melhores','ler')
  or publicado=true
);
drop policy if exists "melhores_resultados_write" on public.melhores_resultados;
create policy "melhores_resultados_write" on public.melhores_resultados
for all to authenticated using(public.tem_permissao_admin('melhores','editar')) with check(public.tem_permissao_admin('melhores','editar'));

drop policy if exists "melhores_auditoria_select" on public.melhores_auditoria;
create policy "melhores_auditoria_select" on public.melhores_auditoria
for select to authenticated using(public.tem_permissao_admin('melhores','ler'));

commit;
