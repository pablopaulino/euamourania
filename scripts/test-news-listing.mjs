import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const must = (condition, message) => { if (!condition) throw new Error(message); };
const mojibake = /Ã|Â|â[€„€¦™œ€œ˜]|�/;

const [html, page, featured, css, dedicatedCss, banners] = await Promise.all([
  read("news/index.html"),
  read("assets/js/pages/noticias-page.js"),
  read("assets/js/pages/destaques-page.js"),
  read("inner-pages.css"),
  read("assets/css/noticias-page.css"),
  read("assets/js/pages/banners-page.js"),
]);

must(html.includes("news-masthead") && html.includes("news-featured"), "Página não possui cabeçalho e área editorial");
must(html.includes("news-search-form") && html.includes("news-category-filters"), "Busca ou categorias ausentes");
must(html.includes("news-clear-filters") && html.includes("assets/css/noticias-page.css"), "Controles ou estilo da página ausentes");
must(html.includes("news-load-more"), "Carregamento progressivo ausente");
must(!mojibake.test(html), "HTML da página de notícias contém texto com acento quebrado");

for (const feature of [
  "renderFeatured",
  "leadCard",
  "compactCard",
  "renderBreaking",
  "renderFilters",
  "filteredNews",
  "PAGE_SIZE = 10",
  "visibleCount += PAGE_SIZE",
]) must(page.includes(feature), `Listagem dinâmica incompleta: ${feature}`);

must(page.includes("news.find((item) => item.destaque) || news[0]"), "Página não escolhe uma notícia principal");
must(page.includes("highlightedIds") && page.includes("!highlightedIds.has(item.id)"), "Notícias de abertura aparecem duplicadas no feed");
must(page.includes('closest("#news-clear-filters")') && page.includes("news-item-action"), "Filtros ou chamada editorial incompletos");
must(page.includes("visualizacoes") && page.includes("news-popular-list"), "Mais lidas não usa dados reais disponíveis");
must(!mojibake.test(page), "JS da página de notícias contém texto com acento quebrado");

must(featured.includes("if (!target || document.querySelector(\".home-editorial\") || !news.length) return;"), "Componente da home foi alterado de forma inesperada");

for (const feature of [".news-masthead", ".news-search-form", ".news-category-filters", ".news-load-more"]) {
  must(css.includes(feature), `Estilo base ausente: ${feature}`);
}
for (const feature of [
  ".news-cover",
  ".news-cover-grid",
  ".news-cover-sidebar",
  ".news-breaking-strip",
  ".news-sidebar-block",
  ".news-card-grid",
  ".news-item-action",
  "@media(max-width:650px)",
  "prefers-reduced-motion",
]) must(dedicatedCss.includes(feature), `Estilo editorial ausente: ${feature}`);

must(dedicatedCss.includes(".news-filter[aria-pressed=true]") && dedicatedCss.includes(".news-filter:focus-visible"), "Categoria selecionada não possui contraste e foco visível");
must(dedicatedCss.includes(".news-card-grid{display:grid;grid-template-columns:repeat(2") && dedicatedCss.includes(".news-card-grid{grid-template-columns:1fr}"), "Grade de notícias não está em duas colunas no desktop e uma no celular");
must(page.includes('class="news-item"') && banners.includes('"#news-container", ".news-item"'), "Publicidade entre notícias foi quebrada");

console.log("Página de notícias validada: capa simplificada, plantão local, mais lidas, busca, categorias e responsividade.");
