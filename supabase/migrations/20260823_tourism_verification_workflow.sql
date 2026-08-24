-- Verificação periódica de cadastros de Turismo
-- Ciclo padrão do painel: 180 dias.

alter table public.turismo
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
    select 1
    from pg_constraint
    where conname = 'turismo_verification_status_check'
      and conrelid = 'public.turismo'::regclass
  ) then
    alter table public.turismo
      add constraint turismo_verification_status_check
      check (verification_status in (
        'pending',
        'verified',
        'awaiting_contact',
        'needs_update',
        'inactive_suspected',
        'archived'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'turismo_verification_method_check'
      and conrelid = 'public.turismo'::regclass
  ) then
    alter table public.turismo
      add constraint turismo_verification_method_check
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

alter table public.turismo
  alter column contact_attempt_count set default 0;

update public.turismo
set
  verification_status = coalesce(verification_status, 'pending'),
  contact_attempt_count = coalesce(contact_attempt_count, 0)
where verification_status is null
   or contact_attempt_count is null;

create table if not exists public.tourism_verification_logs (
  id uuid primary key default gen_random_uuid(),
  tourism_id uuid not null references public.turismo(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  method text,
  result text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint tourism_verification_logs_action_check check (action in (
    'marked_verified',
    'contact_registered',
    'needs_update',
    'inactive_suspected',
    'archived',
    'restored'
  )),
  constraint tourism_verification_logs_method_check check (
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

create index if not exists turismo_verification_status_idx
  on public.turismo (verification_status);

create index if not exists turismo_next_verification_at_idx
  on public.turismo (next_verification_at);

create index if not exists turismo_last_verified_at_idx
  on public.turismo (last_verified_at);

create index if not exists turismo_last_contact_attempt_at_idx
  on public.turismo (last_contact_attempt_at);

create index if not exists tourism_verification_logs_tourism_created_idx
  on public.tourism_verification_logs (tourism_id, created_at desc);

create index if not exists tourism_verification_logs_actor_created_idx
  on public.tourism_verification_logs (actor_id, created_at desc);

alter table public.tourism_verification_logs enable row level security;

revoke all on public.tourism_verification_logs from anon;
grant select, insert on public.tourism_verification_logs to authenticated;

drop policy if exists tourism_verification_logs_select_admin on public.tourism_verification_logs;
create policy tourism_verification_logs_select_admin
on public.tourism_verification_logs
for select
to authenticated
using (public.tem_permissao_admin('turismo', 'ler'));

drop policy if exists tourism_verification_logs_insert_admin on public.tourism_verification_logs;
create policy tourism_verification_logs_insert_admin
on public.tourism_verification_logs
for insert
to authenticated
with check (
  public.tem_permissao_admin('turismo', 'editar')
  and actor_id = auth.uid()
);

comment on table public.tourism_verification_logs is 'Histórico administrativo de verificação periódica dos cadastros de Turismo.';
comment on column public.turismo.verification_status is 'Estado administrativo da verificação periódica do cadastro turístico.';
comment on column public.turismo.next_verification_at is 'Próxima data planejada para conferência do cadastro. Ciclo padrão: 180 dias.';
