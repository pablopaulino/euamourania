import { awardPath, readAwardRoute } from "../melhoresRoutes.mjs";
import { getDefaultRegulamento, renderOfficialDocument, addDocumentIndex } from "../melhoresOfficialTexts.js";
import { obterEdicaoPorAno } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

function year() {
  return Number(readAwardRoute().year || new Date().getFullYear());
}

async function init() {
  const content = document.getElementById("rules-content");
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
  const canonical = `${location.origin}${awardPath("rules", { year: edition.ano })}`;
  document.title = `Regulamento ${edition.ano} | Melhores de Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `Regulamento oficial da edição ${edition.ano} do Melhores de Urânia.`);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  const date = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "a definir";
  document.getElementById("rules-copy").innerHTML = `<span class="awards-public-badge">${esc(edition.nome)}</span><h1>Regulamento <em class="award-accent">oficial</em></h1><p>Consulte as regras de participação e os prazos desta edição.</p>`;
  document.getElementById("rules-panel").innerHTML = `<h2>Período de votação</h2><p>${date(edition.votacao_inicio)} até ${date(edition.votacao_fim)}</p><p>${esc(edition.status.replaceAll("_", " "))}</p><div class="hero-actions"><a class="button button-secondary" href="${awardPath("edition", { year: edition.ano })}">Ver edição</a><a class="button button-secondary" href="${awardPath("method", { year: edition.ano })}">Metodologia</a></div>`;
  content.classList.add("awards-document");
  content.innerHTML = renderOfficialDocument(edition.regulamento, getDefaultRegulamento(edition.ano));
  addDocumentIndex(content);
}

init().catch(error => {
  console.error("Regulamento Melhores:", error);
  document.getElementById("rules-content").innerHTML = "Não foi possível carregar o regulamento.";
});
