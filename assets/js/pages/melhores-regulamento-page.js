import { awardPath, readAwardRoute } from "../melhoresRoutes.mjs";
import { getDefaultRegulamento, renderOfficialDocument } from "../melhoresOfficialTexts.js";
import { obterEdicaoPorAno } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

function year() {
  return Number(readAwardRoute().year || new Date().getFullYear());
}

async function init() {
  const edition = await obterEdicaoPorAno(year());
  const content = document.getElementById("rules-content");
  if (!edition) {
    content.innerHTML = "Edição não encontrada.";
    return;
  }
  const canonical = `${location.origin}${awardPath("rules", { year: edition.ano })}`;
  document.title = `Regulamento ${edition.ano} | Melhores de Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `Regulamento oficial da edição ${edition.ano} do Melhores de Urânia.`);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.getElementById("rules-copy").innerHTML = `<span class="awards-public-badge">Regulamento oficial</span><h1>${esc(edition.nome)}</h1><p>Critérios, períodos, participação e regras oficiais da edição.</p>`;
  document.getElementById("rules-panel").innerHTML = `<h2>Resumo da edição</h2><p><strong>Status:</strong> ${esc(edition.status.replaceAll("_", " "))}</p><p><strong>Votação:</strong> ${esc(edition.votacao_inicio || "a definir")} até ${esc(edition.votacao_fim || "a definir")}</p><a class="button button-secondary" href="${awardPath("edition", { year: edition.ano })}">Voltar para a edição</a>`;
  content.classList.add("awards-document");
  content.innerHTML = renderOfficialDocument(edition.regulamento, getDefaultRegulamento(edition.ano));
}

init().catch(error => {
  console.error("Regulamento Melhores:", error);
  document.getElementById("rules-content").innerHTML = "Não foi possível carregar o regulamento.";
});
