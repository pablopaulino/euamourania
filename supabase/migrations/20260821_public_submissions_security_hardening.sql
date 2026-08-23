-- Hardening das submissões públicas.
-- Objetivo: versionar a estrutura mínima usada pelo site e garantir que envios
-- públicos continuem entrando apenas como pendentes, sem mídia e com dados básicos válidos.

create extension if not exists pgcrypto;

create table if not exists public.business_submissions (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text not null,
  categoria_id uuid,
  categoria_nome text,
  whatsapp text,
  telefone text,
  instagram text,
  facebook text,
  site text,
  endereco text,
  horario text,
  responsavel_nome text,
  submitter_name text not null,
  submitter_email text not null,
  submitter_phone text,
  status text not null default 'pending',
  terms_version text not null default 'public-submissions-no-media-v1',
  terms_accepted_at timestamptz not null default now(),
  submitted_payload jsonb not null default '{}'::jsonb,
  moderation_notes text,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text not null,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  horario text,
  local text,
  endereco text,
  organizador text,
  whatsapp text,
  telefone text,
  site text,
  instagram text,
  categoria_id uuid,
  categoria_nome text,
  submitter_name text not null,
  submitter_email text not null,
  submitter_phone text,
  status text not null default 'pending',
  terms_version text not null default 'public-submissions-no-media-v1',
  terms_accepted_at timestamptz not null default now(),
  submitted_payload jsonb not null default '{}'::jsonb,
  moderation_notes text,
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  approved_record_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_submission_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  form_type text not null,
  created_at timestamptz not null default now()
);

alter table public.business_submissions add column if not exists categoria_id uuid;
alter table public.business_submissions add column if not exists categoria_nome text;
alter table public.business_submissions add column if not exists whatsapp text;
alter table public.business_submissions add column if not exists telefone text;
alter table public.business_submissions add column if not exists instagram text;
alter table public.business_submissions add column if not exists facebook text;
alter table public.business_submissions add column if not exists site text;
alter table public.business_submissions add column if not exists endereco text;
alter table public.business_submissions add column if not exists horario text;
alter table public.business_submissions add column if not exists responsavel_nome text;
alter table public.business_submissions add column if not exists submitter_phone text;
alter table public.business_submissions add column if not exists terms_version text not null default 'public-submissions-no-media-v1';
alter table public.business_submissions add column if not exists terms_accepted_at timestamptz not null default now();
alter table public.business_submissions add column if not exists submitted_payload jsonb not null default '{}'::jsonb;
alter table public.business_submissions add column if not exists moderation_notes text;
alter table public.business_submissions add column if not exists rejection_reason text;
alter table public.business_submissions add column if not exists reviewed_at timestamptz;
alter table public.business_submissions add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.business_submissions add column if not exists approved_record_id uuid;
alter table public.business_submissions add column if not exists updated_at timestamptz not null default now();

alter table public.event_submissions add column if not exists data_fim timestamptz;
alter table public.event_submissions add column if not exists horario text;
alter table public.event_submissions add column if not exists local text;
alter table public.event_submissions add column if not exists endereco text;
alter table public.event_submissions add column if not exists organizador text;
alter table public.event_submissions add column if not exists whatsapp text;
alter table public.event_submissions add column if not exists telefone text;
alter table public.event_submissions add column if not exists site text;
alter table public.event_submissions add column if not exists instagram text;
alter table public.event_submissions add column if not exists categoria_id uuid;
alter table public.event_submissions add column if not exists categoria_nome text;
alter table public.event_submissions add column if not exists submitter_phone text;
alter table public.event_submissions add column if not exists terms_version text not null default 'public-submissions-no-media-v1';
alter table public.event_submissions add column if not exists terms_accepted_at timestamptz not null default now();
alter table public.event_submissions add column if not exists submitted_payload jsonb not null default '{}'::jsonb;
alter table public.event_submissions add column if not exists moderation_notes text;
alter table public.event_submissions add column if not exists rejection_reason text;
alter table public.event_submissions add column if not exists reviewed_at timestamptz;
alter table public.event_submissions add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.event_submissions add column if not exists approved_record_id uuid;
alter table public.event_submissions add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'business_submissions_status_check'
      and conrelid = 'public.business_submissions'::regclass
  ) then
    alter table public.business_submissions
      add constraint business_submissions_status_check
      check (status in ('pending', 'under_review', 'approved', 'rejected')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'event_submissions_status_check'
      and conrelid = 'public.event_submissions'::regclass
  ) then
    alter table public.event_submissions
      add constraint event_submissions_status_check
      check (status in ('pending', 'under_review', 'approved', 'rejected')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'business_submissions_public_insert_check'
      and conrelid = 'public.business_submissions'::regclass
  ) then
    alter table public.business_submissions
      add constraint business_submissions_public_insert_check
      check (
        status <> 'pending'
        or (
          char_length(btrim(nome)) between 3 and 180
          and char_length(btrim(descricao)) between 20 and 4000
          and char_length(btrim(submitter_name)) between 3 and 180
          and submitter_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
          and terms_version = 'public-submissions-no-media-v1'
          and terms_accepted_at is not null
          and coalesce(submitted_payload->>'media_upload', 'false') = 'false'
        )
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'event_submissions_public_insert_check'
      and conrelid = 'public.event_submissions'::regclass
  ) then
    alter table public.event_submissions
      add constraint event_submissions_public_insert_check
      check (
        status <> 'pending'
        or (
          char_length(btrim(titulo)) between 3 and 180
          and char_length(btrim(descricao)) between 20 and 4000
          and char_length(btrim(submitter_name)) between 3 and 180
          and submitter_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
          and data_inicio is not null
          and terms_version = 'public-submissions-no-media-v1'
          and terms_accepted_at is not null
          and coalesce(submitted_payload->>'media_upload', 'false') = 'false'
        )
      ) not valid;
  end if;
end $$;

drop trigger if exists trg_business_submissions_updated_at on public.business_submissions;
create trigger trg_business_submissions_updated_at
before update on public.business_submissions
for each row execute function public.set_atualizado_em();

drop trigger if exists trg_event_submissions_updated_at on public.event_submissions;
create trigger trg_event_submissions_updated_at
before update on public.event_submissions
for each row execute function public.set_atualizado_em();

alter table public.business_submissions enable row level security;
alter table public.event_submissions enable row level security;
alter table public.public_submission_attempts enable row level security;

revoke all on public.business_submissions from anon, authenticated;
revoke all on public.event_submissions from anon, authenticated;
revoke all on public.public_submission_attempts from anon, authenticated;

grant select, update, delete on public.business_submissions to authenticated;
grant select, update, delete on public.event_submissions to authenticated;

drop policy if exists "business_submissions_admin_select" on public.business_submissions;
create policy "business_submissions_admin_select"
on public.business_submissions
for select
to authenticated
using (
  public.tem_permissao_admin('submissoes', 'ler')
  or public.tem_permissao_admin('submissoes', 'acessar')
  or public.tem_permissao_admin('publicidade', 'ler')
);

drop policy if exists "business_submissions_admin_update" on public.business_submissions;
create policy "business_submissions_admin_update"
on public.business_submissions
for update
to authenticated
using (
  public.tem_permissao_admin('submissoes', 'editar')
  or public.tem_permissao_admin('submissoes', 'aprovar')
  or public.tem_permissao_admin('publicidade', 'editar')
)
with check (
  public.tem_permissao_admin('submissoes', 'editar')
  or public.tem_permissao_admin('submissoes', 'aprovar')
  or public.tem_permissao_admin('publicidade', 'editar')
);

drop policy if exists "business_submissions_admin_delete" on public.business_submissions;
create policy "business_submissions_admin_delete"
on public.business_submissions
for delete
to authenticated
using (public.tem_permissao_admin('submissoes', 'excluir'));

drop policy if exists "event_submissions_admin_select" on public.event_submissions;
create policy "event_submissions_admin_select"
on public.event_submissions
for select
to authenticated
using (
  public.tem_permissao_admin('submissoes', 'ler')
  or public.tem_permissao_admin('submissoes', 'acessar')
);

drop policy if exists "event_submissions_admin_update" on public.event_submissions;
create policy "event_submissions_admin_update"
on public.event_submissions
for update
to authenticated
using (
  public.tem_permissao_admin('submissoes', 'editar')
  or public.tem_permissao_admin('submissoes', 'aprovar')
)
with check (
  public.tem_permissao_admin('submissoes', 'editar')
  or public.tem_permissao_admin('submissoes', 'aprovar')
);

drop policy if exists "event_submissions_admin_delete" on public.event_submissions;
create policy "event_submissions_admin_delete"
on public.event_submissions
for delete
to authenticated
using (public.tem_permissao_admin('submissoes', 'excluir'));

create index if not exists idx_business_submissions_status_created
  on public.business_submissions (status, created_at desc);

create index if not exists idx_event_submissions_status_created
  on public.event_submissions (status, created_at desc);

create index if not exists idx_public_submission_attempts_ip_created
  on public.public_submission_attempts (ip_hash, created_at desc);
