import { awardPath, readAwardRoute } from "../melhoresRoutes.mjs";
import { getDefaultMetodologia, renderOfficialDocument, addDocumentIndex } from "../melhoresOfficialTexts.js";
import { obterEdicaoPorAno } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

function year() {
  return Number(readAwardRoute().year || new Date().getFullYear());
}

async function init() {
  const content = document.getElementById("method-content");
  if (content?.dataset.serverRendered === "true") {
    content.classList.add("awards-document");
    if (!document.querySelector(".award-document-index")) addDocumentIndex(content);
    return;
  }
  const edition = await obterEdicaoPorAno(year());
  if (!edition) {
    content.innerHTML = "Edição não encontrada.";
    return;
  }
  const canonical = `${location.origin}${awardPath("method", { year: edition.ano })}`;
  document.title = `Metodologia ${edition.ano} | Melhores de Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `Metodologia de apuração da edição ${edition.ano} do Melhores de Urânia.`);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.getElementById("method-copy").innerHTML = `<span class="awards-public-badge">${esc(edition.nome)}</span><h1>Metodologia de <em class="award-accent">apuração</em></h1><p>Entenda como os votos de cada canal entram no resultado.</p>`;
  document.getElementById("method-panel").innerHTML = `<h2>Pesos da edição</h2><p><strong>${Number(edition.peso_site || 0)}%</strong> · Site e aplicativo</p><p><strong>${Number(edition.peso_instagram || 0)}%</strong> · Enquetes</p><p>Percentual de votos do canal × peso do canal.</p><div class="hero-actions"><a class="button button-secondary" href="${awardPath("results", { year: edition.ano })}">Ver resultados</a><a class="button button-secondary" href="${awardPath("rules", { year: edition.ano })}">Regulamento</a></div>`;
  content.classList.add("awards-document");
  content.innerHTML = renderOfficialDocument(edition.metodologia, getDefaultMetodologia(edition.ano));
  addDocumentIndex(content);
}

init().catch(error => {
  console.error("Metodologia Melhores:", error);
  document.getElementById("method-content").innerHTML = "Não foi possível carregar a metodologia.";
});
