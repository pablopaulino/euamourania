import fs from "node:fs";

const read = file => fs.readFileSync(file, "utf8");
const must = (condition, message) => {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
};

const api = read("api/noticia.js");
const vercel = read("vercel.json");
const list = read("assets/js/pages/guia-page.js");
const detail = read("assets/js/pages/guia-details-page.js");
const page = read("assets/js/pages/guia-categoria-page.js");
const css = read("assets/css/public-redesign.css");
const sitemap = read("api/sitemaps.js");
const analytics = read("assets/js/pages/analytics-page.js");

must(api.includes("renderGuiaCategoria"), "API renderiza página de categoria do Guia no servidor");
must(api.includes("CollectionPage") && api.includes("ItemList") && api.includes("BreadcrumbList"), "Categoria do Guia possui dados estruturados");
must(api.includes("/guia/categoria/") && api.includes("<link rel=\"canonical\""), "Categoria do Guia possui canonical limpo");
must(api.includes("og:image") && api.includes("twitter:image"), "Categoria do Guia possui Open Graph e Twitter Card");
must(vercel.indexOf("/guia/categoria/:slug") < vercel.indexOf("/guia/:slug"), "Vercel prioriza categoria antes da empresa individual");
must(!list.includes('href="/guia/categoria/') && list.includes('<button class="btn-filtro"'), "Página principal do Guia usa categorias como filtros, sem links");
must(api.includes('href="/guia/categoria/') && detail.includes('href="/guia/categoria/'), "Categoria fica clicável somente na página individual da empresa");
must(page.includes("guide-category-search") && page.includes("guia:renderizado"), "Página de categoria possui busca interna e mantém eventos públicos");
must(css.includes(".guide-category-page") && css.includes(".guide-category-grid") && css.includes("@media(max-width:640px)"), "Categoria do Guia possui layout responsivo");
must(sitemap.includes("guiaCategorias") && sitemap.includes("/guia/categoria/"), "Sitemap inclui categorias publicadas do Guia");
must(analytics.includes("!location.pathname.startsWith(\"/guia/categoria/\")"), "Audiência não confunde categoria com empresa individual");

console.log("Categorias públicas do Guia validadas.");
