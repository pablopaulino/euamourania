# Banco de dados e Supabase

## Tabelas principais

- `noticias`: conteúdo, slug, SEO, status, destaque e visualizações.
- `guia_comercial`, `turismo`, `eventos`, `links`: conteúdo público por domínio.
- `categorias`: taxonomia por tipo; `categorias_com_contagem` agrega uso.
- `usuarios_admin`: autorização adicional ao Supabase Auth.
- `configuracoes_site`: configurações chave/valor.
- `campanhas_publicitarias`, `campanha_posicoes`, `publicidade_metricas_diarias`, `anunciantes`: publicidade e métricas.
- `analytics_eventos`: page views e cliques básicos.
- `newsletter_assinantes`, `newsletters`, `newsletter_envios`: comunicação.
- `cms_atividades`: trilha de alterações.

## Functions/RPC

`is_admin`, `registrar_evento_publicidade`, `registrar_evento_site`, `assinar_newsletter`, `descadastrar_newsletter`, `registrar_evento_newsletter` e funções auxiliares de categorias.

## RLS

Visitantes leem somente conteúdo publicado/ativo. CRUD administrativo exige sessão autenticada presente em `usuarios_admin`. Cadastro e métricas públicas passam por RPCs `security definer` com validação de parâmetros.

## Migrações

Executar `supabase/schema.sql` somente em projeto novo. Em ambientes existentes, aplicar em ordem os arquivos de `supabase/migrations/`. Registrar toda alteração futura como nova migração; nunca editar produção manualmente sem arquivo correspondente.

## Índices e backup

Os índices cobrem publicação, status, categorias, posições e métricas. Antes de migrações: exportar schema e dados no painel Supabase. Testar restauração em projeto separado pelo menos trimestralmente.
