import { obterEdicaoPorAno, obterCategoriaPublica, listarIndicadosPorCategoria } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";

function params() {
  const path = location.pathname.match(/melhores-de-urania\/(\d{4})\/categorias\/([^/]+)/);
  const query = new URLSearchParams(location.search);
  return {
    ano: Number(path?.[1] || query.get("ano") || new Date().getFullYear()),
    slug: path?.[2] ? decodeURIComponent(path[2]) : query.get("categoria") || ""
  };
}

function isVotingOpen(edition) {
  const now = Date.now();
  return edition?.status === "votacao_aberta"
    && (!edition.votacao_inicio || new Date(edition.votacao_inicio).getTime() <= now)
    && (!edition.votacao_fim || new Date(edition.votacao_fim).getTime() >= now);
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value)) : "A confirmar";
}

function statusLabel(status = "") {
  const labels = {
    indicacoes_abertas: "Indicações abertas",
    votacao_aberta: "Votação aberta",
    votacao_encerrada: "Votação encerrada",
    resultado_publicado: "Resultado publicado"
  };
  return labels[status] || String(status || "Status a confirmar").replaceAll("_", " ");
}

function nomineeCard(item) {
  const img = image(item.imagem_url);
  return `<article class="awards-nominee-card awards-category-nominee-card">
    ${img ? `<img src="${img}" alt="${esc(item.nome)}" loading="lazy">` : `<div class="awards-category-nominee-empty">Eu Amo Urânia</div>`}
    <div class="awards-card-body">
      <h3>${esc(item.nome)}</h3>
      ${item.descricao_curta ? `<p>${esc(item.descricao_curta)}</p>` : ""}
    </div>
  </article>`;
}

function setMeta(edition, category) {
  const canonical = `${location.origin}/melhores-de-urania/${edition.ano}/categorias/${category.slug}/`;
  const description = (category.descricao || `Conheça os indicados da categoria ${category.nome} no ${edition.nome}.`).slice(0, 155);
  document.title = `${category.nome} | ${edition.nome} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${category.nome} | ${edition.nome}`);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(category.imagem_url || edition.imagem_capa_url || "/assets/compartilhamento-logo.png", location.origin).href);
}

async function init() {
  const { ano, slug } = params();
  const nomineesContainer = document.getElementById("category-nominees");
  const edition = await obterEdicaoPorAno(ano);
  if (!edition) {
    nomineesContainer.innerHTML = '<div class="awards-empty">Edição não encontrada.</div>';
    return;
  }
  const category = await obterCategoriaPublica(edition.id, slug);
  if (!category) {
    nomineesContainer.innerHTML = '<div class="awards-empty">Categoria não encontrada.</div>';
    return;
  }

  const nominees = await listarIndicadosPorCategoria(edition.id, category.id);
  const votingOpen = isVotingOpen(edition);
  const categoryVoteUrl = `/melhores-de-urania/${edition.ano}/votacao/${encodeURIComponent(category.slug)}/`;
  const editionUrl = `/melhores-de-urania/${edition.ano}/`;

  setMeta(edition, category);

  document.getElementById("category-copy").innerHTML = `
    <span class="awards-public-badge">Categoria ${esc(edition.ano)}</span>
    <h1>${esc(category.nome)}</h1>
    <p>${esc(category.descricao || "Conheça os indicados desta categoria.")}</p>
    <div class="hero-actions">
      <a class="button button-primary" href="${votingOpen ? categoryVoteUrl : editionUrl}">${votingOpen ? "Votar nesta categoria" : "Ver edição"}</a>
      <a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/votacao/">Central da votação</a>
    </div>`;

  document.getElementById("category-panel").innerHTML = `
    <p class="awards-edition-kicker">Melhores de Urânia ${esc(edition.ano)}</p>
    <h2>${esc(category.nome)}</h2>
    <div class="awards-status-line">
      <span class="awards-chip ${votingOpen ? "open" : "closed"}">${esc(statusLabel(edition.status))}</span>
      <span class="awards-chip">${nominees.length} indicado${nominees.length === 1 ? "" : "s"}</span>
      <span class="awards-chip">${Number(category.max_escolhas || 1)} escolha${Number(category.max_escolhas || 1) === 1 ? "" : "s"} por voto</span>
    </div>
    <p>${votingOpen ? `Votação aberta até ${esc(formatDate(edition.votacao_fim))}.` : "Esta página permanece como referência pública da categoria nesta edição."}</p>
    <div class="awards-category-panel-actions">
      <a class="button button-primary" href="${votingOpen ? categoryVoteUrl : editionUrl}">${votingOpen ? "Votar agora" : "Ver página da edição"}</a>
      <a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/regulamento/">Regulamento</a>
    </div>`;

  nomineesContainer.innerHTML = nominees.length
    ? `<div class="awards-section-head awards-category-list-head">
        <div>
          <p class="eyebrow">Indicados</p>
          <h2>Participantes da categoria</h2>
        </div>
        <p>${nominees.length} nome${nominees.length === 1 ? "" : "s"} publicado${nominees.length === 1 ? "" : "s"} nesta edição.</p>
      </div>
      <div class="awards-nominee-grid">${nominees.map(nomineeCard).join("")}</div>`
    : '<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>';
}

init().catch(error => {
  console.error("Categoria Melhores:", error);
  document.getElementById("category-nominees").innerHTML = '<div class="awards-empty">Não foi possível carregar esta categoria.</div>';
});
