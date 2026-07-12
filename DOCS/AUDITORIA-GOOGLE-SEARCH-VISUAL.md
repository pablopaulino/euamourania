# Auditoria de presença visual na Pesquisa Google

Data: 2026-07-12

## Objetivo

Melhorar a forma como o portal Eu Amo Urânia é identificado e exibido na Pesquisa Google e em compartilhamentos, com foco em favicon, imagem destacada, Open Graph, Twitter Card, dados estruturados e sitemaps.

## Problemas encontrados

1. O projeto não possuía arquivos técnicos estáveis de favicon na raiz:
   - `favicon.ico`
   - `favicon.svg`
   - `favicon.png`
   - `apple-touch-icon.png`
   - `manifest.webmanifest`

2. As páginas usavam diretamente `assets/Design sem nome (9).png` como favicon, com caminho relativo diferente conforme a pasta.

3. A rota server-side das notícias podia usar favicon vindo das configurações do banco, o que tornava o ícone menos estável para o Google.

4. Algumas páginas públicas importantes não possuíam um conjunto completo e consistente de:
   - `canonical`
   - `og:image`
   - `twitter:image`
   - `og:image:alt`
   - dados estruturados básicos de `WebPage` e `BreadcrumbList`

5. O sitemap geral não anunciava imagens das notícias com a extensão de sitemap de imagens.

## Causa

O site já possuía uma identidade visual clara no layout, mas faltava a camada técnica padronizada para buscadores e crawlers sociais. Para favicon, o Google recomenda um ícone rastreável, estável, quadrado e declarado no `head` da home. A ausência de arquivos estáveis na raiz aumentava a chance de o Google não exibir o favicon ou demorar para reconhecê-lo.

## Correções realizadas

### Favicon e PWA

Criados:

- `favicon.ico`
- `favicon.svg`
- `favicon.png`
- `apple-touch-icon.png`
- `manifest.webmanifest`
- `assets/icons/favicon-48x48.png`
- `assets/icons/icon-192x192.png`
- `assets/icons/icon-512x512.png`
- `assets/icons/apple-touch-icon.png`

Todas as páginas HTML públicas passaram a declarar:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
```

### Open Graph e Twitter Card

Foram completados metadados de imagem e compartilhamento nas páginas principais:

- Home
- Notícias
- Guia da cidade
- Turismo
- Eventos
- Links
- Quem somos

### Notícias individuais

A rota server-side de notícias agora:

- usa favicon estável do domínio;
- inclui `manifest.webmanifest`;
- inclui `og:image:alt`;
- inclui `twitter:image:alt`;
- faz preload da imagem principal da notícia;
- preserva `NewsArticle`, `BreadcrumbList`, canonical e metadados de publicação.

### Dados estruturados

Foram reforçados:

- `Organization`
- `WebSite`
- `SearchAction`
- `WebPage`
- `BreadcrumbList`
- `NewsArticle`
- `ImageObject`

### Sitemap de imagens

O `sitemap.xml` dinâmico passou a incluir `xmlns:image` e imagens das notícias quando houver `seo_imagem` ou `imagem_url`.

### Cache

O `vercel.json` passou a definir cache para favicon, manifest e ícones principais.

## Itens que já estavam corretos

- `robots.txt` liberando o site público.
- Bloqueio de `/admin/` e `/api/` para indexação.
- `sitemap.xml` e `news-sitemap.xml` dinâmicos.
- URLs amigáveis de notícias por slug.
- HTML server-side das notícias com conteúdo inicial para Google.
- `NewsArticle` e `BreadcrumbList` nas notícias.
- RSS das notícias.
- Canonical das notícias.
- Status público respeitando publicações, rascunhos e agendamentos.

## Testes executados

Executado com sucesso:

```bash
npm.cmd run validate
npm.cmd run test:google-search-visual
npm.cmd run test:seo-indexing
npm.cmd run test:google-news
npm.cmd test
```

Novo teste criado:

- `scripts/test-google-search-visual.mjs`

Ele valida:

- existência dos ícones;
- manifest;
- favicon nas páginas públicas;
- `og:image`;
- `twitter:image`;
- canonical;
- schema da home;
- favicon/manifest nas notícias server-side;
- sitemap com imagens;
- cache no Vercel.

## Recomendações futuras

1. Após publicar, usar a Inspeção de URL no Google Search Console para solicitar nova indexação da home.
2. Aguardar o recrawl do Google para o favicon. Mesmo correto, o favicon pode levar dias ou semanas para reaparecer.
3. Validar uma notícia real no Rich Results Test e no URL Inspection.
4. Manter imagens de notícias com boa resolução, preferencialmente acima de 1200 px de largura quando possível.
5. Evitar trocar a URL do favicon com frequência.
6. Monitorar Search Console para rich results, imagens e indexação.
