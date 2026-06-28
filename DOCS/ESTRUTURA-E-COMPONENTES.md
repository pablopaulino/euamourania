# Estrutura e componentes

## Raiz pública

As páginas HTML da raiz e das pastas `news`, `links`, `eventos` e `admin` são pontos de entrada. `styles.css` mantém a identidade pública; `assets/css` contém estilos especializados.

## JavaScript público

- `script.js`: navegação e inicialização global.
- `assets/js/supabase-config.js`: cliente público do Supabase; contém somente URL e Publishable Key.
- `assets/js/services/*`: acesso a dados por domínio.
- `assets/js/pages/*`: renderização de páginas.
- `assets/js/publicidade.js`, `analytics.js` e `newsletter-public.js`: recursos transversais.

## Administração

`admin/admin.js` controla autenticação e operações principais. `admin/cms-v2.js`, `publicidade.js`, `comunicacao.js` e folhas de estilo complementares implementam os módulos avançados preservando o mesmo shell visual.

## Backend Vercel

`api/*` executa operações que exigem segredo ou resposta dinâmica, especialmente newsletter/Brevo, Open Graph e sitemaps. Segredos nunca pertencem ao navegador.

## Banco

`supabase/schema.sql` instala um ambiente novo; `supabase/migrations` evolui ambientes existentes. Toda mudança de schema deve receber migração própria, reversível quando possível e registrada na documentação.

## Convenções

Use nomes em português nos domínios, slugs minúsculos, módulos ES no navegador, validação no cliente e no banco, consultas em `services`, renderização em `pages` e estilos públicos separados dos administrativos.