-- Viva Vantagens — estrutura inicial.
-- Migration preparada para revisão manual; não insere dados nem altera cadastros existentes.

create table if not exists public.vantagens (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.guia_comercial(id) on delete cascade,
  tipo text not null check (tipo in ('cupom', 'desconto', 'produto', 'promocao', 'acao', 'brinde', 'beneficio')),
  titulo text not null check (char_length(btrim(titulo)) > 0),
  descricao text,
  imagem_url text,
  preco_original numeric(12,2),
  preco_promocional numeric(12,2),
  percentual_desconto numeric(5,2),
  codigo_cupom text,
  regras text,
  data_inicio timestamptz not null default now(),
  data_fim timestamptz,
  ativo boolean not null default false,
  exclusivo_viva boolean not null default false,
  destaque boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vantagens_periodo_check check (data_fim is null or data_fim >= data_inicio),
  constraint vantagens_valores_check check (
    preco_original is null or preco_original >= 0
  ),
  constraint vantagens_preco_promocional_check check (
    preco_promocional is null or preco_promocional >= 0
  ),
  constraint vantagens_percentual_check check (
    percentual_desconto is null or percentual_desconto > 0 and percentual_desconto <= 100
  ),
  constraint vantagens_preco_relacao_check check (
    preco_original is null or preco_promocional is null or preco_promocional <= preco_original
  )
);

create index if not exists vantagens_publicas_idx
  on public.vantagens (destaque desc, exclusivo_viva desc, created_at desc)
  where ativo = true;
create index if not exists vantagens_estabelecimento_idx
  on public.vantagens (estabelecimento_id, ativo, data_inicio, data_fim);
create index if not exists vantagens_expiracao_idx
  on public.vantagens (data_fim)
  where ativo = true and data_fim is not null;

create or replace function public.vantagens_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vantagens_set_updated_at on public.vantagens;
create trigger vantagens_set_updated_at
before update on public.vantagens
for each row execute function public.vantagens_set_updated_at();

alter table public.vantagens enable row level security;
revoke all on public.vantagens from anon;
revoke all on public.vantagens from authenticated;
grant select on public.vantagens to anon, authenticated;
grant insert, update, delete on public.vantagens to authenticated;

drop policy if exists vantagens_public_select on public.vantagens;
create policy vantagens_public_select
on public.vantagens
for select to anon, authenticated
using (
  ativo = true
  and data_inicio <= now()
  and (data_fim is null or data_fim >= now())
  and exists (
    select 1
    from public.guia_comercial estabelecimento
    where estabelecimento.id = vantagens.estabelecimento_id
      and estabelecimento.status = 'publicado'
  )
);

drop policy if exists vantagens_admin_select on public.vantagens;
create policy vantagens_admin_select
on public.vantagens
for select to authenticated
using (public.tem_permissao_admin('guia_comercial', 'ler'));

drop policy if exists vantagens_admin_insert on public.vantagens;
create policy vantagens_admin_insert
on public.vantagens
for insert to authenticated
with check (public.tem_permissao_admin('guia_comercial', 'editar'));

drop policy if exists vantagens_admin_update on public.vantagens;
create policy vantagens_admin_update
on public.vantagens
for update to authenticated
using (public.tem_permissao_admin('guia_comercial', 'editar'))
with check (public.tem_permissao_admin('guia_comercial', 'editar'));

drop policy if exists vantagens_admin_delete on public.vantagens;
create policy vantagens_admin_delete
on public.vantagens
for delete to authenticated
using (public.tem_permissao_admin('guia_comercial', 'excluir'));

comment on table public.vantagens is
  'Benefícios, cupons, ofertas e ações promocionais vinculados a estabelecimentos do Guia Comercial.';
