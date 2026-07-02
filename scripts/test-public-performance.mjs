import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [client, newsList, newsDetail, guide, tourism, events, links, siteConfig, banners, analytics, newsletter, api, script, styles] = await Promise.all([
  read("assets/js/services/publicDataService.js"),
  read("assets/js/pages/noticias-page.js"),
  read("assets/js/pages/noticia-page.js"),
  read("assets/js/pages/guia-page.js"),
  read("assets/js/pages/turismo-page.js"),
  read("assets/js/pages/eventos-page.js"),
  read("assets/js/pages/links-page.js"),
  read("assets/js/pages/site-config-page.js"),
  read("assets/js/pages/banners-page.js"),
  read("assets/js/pages/analytics-page.js"),
  read("assets/js/pages/newsletter-public.js"),
  read("api/noticia.js"),
  read("script.js"),
  read("styles.css")
]);

must(client.includes("AbortController") && client.includes("sessionStorage"), "Cliente público sem timeout ou cache.");
for (const [name, source] of Object.entries({ newsList, newsDetail, guide, tourism, events, links, siteConfig, banners, analytics, newsletter })) {
  must(source.includes("publicDataService.js"), `${name} ainda depende do cliente pesado do Supabase.`);
  must(!source.includes("supabaseClient.js"), `${name} ainda carrega o SDK externo do Supabase.`);
}
must(newsList.includes("id,titulo,slug,resumo,imagem_url"), "Listagem de notícias ainda busca conteúdo completo.");
must(api.includes('id="initial-news-data"'), "Notícia dinâmica não recebe dados iniciais no HTML.");
must(newsDetail.includes("initialNews()") && newsDetail.includes("loadRelated(news)"), "Notícia não prioriza o conteúdo principal.");
must(script.includes("requestIdleCallback") && script.includes("schedulePublicModules"), "Módulos secundários não são adiados.");
must(styles.startsWith('@import url("assets/css/public-polish.css")'), "Estilos finais ainda podem entrar depois da renderização.");

console.log("Performance pública validada: consultas leves, cache, timeout e notícia sem busca duplicada.");
