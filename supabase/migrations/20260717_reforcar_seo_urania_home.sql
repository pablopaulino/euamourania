-- Reforça a Home como página principal do portal local de Urânia/SP.
-- A Home dinâmica usa estes campos do Supabase para title e meta description.

insert into public.configuracoes_site (chave, valor, tipo)
values
  ('seo_titulo_padrao', 'Eu Amo Urânia | Portal local de Urânia SP', 'texto'),
  ('seo_descricao_padrao', 'Portal local de Urânia SP com notícias, guia comercial, turismo, eventos, histórias e informações úteis da cidade.', 'textarea'),
  ('seo_palavras_chave', 'Urânia, Urânia SP, Eu Amo Urânia, notícias de Urânia, guia de Urânia, turismo em Urânia, comércio de Urânia', 'texto')
on conflict (chave) do update
set
  valor = excluded.valor,
  tipo = excluded.tipo,
  atualizado_em = now();
