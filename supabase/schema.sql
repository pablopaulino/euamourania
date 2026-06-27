-- Eu Amo Urânia CMS — execute no SQL Editor do Supabase.
-- Usa apenas a chave publicável no navegador; a autorização real fica nestas policies.
create extension if not exists pgcrypto;

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  tipo text not null check (tipo in ('noticias','guia','turismo','eventos')),
  ordem integer not null default 0,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  criado_em timestamptz not null default now()
);

create table if not exists public.noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text unique not null,
  subtitulo text,
  resumo text,
  conteudo_html text not null default '',
  imagem_url text,
  legenda_imagem text,
  categoria_id uuid references public.categorias(id) on delete set null,
  categoria_nome text,
  autor text not null default 'Eu Amo Urânia',
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  destaque boolean not null default false,
  publicado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  seo_titulo text,
  seo_descricao text,
  seo_imagem text,
  visualizacoes integer not null default 0 check (visualizacoes >= 0)
);

create table if not exists public.guia_comercial (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  categoria_nome text,
  descricao text,
  imagem_url text,
  galeria_urls jsonb not null default '[]'::jsonb,
  whatsapp text,
  telefone text,
  instagram text,
  facebook text,
  site text,
  endereco text,
  horario text,
  mapa_url text,
  recomendado boolean not null default false,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  seo_titulo text,
  seo_descricao text,
  visualizacoes integer not null default 0 check (visualizacoes >= 0)
);

create table if not exists public.turismo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  descricao text,
  conteudo_html text,
  imagem_url text,
  galeria_urls jsonb not null default '[]'::jsonb,
  endereco text,
  horario text,
  whatsapp text,
  mapa_url text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  destaque boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  seo_titulo text,
  seo_descricao text
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  url text not null,
  icone text,
  ordem integer not null default 0,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  slug text unique not null,
  descricao text,
  imagem_url text,
  data_inicio timestamptz,
  data_fim timestamptz,
  local text,
  endereco text,
  organizador text,
  whatsapp text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  destaque boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  subtitulo text,
  imagem_url text,
  link_url text,
  posicao text,
  ordem integer not null default 0,
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.configuracoes_site (
  id uuid primary key default gen_random_uuid(),
  chave text unique not null,
  valor text,
  tipo text not null default 'texto',
  atualizado_em timestamptz not null default now()
);

create table if not exists public.usuarios_admin (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create or replace function public.set_atualizado_em()
returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end; $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.usuarios_admin where id = (select auth.uid()) and ativo = true);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace trigger noticias_atualizado before update on public.noticias for each row execute function public.set_atualizado_em();
create or replace trigger guia_atualizado before update on public.guia_comercial for each row execute function public.set_atualizado_em();
create or replace trigger turismo_atualizado before update on public.turismo for each row execute function public.set_atualizado_em();
create or replace trigger links_atualizado before update on public.links for each row execute function public.set_atualizado_em();
create or replace trigger eventos_atualizado before update on public.eventos for each row execute function public.set_atualizado_em();
create or replace trigger banners_atualizado before update on public.banners for each row execute function public.set_atualizado_em();
create or replace trigger configuracoes_atualizado before update on public.configuracoes_site for each row execute function public.set_atualizado_em();

create index if not exists noticias_publicacao_idx on public.noticias(status, publicado_em desc);
create index if not exists noticias_categoria_idx on public.noticias(categoria_nome, publicado_em desc);
create index if not exists guia_categoria_idx on public.guia_comercial(status, categoria_nome);
create index if not exists eventos_data_idx on public.eventos(status, data_inicio);
create index if not exists links_ordem_idx on public.links(status, ordem);

alter table public.noticias enable row level security;
alter table public.guia_comercial enable row level security;
alter table public.turismo enable row level security;
alter table public.links enable row level security;
alter table public.eventos enable row level security;
alter table public.banners enable row level security;
alter table public.categorias enable row level security;
alter table public.configuracoes_site enable row level security;
alter table public.usuarios_admin enable row level security;

create policy "noticias_publicadas_publicas" on public.noticias for select to anon, authenticated using (status = 'publicado' and (publicado_em is null or publicado_em <= now()) or public.is_admin());
create policy "guia_publicado_publico" on public.guia_comercial for select to anon, authenticated using (status = 'publicado' or public.is_admin());
create policy "turismo_publicado_publico" on public.turismo for select to anon, authenticated using (status = 'publicado' or public.is_admin());
create policy "links_ativos_publicos" on public.links for select to anon, authenticated using (status = 'ativo' or public.is_admin());
create policy "eventos_publicados_publicos" on public.eventos for select to anon, authenticated using (status = 'publicado' or public.is_admin());
create policy "banners_ativos_publicos" on public.banners for select to anon, authenticated using (status = 'ativo' or public.is_admin());
create policy "categorias_ativas_publicas" on public.categorias for select to anon, authenticated using (status = 'ativo' or public.is_admin());
create policy "configuracoes_publicas" on public.configuracoes_site for select to anon, authenticated using (true);
create policy "admin_visualiza_perfil" on public.usuarios_admin for select to authenticated using (id = (select auth.uid()) or public.is_admin());

create policy "admin_gerencia_noticias" on public.noticias for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_guia" on public.guia_comercial for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_turismo" on public.turismo for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_links" on public.links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_eventos" on public.eventos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_banners" on public.banners for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_categorias" on public.categorias for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_configuracoes" on public.configuracoes_site for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_gerencia_administradores" on public.usuarios_admin for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.configuracoes_site(chave, valor, tipo) values
  ('nome_site','Eu Amo Urânia','texto'),
  ('email_contato','euamourania@gmail.com','email')
on conflict (chave) do nothing;
