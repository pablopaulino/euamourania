import { obterEdicaoPorAno } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const paragraphs = value => esc(value || "Metodologia ainda não publicada para esta edição.").split(/\n+/).map(p => `<p>${p}</p>`).join("");

function year() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})\/metodologia/);
  return Number(match?.[1] || new URLSearchParams(location.search).get("ano") || new Date().getFullYear());
}

async function init() {
  const edition = await obterEdicaoPorAno(year());
  if (!edition) {
    document.getElementById("method-content").innerHTML = "Edição não encontrada.";
    return;
  }
  const canonical = `${location.origin}/melhores-de-urania/${edition.ano}/metodologia/`;
  document.title = `Metodologia ${edition.ano} | Melhores de Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `Metodologia de apuração da edição ${edition.ano} do Melhores de Urânia.`);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.getElementById("method-copy").innerHTML = `<span class="awards-public-badge">Metodologia</span><h1>${esc(edition.nome)}</h1><p>Como os votos do site e Instagram são normalizados e ponderados.</p>`;
  document.getElementById("method-panel").innerHTML = `<h2>Pesos</h2><p>Site: ${Number(edition.peso_site || 0)}%</p><p>Instagram: ${Number(edition.peso_instagram || 0)}%</p><p>Fórmula: percentual do canal × peso do canal.</p>`;
  document.getElementById("method-content").innerHTML = paragraphs(edition.metodologia);
}

init().catch(error => {
  console.error("Metodologia Melhores:", error);
  document.getElementById("method-content").innerHTML = "Não foi possível carregar a metodologia.";
});
