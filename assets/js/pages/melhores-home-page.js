import { listarEdicoesPublicas } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const statusLabel = value => String(value || "").replaceAll("_", " ");
const url = edition => `/melhores-de-urania/${encodeURIComponent(edition.ano)}/`;

function pickEdition(editions) {
  return editions.find(item => item.status === "votacao_aberta")
    || editions.find(item => item.status === "resultado_publicado")
    || editions.find(item => ["indicacoes_abertas", "apuracao", "votacao_encerrada"].includes(item.status))
    || null;
}

function render(edition) {
  const anchor = document.querySelector(".quick-access");
  if (!anchor || document.querySelector("[data-awards-home]")) return;
  const cover = image(edition.imagem_capa_url);
  const isResults = edition.status === "resultado_publicado";
  const href = isResults ? `/melhores-de-urania/${encodeURIComponent(edition.ano)}/resultados/` : url(edition);
  const section = document.createElement("section");
  section.className = "home-awards";
  section.dataset.awardsHome = "true";
  section.innerHTML = `<div class="container home-awards-box">
    <div class="home-awards-copy">
      <p class="eyebrow">Votação popular</p>
      <h2>Melhores de Urânia</h2>
      <p>${esc(edition.descricao || "Acompanhe a premiação que valoriza empresas, profissionais e experiências da nossa cidade.")}</p>
      <div class="home-awards-actions">
        <a class="button button-primary" href="${href}" data-awards-home-cta data-edition-id="${edition.id}">${isResults ? "Ver resultados" : "Participar agora"}</a>
        <a class="button button-secondary" href="/melhores-de-urania/" data-awards-home-cta data-edition-id="${edition.id}">Todas as edições</a>
      </div>
    </div>
    <div class="home-awards-card">
      ${cover ? `<img src="${cover}" alt="${esc(edition.nome)}" loading="lazy">` : ""}
      <span>${esc(statusLabel(edition.status))}</span>
      <strong>${esc(edition.nome)}</strong>
      <small>Site ${Number(edition.peso_site || 0)}% · Instagram ${Number(edition.peso_instagram || 0)}%</small>
    </div>
  </div>`;
  anchor.after(section);
  section.querySelectorAll("[data-awards-home-cta]").forEach(link => {
    link.addEventListener("click", () => registrarEventoMelhores("melhores_cta_click", {
      edicaoId: link.dataset.editionId || null,
      destino: link.href,
      metadados: { origem_cta: "home" }
    }));
  });
}

async function init() {
  try {
    const editions = await listarEdicoesPublicas();
    const edition = pickEdition(editions);
    if (edition) render(edition);
  } catch (error) {
    console.debug("Melhores de Urânia na home indisponível:", error?.message || error);
  }
}

init();
