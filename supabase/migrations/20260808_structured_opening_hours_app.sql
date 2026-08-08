-- Horários estruturados para exibição no aplicativo Viva Urânia.
-- Mantém o campo textual "horario" existente para o site e para fallback.

alter table public.guia_comercial
  add column if not exists opening_hours jsonb,
  add column if not exists opening_hours_note text;

alter table public.turismo
  add column if not exists opening_hours jsonb,
  add column if not exists opening_hours_note text;

alter table public.guia_comercial
  drop constraint if exists guia_comercial_opening_hours_object,
  add constraint guia_comercial_opening_hours_object
  check (opening_hours is null or jsonb_typeof(opening_hours) = 'object');

alter table public.turismo
  drop constraint if exists turismo_opening_hours_object,
  add constraint turismo_opening_hours_object
  check (opening_hours is null or jsonb_typeof(opening_hours) = 'object');

comment on column public.guia_comercial.opening_hours is
  'Horários estruturados para o aplicativo. Objeto por dia: mon,tue,wed,thu,fri,sat,sun.';

comment on column public.guia_comercial.opening_hours_note is
  'Observação opcional exibida junto aos horários estruturados no aplicativo.';

comment on column public.turismo.opening_hours is
  'Horários estruturados para o aplicativo. Objeto por dia: mon,tue,wed,thu,fri,sat,sun.';

comment on column public.turismo.opening_hours_note is
  'Observação opcional exibida junto aos horários estruturados no aplicativo.';
