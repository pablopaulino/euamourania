-- Eu Amo Urânia — Assinaturas comerciais da Publicidade
-- Estrutura permanente para planos mensais originados pela página /divulgue.

create extension if not exists pgcrypto;

create table if not exists public.assinaturas_comerciais (
  id uuid primary key default gen_random_uuid(),
  anunciante_id uuid references public.anunciantes(id) on delete set null,
  guia_comercial_id uuid references public.guia_comercial(id) on delete set null,
  business_submission_id uuid references public.business_submissions(id) on delete set null,
  empresa_nome text not null,
  responsavel_nome text,
  whatsapp text,
  email text,
  instagram text,
  categoria text,
  plano text not null check (plano in ('presenca','destaque','maxima')),
  valor_mensal numeric(10,2) not null default 0 check (valor_mensal >= 0),
  status text not null default 'ativa' check (status in ('ativa','pausada','cancelada','pendente')),
  data_inicio date not null default current_date,
  proxima_cobranca date not null default ((current_date + interval '1 month')::date),
  ultimo_pagamento_em date,
  observacoes text,
  configuracao jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.assinatura_entregas_mensais (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas_comerciais(id) on delete cascade,
  competencia date not null,
  story_total integer not null default 0 check (story_total >= 0),
  story_usados integer not null default 0 check (story_usados >= 0),
  feed_total integer not null default 0 check (feed_total >= 0),
  feed_usados integer not null default 0 check (feed_usados >= 0),
  atualizacao_total integer not null default 0 check (atualizacao_total >= 0),
  atualizacao_usados integer not null default 0 check (atualizacao_usados >= 0),
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (assinatura_id, competencia)
);

create table if not exists public.assinatura_pagamentos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas_comerciais(id) on delete cascade,
  competencia date not null,
  valor numeric(10,2) not null default 0 check (valor >= 0),
  status text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  pago_em date,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists assinaturas_comerciais_status_idx
  on public.assinaturas_comerciais (status, proxima_cobranca);

create index if not exists assinaturas_comerciais_submission_idx
  on public.assinaturas_comerciais (business_submission_id)
  where business_submission_id is not null;

create index if not exists assinatura_entregas_competencia_idx
  on public.assinatura_entregas_mensais (competencia desc);

create index if not exists assinatura_pagamentos_status_idx
  on public.assinatura_pagamentos (status, competencia desc);

drop trigger if exists assinaturas_comerciais_atualizado_em on public.assinaturas_comerciais;
create trigger assinaturas_comerciais_atualizado_em
before update on public.assinaturas_comerciais
for each row execute function public.definir_atualizado_em();

drop trigger if exists assinatura_entregas_atualizado_em on public.assinatura_entregas_mensais;
create trigger assinatura_entregas_atualizado_em
before update on public.assinatura_entregas_mensais
for each row execute function public.definir_atualizado_em();

drop trigger if exists assinatura_pagamentos_atualizado_em on public.assinatura_pagamentos;
create trigger assinatura_pagamentos_atualizado_em
before update on public.assinatura_pagamentos
for each row execute function public.definir_atualizado_em();

create or replace function public.valor_plano_comercial(p_plano text)
returns numeric
language sql
immutable
as $$
  select case p_plano
    when 'presenca' then 89
    when 'destaque' then 169
    when 'maxima' then 249
    else 0
  end::numeric;
$$;

create or replace view public.publicidade_assinaturas_resumo
with (security_invoker=true) as
select
  count(*) filter (where status = 'ativa')::integer as assinantes_ativos,
  coalesce(sum(valor_mensal) filter (where status = 'ativa'), 0)::numeric(10,2) as mrr,
  count(*) filter (where status = 'pendente')::integer as assinantes_pendentes,
  count(*) filter (where status = 'ativa' and proxima_cobranca <= current_date)::integer as pagamentos_pendentes
from public.assinaturas_comerciais;

alter table public.assinaturas_comerciais enable row level security;
alter table public.assinatura_entregas_mensais enable row level security;
alter table public.assinatura_pagamentos enable row level security;

grant select, insert, update, delete on public.assinaturas_comerciais to authenticated;
grant select, insert, update, delete on public.assinatura_entregas_mensais to authenticated;
grant select, insert, update, delete on public.assinatura_pagamentos to authenticated;
grant select on public.publicidade_assinaturas_resumo to authenticated;
grant execute on function public.valor_plano_comercial(text) to authenticated;

drop policy if exists rbac_assinaturas_comerciais_select on public.assinaturas_comerciais;
create policy rbac_assinaturas_comerciais_select
on public.assinaturas_comerciais
for select to authenticated
using (public.tem_permissao_admin('publicidade','ler'));

drop policy if exists rbac_assinaturas_comerciais_insert on public.assinaturas_comerciais;
create policy rbac_assinaturas_comerciais_insert
on public.assinaturas_comerciais
for insert to authenticated
with check (public.tem_permissao_admin('publicidade','criar') or public.tem_permissao_admin('publicidade','editar'));

drop policy if exists rbac_assinaturas_comerciais_update on public.assinaturas_comerciais;
create policy rbac_assinaturas_comerciais_update
on public.assinaturas_comerciais
for update to authenticated
using (public.tem_permissao_admin('publicidade','editar'))
with check (public.tem_permissao_admin('publicidade','editar'));

drop policy if exists rbac_assinaturas_comerciais_delete on public.assinaturas_comerciais;
create policy rbac_assinaturas_comerciais_delete
on public.assinaturas_comerciais
for delete to authenticated
using (public.tem_permissao_admin('publicidade','excluir'));

drop policy if exists rbac_assinatura_entregas_select on public.assinatura_entregas_mensais;
create policy rbac_assinatura_entregas_select
on public.assinatura_entregas_mensais
for select to authenticated
using (public.tem_permissao_admin('publicidade','ler'));

drop policy if exists rbac_assinatura_entregas_write on public.assinatura_entregas_mensais;
create policy rbac_assinatura_entregas_write
on public.assinatura_entregas_mensais
for all to authenticated
using (public.tem_permissao_admin('publicidade','editar'))
with check (public.tem_permissao_admin('publicidade','editar'));

drop policy if exists rbac_assinatura_pagamentos_select on public.assinatura_pagamentos;
create policy rbac_assinatura_pagamentos_select
on public.assinatura_pagamentos
for select to authenticated
using (public.tem_permissao_admin('publicidade','ler'));

drop policy if exists rbac_assinatura_pagamentos_write on public.assinatura_pagamentos;
create policy rbac_assinatura_pagamentos_write
on public.assinatura_pagamentos
for all to authenticated
using (public.tem_permissao_admin('publicidade','editar'))
with check (public.tem_permissao_admin('publicidade','editar'));

drop policy if exists publicidade_select_business_commercial_submissions on public.business_submissions;
create policy publicidade_select_business_commercial_submissions
on public.business_submissions
for select to authenticated
using (
  public.tem_permissao_admin('publicidade','ler')
  and (
    submitted_payload->>'source' = 'divulgue'
    or submitted_payload->>'commercial_flow' = 'true'
    or submitted_payload ? 'plan_id'
    or submitted_payload ? 'plan_key'
    or submitted_payload ? 'plan'
  )
);

drop policy if exists publicidade_update_business_commercial_submissions on public.business_submissions;
create policy publicidade_update_business_commercial_submissions
on public.business_submissions
for update to authenticated
using (
  public.tem_permissao_admin('publicidade','editar')
  and (
    submitted_payload->>'source' = 'divulgue'
    or submitted_payload->>'commercial_flow' = 'true'
    or submitted_payload ? 'plan_id'
    or submitted_payload ? 'plan_key'
    or submitted_payload ? 'plan'
  )
)
with check (
  public.tem_permissao_admin('publicidade','editar')
  and (
    submitted_payload->>'source' = 'divulgue'
    or submitted_payload->>'commercial_flow' = 'true'
    or submitted_payload ? 'plan_id'
    or submitted_payload ? 'plan_key'
    or submitted_payload ? 'plan'
  )
);
