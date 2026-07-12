# Google Notícias e descoberta de notícias

Esta documentação registra a preparação técnica do Eu Amo Urânia para descoberta de notícias na Pesquisa Google, aba Notícias, Top Stories e Google Notícias.

Importante: não existe implementação técnica que garanta entrada ou destaque no Google Notícias. Segundo a documentação do Google Publisher Center, o Google pode encontrar sites pelo rastreamento normal da web, e conteúdos elegíveis são avaliados automaticamente pelos sistemas do Google. Ter conteúdo elegível não garante posicionamento.

## URLs públicas

- Página de notícias: `https://euamourania.com.br/news/`
- Notícia individual: `https://euamourania.com.br/noticias/slug-da-noticia`
- Sitemap geral: `https://euamourania.com.br/sitemap.xml`
- News Sitemap: `https://euamourania.com.br/news-sitemap.xml`
- RSS: `https://euamourania.com.br/rss.xml`
- RSS alternativo: `https://euamourania.com.br/noticias/feed.xml`

## News Sitemap

O News Sitemap é dinâmico e gerado por `/api/sitemaps?type=news`.

Regras implementadas:

- inclui somente notícias publicadas;
- exclui rascunhos;
- exclui notícias agendadas para o futuro;
- inclui somente notícias com `publicado_em` nos últimos 2 dias;
- usa URL canônica `/noticias/{slug}`;
- informa nome da publicação, idioma, título e data original de publicação;
- permanece funcional mesmo quando vazio.

No Google Search Console, cadastre:

```text
https://euamourania.com.br/news-sitemap.xml
```

## Sitemap geral

O sitemap geral continua incluindo notícias publicadas mesmo após saírem da janela de 48 horas do News Sitemap.

No Google Search Console, mantenha cadastrado:

```text
https://euamourania.com.br/sitemap.xml
```

## RSS

O RSS não garante entrada no Google Notícias, mas melhora interoperabilidade e distribuição.

Feeds disponíveis:

```text
https://euamourania.com.br/rss.xml
https://euamourania.com.br/noticias/feed.xml
```

## Dados estruturados

Cada notícia individual renderizada por `/api/noticia` entrega JSON-LD com:

- `NewsArticle`;
- `BreadcrumbList`;
- `headline`;
- `description`;
- `image`;
- `datePublished`;
- `dateModified`;
- `author`;
- `publisher`;
- `mainEntityOfPage`;
- `articleSection`;
- `articleBody`;
- `isAccessibleForFree`;
- `inLanguage`.

Exemplo resumido:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "NewsArticle",
      "headline": "Título real da notícia",
      "datePublished": "2026-07-11T10:00:00-03:00",
      "dateModified": "2026-07-11T12:00:00-03:00",
      "isAccessibleForFree": true
    },
    {
      "@type": "BreadcrumbList"
    }
  ]
}
```

## Datas editoriais

A ordenação pública deve continuar usando `publicado_em`.

Regras:

- editar uma notícia antiga não deve enviá-la ao topo;
- `atualizado_em` é auditoria/modificação;
- `publicado_em` é a data editorial pública;
- notícias futuras só aparecem quando o horário chega.

## Ações manuais no Search Console

Para uma notícia recém-publicada:

1. Abra o Search Console.
2. Use “Inspeção de URL”.
3. Cole a URL canônica da notícia.
4. Confirme se a página está rastreável e sem `noindex`.
5. Se necessário, clique em “Solicitar indexação”.
6. Valide também o Rich Results Test para dados estruturados.

Para acompanhar resultados:

- use o relatório de Desempenho da Pesquisa;
- acompanhe a aba Notícias quando houver dados suficientes;
- monitore Cobertura/Indexação;
- verifique erros de sitemap e dados estruturados.

## Limitações editoriais

Dependem de rotina editorial e não de código:

- frequência de publicação;
- originalidade;
- apuração;
- clareza de autoria;
- qualidade das imagens;
- correções transparentes;
- evitar textos copiados integralmente;
- evitar títulos sensacionalistas;
- manter páginas institucionais atualizadas.

## Fontes oficiais usadas

- Google Search Central: News sitemaps.
- Google Search Central: Article structured data.
- Google Search Central: canonicalização.
- Google Search Central: robots.txt.
- Google Publisher Center: News content across Google.
