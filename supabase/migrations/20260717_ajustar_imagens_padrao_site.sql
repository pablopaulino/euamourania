-- Ajusta as imagens globais para separar imagem pública/editável de fallback técnico.
-- A imagem oficial de compartilhamento do portal passa a ser a arte própria do Eu Amo Urânia.
-- Turismo mantém a imagem já usada historicamente.
-- Notícias, Guia e Eventos deixam de usar o ícone/fallback antigo como imagem padrão visual.

insert into public.configuracoes_site (chave, valor, tipo)
values
  ('imagem_compartilhamento', '/assets/compartilhamento-logo.png', 'url'),
  ('imagem_padrao_turismo', '/assets/AD3A1763-min (1).jpg', 'url')
on conflict (chave) do update
set
  valor = excluded.valor,
  tipo = excluded.tipo,
  atualizado_em = now();

update public.configuracoes_site
set
  valor = '',
  atualizado_em = now()
where chave in (
  'imagem_padrao_noticia',
  'imagem_padrao_guia',
  'imagem_padrao_evento'
);
