import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};
const absent = async path => {
  try {
    await access(new URL(path, root));
    return false;
  } catch {
    return true;
  }
};

const [vercelSource, sitemapApi, newsApi, staticSitemapAbsent, staticNewsSitemapAbsent] = await Promise.all([
  read("vercel.json"),
  read("api/sitemaps.js"),
  read("api/noticia.js"),
  absent("sitemap.xml"),
  absent("news-sitemap.xml")
]);
const vercel = JSON.parse(vercelSource);

must(staticSitemapAbsent && staticNewsSitemapAbsent, "Sitemaps estáticos ainda podem impedir a atualização automática.");
must(
  vercel.rewrites.some(item => item.source === "/sitemap.xml" && item.destination.includes("/api/sitemaps")),
  "Sitemap geral não aponta para a função dinâmica."
);
must(
  vercel.rewrites.some(item => item.source === "/news-sitemap.xml" && item.destination.includes("type=news")),
  "News sitemap não aponta para a função dinâmica."
);
for (const legacy of ["/news-detalhes.html", "/news-details.html"]) {
  must(
    vercel.redirects.some(item => item.source === legacy && item.destination === "/noticias/:slug" && item.permanent),
    `URL antiga ${legacy} não possui redirecionamento permanente por slug.`
  );
}
must(
  sitemapApi.includes("TWO_DAYS_MS") && sitemapApi.includes('`gte.${new Date(now.getTime() - TWO_DAYS_MS).toISOString()}`'),
  "News sitemap não limita artigos aos últimos dois dias."
);
must(
  sitemapApi.includes('status: "eq.publicado"') && sitemapApi.includes('["publicado_em", `lte.${now.toISOString()}`]'),
  "Sitemaps podem expor rascunhos ou publicações futuras."
);
must(
  newsApi.includes('data-server-rendered="true"') && newsApi.includes("articleText"),
  "Notícia ainda não entrega conteúdo visível no HTML inicial."
);
must(newsApi.includes('rel="canonical"'), "Notícia não entrega canonical no HTML inicial.");
must(newsApi.includes('"@type": "NewsArticle"'), "Notícia não entrega dados estruturados NewsArticle.");

console.log("SEO de indexação validado: sitemaps dinâmicos, URLs antigas redirecionadas e notícia renderizada no servidor.");
