-- Recorrência para a Agenda simples do Eu Amo Urânia.
-- Execute no SQL Editor do Supabase antes de usar os campos de repetição no painel.

alter table public.eventos
  add column if not exists recorrencia_tipo text not null default 'nenhuma',
  add column if not exists recorrencia_ate timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_recorrencia_tipo_check'
      and conrelid = 'public.eventos'::regclass
  ) then
    alter table public.eventos
      add constraint eventos_recorrencia_tipo_check
      check (recorrencia_tipo in ('nenhuma', 'semanal', 'mensal', 'anual'));
  end if;
end $$;

create index if not exists idx_eventos_status_data_recorrencia
  on public.eventos (status, data_inicio, recorrencia_tipo, recorrencia_ate);

comment on column public.eventos.recorrencia_tipo is
  'Tipo de repetição da agenda simples: nenhuma, semanal, mensal ou anual.';

comment on column public.eventos.recorrencia_ate is
  'Data limite para geração das próximas ocorrências recorrentes no site público.';
