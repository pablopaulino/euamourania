-- Rótulo exibível para edições especiais de eventos.
-- Permite manter o título limpo e exibir "25ª edição", "Edição 2026" etc. em área própria.

alter table public.eventos_edicoes
  add column if not exists edicao_label text;

comment on column public.eventos_edicoes.edicao_label is 'Rótulo exibível da edição no aplicativo e no site, como 25ª edição ou Edição 2026, sem poluir o título principal.';
