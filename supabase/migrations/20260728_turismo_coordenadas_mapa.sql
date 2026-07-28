alter table public.turismo
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.turismo.latitude is
  'Latitude do ponto turístico usada pelo aplicativo Viva Urânia para exibir mapa nativo.';

comment on column public.turismo.longitude is
  'Longitude do ponto turístico usada pelo aplicativo Viva Urânia para exibir mapa nativo.';
