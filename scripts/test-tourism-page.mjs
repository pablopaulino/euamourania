import { readFile } from "node:fs/promises";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const must = (condition, message) => { if (!condition) throw new Error(message); };
const [html, js, css, detailHtml, detailJs, analytics] = await Promise.all([
  read("turismo.html"), read("preview/turismo/tourism-preview.js"), read("preview/turismo/tourism-preview.css"),
  read("turismo-details.html"), read("preview/turismo/local/tourism-detail-preview.js"), read("assets/js/pages/analytics-page.js")
]);
for (const id of ["turismo-busca", "turismo-status", "turismo-results", "turismo-empty", "turismo-container", "turismo-ver-mais"]) must(html.includes(`id="${id}"`), `Turismo sem interface: ${id}`);
must(html.includes("/preview/turismo/tourism-preview.js") && html.includes("/preview/turismo/tourism-preview.css"), "Página não carrega interface atual de turismo");
for (const feature of ["function render()", "turismo:renderizado", "normalize(", 'fetchPublicRows("turismo"', 'search?.addEventListener("input"', "data-tourism-id", "loadMore"]) must(js.includes(feature), `Turismo sem comportamento: ${feature}`);
for (const feature of [".tourism-grid-preview", ".tourism-search-preview", ".tourism-empty-preview", "@media (max-width:680px)", "prefers-reduced-motion"]) must(css.includes(feature), `Estilo de turismo incompleto: ${feature}`);
must(detailHtml.includes("/preview/turismo/local/tourism-detail-preview.js"), "Detalhe não carrega módulo atual");
for (const feature of ['fetchPublicRows("turismo"', "TouristAttraction", "mapsUrl", "data-tourism-id"]) must(detailJs.includes(feature), `Detalhe incompleto: ${feature}`);
must(analytics.includes('tourism=link.closest("[data-tourism-id]")'), "Cliques perderam identificação na audiência");
console.log("Turismo validado: busca, cards, paginação, detalhe, responsividade e métricas.");
