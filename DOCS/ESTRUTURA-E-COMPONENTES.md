# Estrutura e componentes

## Raiz do projeto

Arquivos principais:

- `index.html`: home pública.
- `guia.html`: Guia comercial.
- `guia-details.html`: página individual de empresa.
- `turismo.html`: Turismo.
- `turismo-details.html`: página individual de atração.
- `news-details.html`: página individual de notícia.
- `buscar.html`: busca global.
- `quem-somos.html`: institucional.
- `termos-de-servico.html`: termos.
- `politica-de-privacidade.html`: privacidade.
- `descadastrar.html`: descadastro da newsletter.
- `vercel.json`: rotas, rewrites, redirects, headers e cron.
- `package.json`: scripts de validação e testes.

## Pastas públicas

- `news/`: página principal de notícias.
- `categorias/`: páginas públicas de editorias.
- `colabore/`: cadastro voluntário.
- `eventos/`: eventos públicos.
- `links/`: página de links.
- `melhores-de-urania/`: módulo público da premiação.
- `urania/`: página sobre a cidade.
- `assets/`: CSS, JS, imagens e componentes públicos.

## Painel administrativo

Pasta:

- `admin/`

Contém páginas, scripts e estilos do CMS.

Áreas importantes:

- notícias;
- formulários;
- Guia;
- Turismo;
- Eventos;
- Publicidade;
- Comunicação;
- Mídia;
- Usuários;
- Configurações;
- Melhores de Urânia.

## APIs

Pasta:

- `api/`

Usada para funções serverless protegidas ou para servir HTML/metadados dinâmicos.

## Supabase

Pasta:

- `supabase/`

Subpastas:

- `migrations/`: alterações do banco;
- `rollbacks/`: reversões quando existem;
- `schema.sql`: base inicial;
- documentos auxiliares.

## Scripts

Pasta:

- `scripts/`

Contém testes e validadores automatizados.

## Convenções

- Reutilizar componentes e serviços existentes.
- Não duplicar lógica de busca, SEO ou Supabase.
- Preservar URLs antigas com redirects quando mudar rota.
- Toda página pública nova deve considerar sitemap, canonical e Open Graph.
