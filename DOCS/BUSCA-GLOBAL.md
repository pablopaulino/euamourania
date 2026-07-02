# Busca global

A busca pública reúne conteúdos publicados de quatro áreas:

- notícias cuja data de publicação já chegou;
- empresas do guia comercial;
- pontos turísticos;
- eventos.

## Experiência pública

O botão **Buscar** é inserido na navegação pública pelo módulo `assets/js/pages/global-search.js`.
Ao digitar pelo menos duas letras, o visitante recebe sugestões ordenadas por relevância.
A página `buscar.html` mostra todos os resultados e permite filtrar por tipo.

As diferenças de acentuação e maiúsculas são ignoradas. Títulos com correspondência exata ou iniciados pelo termo recebem prioridade. Conteúdos em destaque têm um pequeno ganho de relevância.

Resultados do guia abrem `guia.html` já filtrado e posicionam o estabelecimento correspondente. Notícias usam URL amigável por slug.

## Performance

O índice não é carregado junto com a página. As quatro consultas começam somente quando o visitante digita uma busca ou abre `buscar.html` com o parâmetro `q`.

O serviço `assets/js/services/searchService.js` utiliza o cache e a deduplicação de consultas do `publicDataService.js`. O índice fica em cache por cinco minutos durante a sessão.

## Audiência

Os formulários utilizam campos `type="search"`. O módulo de audiência registra o evento `busca` e salva somente o termo limitado a 100 caracteres, sem IP ou dado pessoal.

## SEO

`buscar.html` usa `noindex,follow`. Isso evita indexação de combinações de pesquisa e permite que o Google continue seguindo os links dos resultados.

## Testes

Execute:

```bash
npm run test:search
```

O teste cobre fontes de dados, conteúdo publicado, relevância, acentuação, filtros, responsividade, audiência e abertura de empresas no guia.
