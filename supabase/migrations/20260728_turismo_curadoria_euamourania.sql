alter table public.turismo
  add column if not exists curadoria_euamourania boolean not null default true;

comment on column public.turismo.curadoria_euamourania is
  'Exibe o selo de Curadoria Eu Amo Urânia no aplicativo Viva Urânia.';

update public.turismo
set curadoria_euamourania = true
where curadoria_euamourania is distinct from true;
