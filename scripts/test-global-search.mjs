import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [service, overlay, page, html, css, script, guide, analytics] = await Promise.all([
  read("assets/js/services/searchService.js"),
  read("assets/js/pages/global-search.js"),
  read("assets/js/pages/search-page.js"),
  read("buscar.html"),
  read("assets/css/global-search.css"),
  read("script.js"),
  read("assets/js/pages/guia-page.js"),
  read("assets/js/pages/analytics-page.js")
]);

for (const table of ["noticias", "guia_comercial", "turismo", "eventos"]) {
  must(service.includes(`fetchPublicRows("${table}"`), `Busca não consulta ${table}.`);
}
must(service.includes('status: "eq.publicado"'), "Busca pode exibir conteúdo não publicado.");
must(service.includes('publicado_em: `lte.${now}`'), "Busca pode exibir notícia agendada.");
must(service.includes('normalize("NFD")'), "Busca não ignora diferenças de acentuação.");
must(service.includes("score(item") && service.includes("normalizedTitle.startsWith"), "Busca não possui ordenação por relevância.");
must(overlay.includes("data-open-global-search") && overlay.includes('role="dialog"'), "Busca global não possui abertura acessível.");
must(overlay.includes("query.length < 2") && overlay.includes("setTimeout(() => updateSuggestions"), "Sugestões não possuem limite mínimo e debounce.");
must(script.includes("loadGlobalSearch()"), "Busca global não é carregada nas páginas públicas.");
must(html.includes('name="robots" content="noindex,follow"'), "Página de resultados pode gerar conteúdo duplicado no Google.");
must(html.includes("portal-search-filters") && page.includes("searchTypeCounts"), "Página não possui filtros por tipo.");
must(page.includes("history.replaceState") && page.includes("visible += PAGE_SIZE"), "Resultados não possuem URL atualizada ou paginação.");
must(css.includes("@media(max-width:650px)") && css.includes(".search-results-grid"), "Busca não possui responsividade.");
must(guide.includes('id="guia-${esc(item.id)}"') && guide.includes('get("busca")'), "Resultado do guia não abre o estabelecimento correto.");
must(analytics.includes('record("busca"'), "Pesquisas não são registradas na audiência.");
must(!overlay.includes("loadSearchIndex()"), "Índice é carregado antes de o visitante pesquisar.");

console.log("Busca global validada: sugestões, relevância, filtros, audiência, guia e responsividade.");
