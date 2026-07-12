import { listarEdicoesPublicas } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const img = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const statusLabel = value => String(value || "").replaceAll("_", " ");
const editionUrl = edition => `/melhores-de-urania/${encodeURIComponent(edition.ano)}/`;

function period(start, end) {
  if (!start && !end) return "Período a confirmar";
  const format = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "a confirmar";
  return `${format(start)} — ${format(end)}`;
}

function activeEdition(editions) {
  return editions.find(item => ["votacao_aberta", "indicacoes_abertas", "apuracao", "resultado_publicado"].includes(item.status)) || editions[0];
}

function editionCard(edition) {
  const image = img(edition.imagem_capa_url);
  return `<article class="awards-edition-card">
    ${image ? `<img src="${image}" alt="${esc(edition.nome)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      <span class="awards-chip ${edition.status === "votacao_aberta" ? "open" : ""}">${esc(statusLabel(edition.status))}</span>
      <h3>${esc(edition.nome)}</h3>
      <p>${esc(edition.descricao || "Edição oficial da premiação Melhores de Urânia.")}</p>
      <p><small>Votação: ${esc(period(edition.votacao_inicio, edition.votacao_fim))}</small></p>
      <a class="button button-primary" href="${editionUrl(edition)}">Abrir edição</a>
    </div>
  </article>`;
}

async function init() {
  try {
    const editions = await listarEdicoesPublicas();
    const list = document.getElementById("awards-editions");
    const hero = document.getElementById("active-edition-card");
    if (!editions.length) {
      if (list) list.innerHTML = '<div class="awards-empty">Nenhuma edição pública no momento.</div>';
      if (hero) hero.innerHTML = '<div class="awards-empty">A próxima edição será anunciada em breve.</div>';
      return;
    }
    const active = activeEdition(editions);
    if (hero) {
      const image = img(active.imagem_capa_url);
      hero.innerHTML = `${image ? `<img src="${image}" alt="${esc(active.nome)}">` : ""}
        <h2>${esc(active.nome)}</h2>
        <p>${esc(active.descricao || "Acompanhe a edição atual da premiação.")}</p>
        <div class="awards-status-line">
          <span class="awards-chip ${active.status === "votacao_aberta" ? "open" : ""}">${esc(statusLabel(active.status))}</span>
          <span class="awards-chip">Site ${Number(active.peso_site || 0)}% · Instagram ${Number(active.peso_instagram || 0)}%</span>
        </div>
        <p style="margin-top:1rem"><a class="button button-primary" href="${editionUrl(active)}">Ver edição ${esc(active.ano)}</a></p>`;
    }
    if (list) list.innerHTML = editions.map(editionCard).join("");
  } catch (error) {
    console.error("Melhores de Urânia:", error);
    document.getElementById("awards-editions").innerHTML = '<div class="awards-empty">Não foi possível carregar as edições agora.</div>';
  }
}

init();
