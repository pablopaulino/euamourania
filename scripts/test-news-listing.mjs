import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};

const [html,page,featured,css,dedicatedCss,banners]=await Promise.all([
 read("news/index.html"),
 read("assets/js/pages/noticias-page.js"),
 read("assets/js/pages/destaques-page.js"),
 read("inner-pages.css"),
 read("assets/css/noticias-page.css"),
 read("assets/js/pages/banners-page.js")
]);

must(html.includes("news-masthead")&&html.includes("news-featured"),"Página não possui cabeçalho compacto e notícia principal");
must(html.includes("news-search-form")&&html.includes("news-category-filters"),"Busca ou categorias ausentes");
must(html.includes("news-clear-filters")&&html.includes("assets/css/noticias-page.css"),"Controles ou estilo minimalista ausentes");
must(html.includes("news-load-more"),"Carregamento progressivo ausente");
for(const feature of["renderFeatured","secondaryCard","renderFilters","filteredNews","loadWeather","PAGE_SIZE=8","visibleCount+=PAGE_SIZE"])must(page.includes(feature),`Listagem dinâmica incompleta: ${feature}`);
must(page.includes("news.find(item=>item.destaque)||news[0]"),"Página não escolhe uma notícia principal");
must(page.includes("highlightedIds")&&page.includes("!highlightedIds.has(item.id)"),"Notícias de abertura aparecem duplicadas no feed");
must(page.includes('closest("#news-clear-filters")')&&page.includes("news-item-action"),"Filtros ou chamada editorial incompletos");
must(page.includes("api.open-meteo.com")&&page.includes("sessionStorage")&&page.includes("AbortController"),"Previsão local não possui integração resiliente");
must(featured.includes("if(!home)return")&&!featured.includes("const news="),"Componente antigo ainda injeta destaque na página de notícias");
for(const feature of[".news-masthead", ".news-lead", ".news-search-form", ".news-category-filters", ".news-load-more"])must(css.includes(feature),`Estilo profissional ausente: ${feature}`);
must(css.includes("@media (max-width: 650px)")&&css.includes(".news-lead-media img { height: 235px; }"),"Página de notícias não está adaptada ao celular");
for(const feature of[".news-controls",".news-lead-label",".news-item-action","@media(max-width:650px)","prefers-reduced-motion"])must(dedicatedCss.includes(feature),`Estilo minimalista ausente: ${feature}`);
for(const feature of[".news-service-bar",".news-portal-grid",".news-secondary-stack","scroll-snap-type"])must(dedicatedCss.includes(feature),`Abertura de portal ausente: ${feature}`);
must(dedicatedCss.includes('.news-filter[aria-pressed="true"]')&&dedicatedCss.includes(".news-filter:focus-visible"),"Categoria selecionada não possui contraste e foco visível");
must(page.includes('class="news-item"')&&banners.includes('"#news-container", ".news-item"'),"Publicidade entre notícias foi quebrada");

console.log("Página de notícias validada: visual minimalista, destaque editorial, busca, categorias, feed e responsividade.");
