begin;

alter table public.eventos_edicoes
  add column if not exists seo_titulo text,
  add column if not exists seo_descricao text,
  add column if not exists palavras_chave text;

comment on column public.eventos_edicoes.seo_titulo is 'Titulo SEO opcional da pagina publica da edicao do evento.';
comment on column public.eventos_edicoes.seo_descricao is 'Descricao SEO opcional da pagina publica da edicao do evento.';
comment on column public.eventos_edicoes.palavras_chave is 'Palavras-chave internas para organizacao editorial e SEO.';

commit;
