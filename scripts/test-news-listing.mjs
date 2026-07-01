import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};

const [html,page,featured,css]=await Promise.all([
 read("news/index.html"),
 read("assets/js/pages/noticias-page.js"),
 read("assets/js/pages/destaques-page.js"),
 read("inner-pages.css")
]);

must(html.includes("news-masthead")&&html.includes("news-featured"),"Página não possui cabeçalho compacto e notícia principal");
must(html.includes("news-search-form")&&html.includes("news-category-filters"),"Busca ou categorias ausentes");
must(html.includes("news-load-more"),"Carregamento progressivo ausente");
for(const feature of["renderFeatured","renderFilters","filteredNews","PAGE_SIZE=8","visibleCount+=PAGE_SIZE"])must(page.includes(feature),`Listagem dinâmica incompleta: ${feature}`);
must(page.includes("news.find(item=>item.destaque)||news[0]"),"Página não escolhe uma notícia principal");
must(page.includes("news.filter(item=>item.id!==lead.id)"),"Notícia principal aparece duplicada no feed");
must(featured.includes("if(!home)return")&&!featured.includes("const news="),"Componente antigo ainda injeta destaque na página de notícias");
for(const feature of[".news-masthead", ".news-lead", ".news-search-form", ".news-category-filters", ".news-load-more"])must(css.includes(feature),`Estilo profissional ausente: ${feature}`);
must(css.includes("@media (max-width: 650px)")&&css.includes(".news-lead-media img { height: 235px; }"),"Página de notícias não está adaptada ao celular");

console.log("Página de notícias validada: destaque editorial, busca, categorias, feed e responsividade.");
