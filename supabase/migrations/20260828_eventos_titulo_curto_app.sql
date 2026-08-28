-- Título curto para exibição no aplicativo.
-- Mantém o título completo no painel/site e permite cards mais limpos no app.

alter table public.eventos
  add column if not exists titulo_curto text;

alter table public.eventos_edicoes
  add column if not exists titulo_curto text;

comment on column public.eventos.titulo_curto is 'Título curto opcional para exibição no aplicativo. Quando vazio, o app usa o título completo.';
comment on column public.eventos_edicoes.titulo_curto is 'Título curto opcional da edição para exibição no aplicativo. Quando vazio, o app usa o título completo.';
