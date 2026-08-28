-- Campos complementares para edições especiais de eventos no aplicativo e no painel.
-- Mantém eventos simples intactos e não altera dados existentes.

alter table public.eventos_edicoes
  add column if not exists organizador text,
  add column if not exists endereco text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_edicoes_latitude_range_check'
      and conrelid = 'public.eventos_edicoes'::regclass
  ) then
    alter table public.eventos_edicoes
      add constraint eventos_edicoes_latitude_range_check
      check (latitude is null or (latitude >= -90 and latitude <= 90));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_edicoes_longitude_range_check'
      and conrelid = 'public.eventos_edicoes'::regclass
  ) then
    alter table public.eventos_edicoes
      add constraint eventos_edicoes_longitude_range_check
      check (longitude is null or (longitude >= -180 and longitude <= 180));
  end if;
end $$;

comment on column public.eventos_edicoes.organizador is 'Organização responsável pela edição específica do evento, quando diferente ou mais precisa que o evento principal.';
comment on column public.eventos_edicoes.endereco is 'Endereço estruturado opcional da edição do evento para uso no aplicativo.';
comment on column public.eventos_edicoes.latitude is 'Latitude opcional da edição do evento para rotas e mapa no aplicativo.';
comment on column public.eventos_edicoes.longitude is 'Longitude opcional da edição do evento para rotas e mapa no aplicativo.';
