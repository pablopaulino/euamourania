-- Motoristas particulares divulgados pelo Viva Urânia.
-- Cria somente estrutura e permissões; não insere contatos.

create table if not exists public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  descricao text,
  telefone text,
  whatsapp text not null,
  cidade text not null default 'Urânia - SP',
  regioes_atendidas text[] not null default '{}'::text[],
  tipos_servico text[] not null default '{}'::text[],
  observacao text,
  disponibilidade text not null default 'consulte',
  ativo boolean not null default true,
  destaque boolean not null default false,
  ordem integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint motoristas_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint motoristas_whatsapp_not_blank check (char_length(trim(whatsapp)) > 0),
  constraint motoristas_disponibilidade_check check (disponibilidade in ('consulte', 'disponivel', 'indisponivel', 'hoje', 'agendamento'))
);

create index if not exists motoristas_publicos_ordem_idx on public.motoristas (ativo, destaque desc, ordem, nome);

create or replace function public.motoristas_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists motoristas_set_updated_at on public.motoristas;
create trigger motoristas_set_updated_at before update on public.motoristas for each row execute function public.motoristas_set_updated_at();

alter table public.motoristas enable row level security;
revoke all on public.motoristas from anon;
revoke all on public.motoristas from authenticated;
grant select on public.motoristas to anon;
grant select, insert, update, delete on public.motoristas to authenticated;

drop policy if exists motoristas_public_select on public.motoristas;
create policy motoristas_public_select on public.motoristas for select to anon, authenticated using (ativo = true);
drop policy if exists motoristas_admin_select on public.motoristas;
create policy motoristas_admin_select on public.motoristas for select to authenticated using (public.tem_permissao_admin('configuracoes', 'ler'));
drop policy if exists motoristas_admin_insert on public.motoristas;
create policy motoristas_admin_insert on public.motoristas for insert to authenticated with check (public.tem_permissao_admin('configuracoes', 'editar'));
drop policy if exists motoristas_admin_update on public.motoristas;
create policy motoristas_admin_update on public.motoristas for update to authenticated using (public.tem_permissao_admin('configuracoes', 'editar')) with check (public.tem_permissao_admin('configuracoes', 'editar'));
drop policy if exists motoristas_admin_delete on public.motoristas;
create policy motoristas_admin_delete on public.motoristas for delete to authenticated using (public.tem_permissao_admin('configuracoes', 'editar'));

comment on table public.motoristas is 'Motoristas particulares divulgados no Viva Urânia para corridas locais e viagens.';
