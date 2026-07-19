# SEO, performance e acessibilidade

O portal precisa ser fácil de rastrear, rápido de carregar e confortável de usar no celular.

## SEO

Cada página pública relevante deve ter:

- `title`;
- `meta description`;
- canonical;
- Open Graph;
- Twitter Card;
- imagem pública absoluta;
- dados estruturados quando aplicável.

## Dados estruturados

Usar conforme o tipo de página:

- `Organization`;
- `WebSite`;
- `WebPage`;
- `Article`;
- `NewsArticle`;
- `BreadcrumbList`;
- `ImageObject`;
- `Event`, quando aplicável;
- `LocalBusiness`, quando aplicável para empresas do Guia.

## Sitemaps

Gerados por `api/sitemaps.js`.

Devem incluir:

- páginas fixas;
- notícias;
- editorias;
- Guia;
- empresas individuais;
- categorias do Guia;
- Turismo;
- atrações;
- Eventos;
- eventos principais;
- edições de eventos;
- Melhores de Urânia;
- páginas institucionais.

Depois de criar novas rotas públicas importantes, conferir se entraram no sitemap.

## Notícias

Regras:

- publicar por slug;
- usar data de publicação real;
- não indexar rascunhos;
- usar imagem da matéria no Open Graph;
- manter `news-sitemap.xml` com notícias válidas.

## Favicon e identidade visual

Manter:

- `favicon.ico`;
- SVG/PNG quando existirem;
- `apple-touch-icon`;
- `manifest.webmanifest`;
- imagens com HTTP 200;
- sem conflito entre favicons.

## Performance

Boas práticas:

- evitar imagens gigantes;
- usar lazy loading fora da área inicial;
- reservar proporção de imagens para reduzir pulos;
- não carregar bibliotecas pesadas sem necessidade;
- reduzir consultas duplicadas ao Supabase;
- cachear consultas externas;
- otimizar anúncios para não quebrar o layout.

## Acessibilidade

Manter:

- contraste adequado;
- foco visível;
- navegação por teclado;
- labels em formulários;
- `alt` em imagens;
- botões com texto claro;
- acordeões acessíveis;
- sem rolagem horizontal indesejada no celular.

## Mobile

O celular é prioridade. Verificar sempre:

- menu;
- home;
- notícia individual;
- Guia;
- Turismo;
- Eventos;
- Melhores de Urânia;
- formulários;
- anúncios;
- biblioteca/admin quando possível.
