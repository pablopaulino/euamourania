-- Eu Amo Urania - Viva Urania - Exibicao do Melhores no aplicativo
-- NAO EXECUTAR automaticamente. Revisar e aplicar manualmente no SQL Editor do Supabase.
--
-- Decisao tecnica:
-- - O resultado oficial continua nas tabelas melhores_*.
-- - Esta migracao cria apenas uma camada minima de publicacao mobile:
--   periodo de exibicao, textos do banner, flags de selo/bloco e snapshots
--   dos vencedores exibidos no app.
-- - Os snapshots evitam que um vencedor desapareca se o cadastro do Guia for
--   arquivado, removido ou alterado apos a premiacao.

begin;

insert into public.admin_permissoes_funcao(funcao, modulo, acao) values
  ('administrador','melhores','importar_app'),
  ('administrador','melhores','publicar_app')
on conflict do nothing;

create table if not exists public.app_melhores_campanhas(
  id uuid primary key default gen_random_uuid(),
  edicao_id uuid references public.melhores_edicoes(id) on delete restrict,
  titulo text not null default 'Melhores de Urânia 2026',
  subtitulo text default 'Conheça os vencedores da primeira edição.',
  texto_botao text not null default 'Ver vencedores',
  link_oficial text,
  status text not null default 'rascunho',
  ativo boolean not null default false,
  exibir_inicio timestamptz,
  exibir_fim timestamptz,
  ordem_home integer not null default 0,
  exibir_selo_cards boolean not null default true,
  exibir_bloco_empresa boolean not null default true,
  exibir_avulsos boolean not null default true,
  observacao_interna text,
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint app_melhores_campanhas_status_check check(status in('rascunho','agendada','ativa','inativa','encerrada','arquivada')),
  constraint app_melhores_campanhas_periodo_check check(
    exibir_inicio is null
    or exibir_fim is null
    or exibir_inicio < exibir_fim
  ),
  constraint app_melhores_campanhas_ativo_status_check check(
    ativo = false or status in('agendada','ativa')
  )
);

create table if not exists public.app_melhores_vencedores(
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.app_melhores_campanhas(id) on delete cascade,
  resultado_id uuid references public.melhores_resultados(id) on delete set null,
  categoria_id uuid not null references public.melhores_categorias(id) on delete restrict,
  indicado_id uuid references public.melhores_indicados(id) on delete set null,
  guia_comercial_id uuid references public.guia_comercial(id) on delete set null,
  categoria_nome text not null,
  nome_exibido text not null,
  imagem_url text,
  descricao_curta text,
  selo text not null default 'Vencedor 2026',
  ordem integer not null default 0,
  instagram text,
  whatsapp text,
  site text,
  endereco text,
  status text not null default 'ativo',
  origem text not null default 'resultado_oficial',
  alertas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint app_melhores_vencedores_status_check check(status in('ativo','oculto','arquivado')),
  constraint app_melhores_vencedores_origem_check check(origem in('resultado_oficial','manual','ajuste_admin'))
);

alter table public.app_melhores_vencedores
  drop constraint if exists app_melhores_vencedores_categoria_unica;
alter table public.app_melhores_vencedores
  add constraint app_melhores_vencedores_categoria_unica unique(campanha_id, categoria_id);

alter table public.app_melhores_vencedores
  drop constraint if exists app_melhores_vencedores_resultado_unico;
alter table public.app_melhores_vencedores
  add constraint app_melhores_vencedores_resultado_unico unique(campanha_id, resultado_id);

create index if not exists app_melhores_campanhas_publicas_idx
  on public.app_melhores_campanhas(ativo, exibir_inicio, exibir_fim, ordem_home)
  where status in('agendada','ativa');

create index if not exists app_melhores_campanhas_edicao_idx
  on public.app_melhores_campanhas(edicao_id);

create index if not exists app_melhores_vencedores_campanha_idx
  on public.app_melhores_vencedores(campanha_id, status, ordem);

create index if not exists app_melhores_vencedores_guia_idx
  on public.app_melhores_vencedores(guia_comercial_id)
  where guia_comercial_id is not null;

drop trigger if exists app_melhores_campanhas_atualizado on public.app_melhores_campanhas;
create trigger app_melhores_campanhas_atualizado before update on public.app_melhores_campanhas
for each row execute function public.set_atualizado_em();

drop trigger if exists app_melhores_vencedores_atualizado on public.app_melhores_vencedores;
create trigger app_melhores_vencedores_atualizado before update on public.app_melhores_vencedores
for each row execute function public.set_atualizado_em();

create or replace function public.app_melhores_marcar_autoria()
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
  if tg_op='UPDATE' and new.status='arquivada' and old.status is distinct from 'arquivada' then
    new.ativo := false;
    new.arquivado_em := coalesce(new.arquivado_em, now());
  end if;
  if new.status in('inativa','encerrada') then
    new.ativo := false;
  end if;
  return new;
end;
$$;

drop trigger if exists app_melhores_campanhas_autoria on public.app_melhores_campanhas;
create trigger app_melhores_campanhas_autoria before insert or update on public.app_melhores_campanhas
for each row execute function public.app_melhores_marcar_autoria();

create or replace function public.app_melhores_validar_campanha()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_edicao record;
  v_vencedores integer;
  v_sem_categoria integer;
begin
  if new.ativo = false and new.status not in('ativa','agendada') then
    return new;
  end if;

  if new.edicao_id is null then
    raise exception 'Vincule uma edição antes de ativar a campanha do app.' using errcode='23514';
  end if;
  if new.exibir_inicio is null or new.exibir_fim is null or new.exibir_inicio >= new.exibir_fim then
    raise exception 'Defina início e término válidos para exibir no app.' using errcode='23514';
  end if;

  select id,status,resultado_publicado_em,divulgacao_em
  into v_edicao
  from public.melhores_edicoes
  where id=new.edicao_id;

  if v_edicao.id is null or v_edicao.status <> 'resultado_publicado' then
    raise exception 'A edição precisa ter resultado oficialmente publicado.' using errcode='23514';
  end if;

  select count(*) into v_vencedores
  from public.app_melhores_vencedores
  where campanha_id=new.id and status='ativo';

  if v_vencedores = 0 then
    raise exception 'Importe ou cadastre ao menos um vencedor antes de ativar.' using errcode='23514';
  end if;

  select count(*) into v_sem_categoria
  from public.app_melhores_vencedores
  where campanha_id=new.id and categoria_id is null and status='ativo';

  if v_sem_categoria > 0 then
    raise exception 'Há vencedor ativo sem categoria.' using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists app_melhores_campanhas_validar on public.app_melhores_campanhas;
create trigger app_melhores_campanhas_validar before insert or update on public.app_melhores_campanhas
for each row execute function public.app_melhores_validar_campanha();

drop trigger if exists app_melhores_campanhas_auditoria on public.app_melhores_campanhas;
create trigger app_melhores_campanhas_auditoria after insert or update or delete on public.app_melhores_campanhas
for each row execute function public.melhores_registrar_auditoria();

drop trigger if exists app_melhores_vencedores_auditoria on public.app_melhores_vencedores;
create trigger app_melhores_vencedores_auditoria after insert or update or delete on public.app_melhores_vencedores
for each row execute function public.melhores_registrar_auditoria();

create or replace function public.app_melhores_importar_vencedores(p_campanha uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_campanha record;
  v_total integer := 0;
begin
  if not (
    public.tem_permissao_admin('melhores','importar_app')
    or public.tem_permissao_admin('melhores','editar')
  ) then
    raise exception 'Sem permissão para importar vencedores para o app.' using errcode='42501';
  end if;

  select *
  into v_campanha
  from public.app_melhores_campanhas
  where id=p_campanha;

  if v_campanha.id is null or v_campanha.edicao_id is null then
    raise exception 'Campanha do app não encontrada ou sem edição vinculada.' using errcode='23514';
  end if;

  if not exists(
    select 1 from public.melhores_edicoes e
    where e.id=v_campanha.edicao_id
      and e.status='resultado_publicado'
      and e.resultado_publicado_em is not null
  ) then
    raise exception 'A edição ainda não tem resultado oficialmente publicado.' using errcode='23514';
  end if;

  insert into public.app_melhores_vencedores(
    campanha_id,
    resultado_id,
    categoria_id,
    indicado_id,
    guia_comercial_id,
    categoria_nome,
    nome_exibido,
    imagem_url,
    descricao_curta,
    selo,
    ordem,
    instagram,
    whatsapp,
    site,
    endereco,
    status,
    origem,
    alertas
  )
  select
    v_campanha.id,
    r.id,
    c.id,
    i.id,
    i.guia_comercial_id,
    c.nome,
    i.nome,
    coalesce(i.imagem_url, g.imagem_url),
    coalesce(i.descricao_curta, g.descricao),
    coalesce(r.selo, 'Vencedor ' || e.ano::text),
    c.ordem,
    coalesce(i.instagram, g.instagram),
    coalesce(i.whatsapp, g.whatsapp),
    coalesce(i.site, g.site),
    coalesce(i.endereco, g.endereco),
    'ativo',
    'resultado_oficial',
    jsonb_strip_nulls(jsonb_build_array(
      case when i.guia_comercial_id is null then 'sem_vinculo_guia' end,
      case when coalesce(i.imagem_url, g.imagem_url) is null then 'sem_imagem' end,
      case when coalesce(i.whatsapp, g.whatsapp, i.instagram, g.instagram, i.site, g.site) is null then 'sem_contato' end
    ))
  from public.melhores_resultados r
  join public.melhores_edicoes e on e.id=r.edicao_id
  join public.melhores_categorias c on c.id=r.categoria_id
  join public.melhores_indicados i on i.id=r.indicado_id
  left join public.guia_comercial g on g.id=i.guia_comercial_id
  where r.edicao_id=v_campanha.edicao_id
    and r.publicado=true
    and r.vencedor=true
    and r.colocacao=1
  on conflict(campanha_id, categoria_id) do update set
    resultado_id=excluded.resultado_id,
    indicado_id=excluded.indicado_id,
    guia_comercial_id=excluded.guia_comercial_id,
    categoria_nome=excluded.categoria_nome,
    nome_exibido=excluded.nome_exibido,
    imagem_url=excluded.imagem_url,
    descricao_curta=excluded.descricao_curta,
    selo=excluded.selo,
    ordem=excluded.ordem,
    instagram=excluded.instagram,
    whatsapp=excluded.whatsapp,
    site=excluded.site,
    endereco=excluded.endereco,
    status='ativo',
    origem='resultado_oficial',
    alertas=excluded.alertas,
    atualizado_em=now();

  get diagnostics v_total = row_count;

  insert into public.melhores_auditoria(edicao_id, usuario_id, acao, entidade, entidade_id, valores_posteriores)
  values(v_campanha.edicao_id, (select auth.uid()), 'importar_app', 'app_melhores_vencedores', v_campanha.id, jsonb_build_object('total', v_total));

  return v_total;
end;
$$;

revoke all on function public.app_melhores_importar_vencedores(uuid) from public;
grant execute on function public.app_melhores_importar_vencedores(uuid) to authenticated;

alter table public.app_melhores_campanhas enable row level security;
alter table public.app_melhores_vencedores enable row level security;

drop policy if exists "app_melhores_campanhas_publicas" on public.app_melhores_campanhas;
create policy "app_melhores_campanhas_publicas"
on public.app_melhores_campanhas
for select to anon, authenticated
using (
  ativo=true
  and status in('agendada','ativa')
  and exibir_inicio <= now()
  and exibir_fim >= now()
  and exists(
    select 1 from public.melhores_edicoes e
    where e.id=edicao_id and e.status='resultado_publicado'
  )
);

drop policy if exists "app_melhores_campanhas_admin_select" on public.app_melhores_campanhas;
create policy "app_melhores_campanhas_admin_select"
on public.app_melhores_campanhas
for select to authenticated
using(public.tem_permissao_admin('melhores','ler'));

drop policy if exists "app_melhores_campanhas_admin_insert" on public.app_melhores_campanhas;
create policy "app_melhores_campanhas_admin_insert"
on public.app_melhores_campanhas
for insert to authenticated
with check(public.tem_permissao_admin('melhores','criar'));

drop policy if exists "app_melhores_campanhas_admin_update" on public.app_melhores_campanhas;
create policy "app_melhores_campanhas_admin_update"
on public.app_melhores_campanhas
for update to authenticated
using(public.tem_permissao_admin('melhores','editar') or public.tem_permissao_admin('melhores','publicar_app'))
with check(public.tem_permissao_admin('melhores','editar') or public.tem_permissao_admin('melhores','publicar_app'));

drop policy if exists "app_melhores_campanhas_admin_delete" on public.app_melhores_campanhas;
create policy "app_melhores_campanhas_admin_delete"
on public.app_melhores_campanhas
for delete to authenticated
using(public.tem_permissao_admin('melhores','excluir'));

drop policy if exists "app_melhores_vencedores_publicos" on public.app_melhores_vencedores;
create policy "app_melhores_vencedores_publicos"
on public.app_melhores_vencedores
for select to anon, authenticated
using (
  status='ativo'
  and exists(
    select 1
    from public.app_melhores_campanhas c
    join public.melhores_edicoes e on e.id=c.edicao_id
    where c.id=campanha_id
      and c.ativo=true
      and c.status in('agendada','ativa')
      and c.exibir_inicio <= now()
      and c.exibir_fim >= now()
      and e.status='resultado_publicado'
      and (c.exibir_avulsos=true or guia_comercial_id is not null)
  )
);

drop policy if exists "app_melhores_vencedores_admin_select" on public.app_melhores_vencedores;
create policy "app_melhores_vencedores_admin_select"
on public.app_melhores_vencedores
for select to authenticated
using(public.tem_permissao_admin('melhores','ler'));

drop policy if exists "app_melhores_vencedores_admin_insert" on public.app_melhores_vencedores;
create policy "app_melhores_vencedores_admin_insert"
on public.app_melhores_vencedores
for insert to authenticated
with check(public.tem_permissao_admin('melhores','criar') or public.tem_permissao_admin('melhores','importar_app'));

drop policy if exists "app_melhores_vencedores_admin_update" on public.app_melhores_vencedores;
create policy "app_melhores_vencedores_admin_update"
on public.app_melhores_vencedores
for update to authenticated
using(public.tem_permissao_admin('melhores','editar') or public.tem_permissao_admin('melhores','importar_app'))
with check(public.tem_permissao_admin('melhores','editar') or public.tem_permissao_admin('melhores','importar_app'));

drop policy if exists "app_melhores_vencedores_admin_delete" on public.app_melhores_vencedores;
create policy "app_melhores_vencedores_admin_delete"
on public.app_melhores_vencedores
for delete to authenticated
using(public.tem_permissao_admin('melhores','excluir'));

commit;
