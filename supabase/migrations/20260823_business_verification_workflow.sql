-- Verificação periódica de cadastros do Guia Comercial
-- Migration incremental e não destrutiva.
-- Execute somente após revisão.

alter table public.guia_comercial
  add column if not exists verification_status text not null default 'pending',
  add column if not exists last_verified_at timestamptz,
  add column if not exists next_verification_at timestamptz,
  add column if not exists verification_method text,
  add column if not exists verification_notes text,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists last_contact_attempt_at timestamptz,
  add column if not exists contact_attempt_count integer not null default 0,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null,
  add column if not exists archive_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'guia_comercial_verification_status_check'
      and conrelid = 'public.guia_comercial'::regclass
  ) then
    alter table public.guia_comercial
      add constraint guia_comercial_verification_status_check
      check (verification_status in (
        'verified',
        'due_soon',
        'pending',
        'awaiting_contact',
        'needs_update',
        'inactive_suspected',
        'archived'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'guia_comercial_verification_method_check'
      and conrelid = 'public.guia_comercial'::regclass
  ) then
    alter table public.guia_comercial
      add constraint guia_comercial_verification_method_check
      check (
        verification_method is null
        or verification_method in (
          'whatsapp',
          'phone',
          'instagram',
          'website',
          'google',
          'in_person',
          'internal_knowledge',
          'other'
        )
      );
  end if;
end $$;

alter table public.guia_comercial
  alter column contact_attempt_count set default 0;

update public.guia_comercial
set
  verification_status = coalesce(verification_status, 'pending'),
  contact_attempt_count = coalesce(contact_attempt_count, 0)
where verification_status is null
   or contact_attempt_count is null;

create table if not exists public.business_verification_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.guia_comercial(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  method text,
  result text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint business_verification_logs_action_check check (action in (
    'marked_verified',
    'contact_registered',
    'needs_update',
    'inactive_suspected',
    'archived',
    'restored'
  )),
  constraint business_verification_logs_method_check check (
    method is null
    or method in (
      'whatsapp',
      'phone',
      'instagram',
      'website',
      'google',
      'in_person',
      'internal_knowledge',
      'other'
    )
  )
);

create index if not exists guia_comercial_verification_status_idx
  on public.guia_comercial (verification_status);

create index if not exists guia_comercial_next_verification_at_idx
  on public.guia_comercial (next_verification_at);

create index if not exists guia_comercial_last_verified_at_idx
  on public.guia_comercial (last_verified_at);

create index if not exists guia_comercial_last_contact_attempt_at_idx
  on public.guia_comercial (last_contact_attempt_at);

create index if not exists business_verification_logs_business_created_idx
  on public.business_verification_logs (business_id, created_at desc);

create index if not exists business_verification_logs_actor_created_idx
  on public.business_verification_logs (actor_id, created_at desc);

alter table public.business_verification_logs enable row level security;

revoke all on public.business_verification_logs from anon;
grant select, insert on public.business_verification_logs to authenticated;

drop policy if exists business_verification_logs_select_admin on public.business_verification_logs;
create policy business_verification_logs_select_admin
on public.business_verification_logs
for select
to authenticated
using (public.tem_permissao_admin('guia_comercial', 'ler'));

drop policy if exists business_verification_logs_insert_admin on public.business_verification_logs;
create policy business_verification_logs_insert_admin
on public.business_verification_logs
for insert
to authenticated
with check (
  public.tem_permissao_admin('guia_comercial', 'editar')
  and actor_id = auth.uid()
);

comment on table public.business_verification_logs is 'Histórico administrativo de verificação periódica dos cadastros do Guia Comercial.';
comment on column public.guia_comercial.verification_status is 'Estado administrativo da verificação periódica do cadastro comercial.';
comment on column public.guia_comercial.next_verification_at is 'Próxima data planejada para conferência do cadastro. Ciclo padrão: 90 dias.';
