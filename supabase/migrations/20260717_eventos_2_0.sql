-- Eventos 2.0 — acervo permanente de eventos tradicionais e edições anuais
-- Execute este arquivo no SQL Editor do Supabase antes de usar as novas telas.

create table if not exists public.eventos_principais (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  descricao_curta text,
  historia_html text,
  imagem_capa_url text,
  galeria_historica jsonb not null default '[]'::jsonb,
  categoria text,
  local_tradicional text,
  recorrencia text not null default 'anual' check (recorrencia in ('anual','mensal','unico','outro')),
  periodo_aproximado text,
  organizador text,
  telefone text,
  email text,
  website text,
  instagram text,
  facebook text,
  ativo boolean not null default true,
  destaque boolean not null default false,
  seo_titulo text,
  seo_descricao text,
  palavras_chave text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.eventos_edicoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_principais(id) on delete cascade,
  ano integer not null check (ano between 1900 and 2200),
  slug text,
  titulo text not null,
  subtitulo text,
  data_inicio timestamptz,
  data_fim timestamptz,
  programacao_html text,
  atracoes_html text,
  cartaz_url text,
  banner_url text,
  galeria jsonb not null default '[]'::jsonb,
  videos jsonb not null default '[]'::jsonb,
  local text,
  mapa_url text,
  links_uteis jsonb not null default '[]'::jsonb,
  patrocinadores jsonb not null default '[]'::jsonb,
  status text not null default 'anunciado' check (status in ('anunciado','confirmado','acontecendo','encerrado','cancelado')),
  resumo_pos_evento_html text,
  publico_estimado integer check (publico_estimado is null or publico_estimado >= 0),
  observacoes text,
  destaque boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (evento_id, ano),
  unique (evento_id, slug)
);

create table if not exists public.eventos_noticias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.eventos_principais(id) on delete cascade,
  edicao_id uuid references public.eventos_edicoes(id) on delete cascade,
  noticia_id uuid not null references public.noticias(id) on delete cascade,
  criado_em timestamptz not null default now(),
  constraint eventos_noticias_alvo_check check (evento_id is not null or edicao_id is not null),
  unique (evento_id, noticia_id),
  unique (edicao_id, noticia_id)
);

create index if not exists idx_eventos_principais_ativo_destaque on public.eventos_principais (ativo, destaque, atualizado_em desc);
create index if not exists idx_eventos_principais_categoria on public.eventos_principais (categoria);
create index if not exists idx_eventos_edicoes_evento_ano on public.eventos_edicoes (evento_id, ano desc);
create index if not exists idx_eventos_edicoes_status_datas on public.eventos_edicoes (status, data_inicio desc);
create index if not exists idx_eventos_noticias_evento on public.eventos_noticias (evento_id);
create index if not exists idx_eventos_noticias_edicao on public.eventos_noticias (edicao_id);

drop trigger if exists set_eventos_principais_atualizado_em on public.eventos_principais;
create trigger set_eventos_principais_atualizado_em
before update on public.eventos_principais
for each row execute function public.set_atualizado_em();

drop trigger if exists set_eventos_edicoes_atualizado_em on public.eventos_edicoes;
create trigger set_eventos_edicoes_atualizado_em
before update on public.eventos_edicoes
for each row execute function public.set_atualizado_em();

alter table public.eventos_principais enable row level security;
alter table public.eventos_edicoes enable row level security;
alter table public.eventos_noticias enable row level security;

drop policy if exists "eventos_principais_public_select" on public.eventos_principais;
create policy "eventos_principais_public_select"
on public.eventos_principais for select
using (ativo = true);

drop policy if exists "eventos_edicoes_public_select" on public.eventos_edicoes;
create policy "eventos_edicoes_public_select"
on public.eventos_edicoes for select
using (
  exists (
    select 1 from public.eventos_principais ep
    where ep.id = eventos_edicoes.evento_id and ep.ativo = true
  )
);

drop policy if exists "eventos_noticias_public_select" on public.eventos_noticias;
create policy "eventos_noticias_public_select"
on public.eventos_noticias for select
using (
  exists (
    select 1 from public.noticias n
    where n.id = eventos_noticias.noticia_id
      and n.status = 'publicado'
      and (n.publicado_em is null or n.publicado_em <= now())
  )
);

drop policy if exists "eventos_principais_admin_all" on public.eventos_principais;
create policy "eventos_principais_admin_all"
on public.eventos_principais for all
using (public.tem_permissao_admin('eventos','ler'))
with check (public.tem_permissao_admin('eventos','editar') or public.tem_permissao_admin('eventos','criar'));

drop policy if exists "eventos_edicoes_admin_all" on public.eventos_edicoes;
create policy "eventos_edicoes_admin_all"
on public.eventos_edicoes for all
using (public.tem_permissao_admin('eventos','ler'))
with check (public.tem_permissao_admin('eventos','editar') or public.tem_permissao_admin('eventos','criar'));

drop policy if exists "eventos_noticias_admin_all" on public.eventos_noticias;
create policy "eventos_noticias_admin_all"
on public.eventos_noticias for all
using (public.tem_permissao_admin('eventos','ler'))
with check (public.tem_permissao_admin('eventos','editar') or public.tem_permissao_admin('eventos','criar'));
