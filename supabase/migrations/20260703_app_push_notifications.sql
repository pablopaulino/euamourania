-- Viva Urânia — notificações push do aplicativo
-- Migração aditiva: não altera tabelas de conteúdo do portal.

create extension if not exists pgcrypto;

create table if not exists public.app_push_tokens (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null unique,
  expo_push_token text not null unique,
  plataforma text not null check (plataforma in ('android', 'ios')),
  app_version text,
  locale text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  visto_em timestamptz not null default now(),
  constraint app_push_token_formato check (
    expo_push_token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$'
  )
);

create table if not exists public.app_notificacoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  mensagem text not null check (char_length(mensagem) between 1 and 220),
  plataforma text not null default 'todos'
    check (plataforma in ('todos', 'android', 'ios')),
  destino_tipo text not null default 'home'
    check (destino_tipo in ('home', 'empresa', 'turismo', 'evento')),
  destino_valor text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'enviando', 'enviado', 'falhou', 'cancelado')),
  total_destinatarios integer not null default 0,
  total_aceitos integer not null default 0,
  total_erros integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

-- Mantém somente falhas individuais para diagnóstico, evitando histórico volumoso.
create table if not exists public.app_push_falhas (
  id bigint generated always as identity primary key,
  notificacao_id uuid not null references public.app_notificacoes(id) on delete cascade,
  token_id uuid references public.app_push_tokens(id) on delete set null,
  codigo text,
  mensagem text,
  criado_em timestamptz not null default now()
);

create index if not exists app_push_tokens_ativos_idx
  on public.app_push_tokens (plataforma, visto_em desc) where ativo = true;
create index if not exists app_notificacoes_criado_em_idx
  on public.app_notificacoes (criado_em desc);
create index if not exists app_push_falhas_notificacao_idx
  on public.app_push_falhas (notificacao_id, criado_em desc);

create or replace function public.app_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists app_push_tokens_touch on public.app_push_tokens;
create trigger app_push_tokens_touch before update on public.app_push_tokens
for each row execute function public.app_touch_atualizado_em();

drop trigger if exists app_notificacoes_touch on public.app_notificacoes;
create trigger app_notificacoes_touch before update on public.app_notificacoes
for each row execute function public.app_touch_atualizado_em();

create or replace function public.app_registrar_push_token(
  p_installation_id uuid,
  p_expo_push_token text,
  p_plataforma text,
  p_app_version text default null,
  p_locale text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_plataforma not in ('android', 'ios') then
    raise exception 'Plataforma inválida';
  end if;
  if p_expo_push_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'Token inválido';
  end if;

  delete from public.app_push_tokens
   where expo_push_token = p_expo_push_token
     and installation_id <> p_installation_id;

  insert into public.app_push_tokens (
    installation_id, expo_push_token, plataforma, app_version, locale, ativo, visto_em
  ) values (
    p_installation_id, p_expo_push_token, p_plataforma,
    left(p_app_version, 30), left(p_locale, 20), true, now()
  )
  on conflict (installation_id) do update set
    expo_push_token = excluded.expo_push_token,
    plataforma = excluded.plataforma,
    app_version = excluded.app_version,
    locale = excluded.locale,
    ativo = true,
    visto_em = now();
end;
$$;

create or replace function public.app_desativar_push_token(
  p_installation_id uuid,
  p_expo_push_token text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.app_push_tokens
     set ativo = false
   where installation_id = p_installation_id
     and expo_push_token = p_expo_push_token;
$$;

revoke all on function public.app_registrar_push_token(uuid,text,text,text,text) from public;
revoke all on function public.app_desativar_push_token(uuid,text) from public;
grant execute on function public.app_registrar_push_token(uuid,text,text,text,text) to anon, authenticated;
grant execute on function public.app_desativar_push_token(uuid,text) to anon, authenticated;

alter table public.app_push_tokens enable row level security;
alter table public.app_notificacoes enable row level security;
alter table public.app_push_falhas enable row level security;

revoke all on public.app_push_tokens from anon;
revoke all on public.app_notificacoes from anon;
revoke all on public.app_push_falhas from anon;
grant select, update on public.app_push_tokens to authenticated;
grant select, insert, update, delete on public.app_notificacoes to authenticated;
grant select, insert on public.app_push_falhas to authenticated;
grant usage, select on sequence public.app_push_falhas_id_seq to authenticated;

drop policy if exists "admin_le_push_tokens" on public.app_push_tokens;
create policy "admin_le_push_tokens" on public.app_push_tokens
for select to authenticated
using (public.tem_permissao_admin('notificacoes', 'ler'));

drop policy if exists "admin_atualiza_push_tokens" on public.app_push_tokens;
create policy "admin_atualiza_push_tokens" on public.app_push_tokens
for update to authenticated
using (public.tem_permissao_admin('notificacoes', 'enviar'))
with check (public.tem_permissao_admin('notificacoes', 'enviar'));

drop policy if exists "admin_gerencia_notificacoes" on public.app_notificacoes;
create policy "admin_gerencia_notificacoes" on public.app_notificacoes
for all to authenticated
using (public.tem_permissao_admin('notificacoes', 'ler'))
with check (public.tem_permissao_admin('notificacoes', 'criar'));

drop policy if exists "admin_le_push_falhas" on public.app_push_falhas;
create policy "admin_le_push_falhas" on public.app_push_falhas
for select to authenticated
using (public.tem_permissao_admin('notificacoes', 'ler'));

drop policy if exists "admin_registra_push_falhas" on public.app_push_falhas;
create policy "admin_registra_push_falhas" on public.app_push_falhas
for insert to authenticated
with check (public.tem_permissao_admin('notificacoes', 'enviar'));

insert into public.admin_permissoes_funcao (funcao, modulo, acao) values
  ('administrador', 'notificacoes', 'acessar'),
  ('administrador', 'notificacoes', 'ler'),
  ('administrador', 'notificacoes', 'criar'),
  ('administrador', 'notificacoes', 'enviar'),
  ('comunicacao', 'notificacoes', 'acessar'),
  ('comunicacao', 'notificacoes', 'ler'),
  ('comunicacao', 'notificacoes', 'criar'),
  ('comunicacao', 'notificacoes', 'enviar'),
  ('visualizador', 'notificacoes', 'ler')
on conflict do nothing;

comment on table public.app_push_tokens is
  'Instalações do Viva Urânia que autorizaram notificações. Não contém conteúdo do CMS.';
comment on table public.app_notificacoes is
  'Campanhas de push criadas no painel administrativo.';
comment on table public.app_push_falhas is
  'Somente falhas de envio para diagnóstico e limpeza periódica.';
