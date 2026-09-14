alter table public.turismo
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists site text;

comment on column public.turismo.instagram is
  'Link oficial do perfil do ponto turístico no Instagram.';

comment on column public.turismo.facebook is
  'Link oficial da página do ponto turístico no Facebook.';

comment on column public.turismo.site is
  'Link do site oficial do ponto turístico.';
