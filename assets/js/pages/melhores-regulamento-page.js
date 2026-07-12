import { obterEdicaoPorAno } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const paragraphs = value => esc(value || "Regulamento ainda não publicado para esta edição.").split(/\n+/).map(p => `<p>${p}</p>`).join("");

function year() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})\/regulamento/);
  return Number(match?.[1] || new URLSearchParams(location.search).get("ano") || new Date().getFullYear());
}

async function init() {
  const edition = await obterEdicaoPorAno(year());
  if (!edition) {
    document.getElementById("rules-content").innerHTML = "Edição não encontrada.";
    return;
  }
  const canonical = `${location.origin}/melhores-de-urania/${edition.ano}/regulamento/`;
  document.title = `Regulamento ${edition.ano} | Melhores de Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `Regulamento oficial da edição ${edition.ano} do Melhores de Urânia.`);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.getElementById("rules-copy").innerHTML = `<span class="awards-public-badge">Regulamento</span><h1>${esc(edition.nome)}</h1><p>Critérios, períodos, participação e regras oficiais da edição.</p>`;
  document.getElementById("rules-panel").innerHTML = `<h2>Status</h2><p>${esc(edition.status.replaceAll("_", " "))}</p><p>Votação: ${esc(edition.votacao_inicio || "a definir")} até ${esc(edition.votacao_fim || "a definir")}</p>`;
  document.getElementById("rules-content").innerHTML = paragraphs(edition.regulamento);
}

init().catch(error => {
  console.error("Regulamento Melhores:", error);
  document.getElementById("rules-content").innerHTML = "Não foi possível carregar o regulamento.";
});
