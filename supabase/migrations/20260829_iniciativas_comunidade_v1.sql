-- Iniciativas da Comunidade — V1.
-- Migration preparada para revisão manual. Não executa nenhuma carga de dados.

create table if not exists public.iniciativas_comunitarias (
  id uuid primary key default gen_random_uuid(),
  iniciativa_pai_id uuid references public.iniciativas_comunitarias(id) on delete set null,
  tipo text not null check (tipo in ('projeto', 'acao')),
  titulo text not null check (char_length(btrim(titulo)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  resumo text,
  descricao text,
  imagem_capa_url text,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'encerrado', 'arquivado')),
  destaque boolean not null default false,
  exibir_na_listagem boolean not null default true,
  inicio_em timestamptz,
  termina_em timestamptz,
  responsavel_nome text,
  telefone text,
  whatsapp text,
  email text,
  instagram text,
  site_url text,
  endereco text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint iniciativas_acao_periodo_check check (
    tipo = 'projeto' or termina_em is null or inicio_em is null or termina_em >= inicio_em
  ),
  constraint iniciativas_coordenadas_check check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table if not exists public.iniciativas_formas_ajuda (
  id uuid primary key default gen_random_uuid(),
  iniciativa_id uuid not null references public.iniciativas_comunitarias(id) on delete cascade,
  tipo text not null check (tipo in ('pix', 'whatsapp', 'telefone', 'site', 'voluntariado', 'materiais', 'outro')),
  titulo text not null check (char_length(btrim(titulo)) > 0),
  descricao text,
  valor_publico text,
  recebedor_nome text,
  ordem integer not null default 100,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint iniciativas_pix_recebedor_check check (tipo <> 'pix' or char_length(btrim(coalesce(recebedor_nome, ''))) > 0),
  constraint iniciativas_pix_valor_check check (tipo <> 'pix' or char_length(btrim(coalesce(valor_publico, ''))) > 0)
);

create index if not exists iniciativas_publicadas_listagem_idx
  on public.iniciativas_comunitarias (destaque desc, atualizado_em desc)
  where status = 'publicado' and exibir_na_listagem = true;
create index if not exists iniciativas_pai_idx on public.iniciativas_comunitarias (iniciativa_pai_id, status, atualizado_em desc);
create index if not exists iniciativas_formas_ajuda_idx on public.iniciativas_formas_ajuda (iniciativa_id, ativo, ordem);

alter table public.iniciativas_comunitarias enable row level security;
alter table public.iniciativas_formas_ajuda enable row level security;

grant select on public.iniciativas_comunitarias, public.iniciativas_formas_ajuda to anon, authenticated;
grant insert, update, delete on public.iniciativas_comunitarias, public.iniciativas_formas_ajuda to authenticated;

create policy iniciativas_public_read on public.iniciativas_comunitarias for select to anon, authenticated using (status = 'publicado');
create policy iniciativas_ajuda_public_read on public.iniciativas_formas_ajuda for select to anon, authenticated using (ativo and exists (select 1 from public.iniciativas_comunitarias i where i.id = iniciativa_id and i.status = 'publicado'));

create policy iniciativas_admin_all on public.iniciativas_comunitarias for all to authenticated using (public.tem_permissao_admin('configuracoes', 'editar')) with check (public.tem_permissao_admin('configuracoes', 'editar'));
create policy iniciativas_ajuda_admin_all on public.iniciativas_formas_ajuda for all to authenticated using (public.tem_permissao_admin('configuracoes', 'editar')) with check (public.tem_permissao_admin('configuracoes', 'editar'));
