import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [vercelSource, sitemapApi, newsApi, rssApi, newsPage, homePage, doc] = await Promise.all([
  read("vercel.json"),
  read("api/sitemaps.js"),
  read("api/noticia.js"),
  read("api/rss.js"),
  read("news/index.html"),
  read("index.html"),
  read("DOCS/GOOGLE-NOTICIAS-E-DESCOBERTA.md")
]);
const vercel = JSON.parse(vercelSource);

must(vercel.rewrites.some(route => route.source === "/news-sitemap.xml" && route.destination.includes("type=news")), "News Sitemap não está roteado.");
must(vercel.rewrites.some(route => route.source === "/rss.xml" && route.destination === "/api/rss"), "RSS principal não está roteado.");
must(vercel.rewrites.some(route => route.source === "/noticias/feed.xml" && route.destination === "/api/rss"), "RSS alternativo não está roteado.");
must(
  vercel.rewrites.findIndex(route => route.source === "/noticias/feed.xml") <
    vercel.rewrites.findIndex(route => route.source === "/noticias/:slug"),
  "RSS alternativo precisa vir antes da rota dinâmica de notícias."
);
must(sitemapApi.includes("TWO_DAYS_MS"), "News Sitemap não limita notícias aos últimos dois dias.");
must(sitemapApi.includes("<news:publication_date>") && sitemapApi.includes("<news:title>"), "News Sitemap não possui tags obrigatórias.");
must(sitemapApi.includes('status: "eq.publicado"') && sitemapApi.includes("publicado_em"), "News Sitemap pode expor rascunhos, agendadas ou usar data errada.");
must(newsApi.includes('"@graph"') && newsApi.includes('"@type": "NewsArticle"'), "Notícia server-side não usa NewsArticle em @graph.");
must(newsApi.includes('"@type": "BreadcrumbList"'), "Notícia server-side não inclui BreadcrumbList.");
must(newsApi.includes("isAccessibleForFree") && newsApi.includes("articleSection") && newsApi.includes("articleBody"), "NewsArticle está incompleto.");
must(newsApi.includes("article:published_time") && newsApi.includes("article:modified_time"), "Metadados article:* ausentes.");
must(newsApi.includes('rel="alternate" type="application/rss+xml"'), "Notícia não anuncia RSS.");
must(rssApi.includes("application/rss+xml") && rssApi.includes("<rss version=\"2.0\">"), "RSS não está em XML RSS 2.0.");
must(rssApi.includes("status: \"eq.publicado\"") && rssApi.includes("publicado_em: `lte.${now}`"), "RSS pode expor rascunhos ou agendadas.");
must(newsPage.includes('type="application/rss+xml"'), "Página de notícias não anuncia RSS.");
must(homePage.includes('"@type": "Organization"') && homePage.includes('"@type": "WebSite"'), "Home não possui Organization/WebSite.");
must(doc.includes("não garante") && doc.includes("News Sitemap") && doc.includes("Search Console"), "Documentação de Google Notícias está incompleta.");

console.log("Elegibilidade técnica para Google Notícias validada: News Sitemap, RSS, NewsArticle, BreadcrumbList, canonical e documentação.");
