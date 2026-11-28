import { awardPath, readAwardRoute } from "../melhoresRoutes.mjs";
import { obterEdicaoPorAno, obterCategoriaPublica, listarIndicadosPorCategoria, consultarPeriodoVotacao } from "../services/melhoresPublicService.js";
import { sharePage } from "../services/shareService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
let clock = null;
const serverNow = () => clock ? clock.time + (performance.now() - clock.received) : 0;

function params() {
  const { year, slug } = readAwardRoute();
  return { ano: Number(year || new Date().getFullYear()), slug };
}

function isVotingOpen(edition) {
  const now = serverNow();
  return edition?.status === "votacao_aberta"
    && !!edition.votacao_inicio_site
    && new Date(edition.votacao_inicio_site).getTime() <= now
    && !!edition.votacao_fim
    && new Date(edition.votacao_fim).getTime() >= now;
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
    indicacoes_encerradas: "Indicações encerradas",
    votacao_aberta: "Votação aberta",
    votacao_encerrada: "Votação encerrada",
    apuracao: "Apuração",
    resultado_publicado: "Resultado publicado",
    arquivada: "Edição arquivada"
  };
  return labels[status] || String(status || "Status a confirmar").replaceAll("_", " ");
}

function getInitialAwardsBootstrap() {
  try {
    return JSON.parse(document.getElementById("initial-awards-data")?.textContent || "null");
  } catch {
    return null;
  }
}

function slugifyGuideCandidate(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveCategoryNomineeGuideUrl(item) {
  if (!item) return "";
  const embedded = item.guia_comercial;
  if (embedded?.slug && (!embedded.status || embedded.status === "publicado")) {
    return `/guia/${encodeURIComponent(embedded.slug)}`;
  }
  const initial = getInitialAwardsBootstrap();
  const linkedId = item.guia_comercial_id || item.empresa_id;
  if (linkedId && initial?.guideSlugs && Object.prototype.hasOwnProperty.call(initial.guideSlugs, String(linkedId))) {
    return `/guia/${encodeURIComponent(initial.guideSlugs[String(linkedId)])}`;
  }
  const candidateSlug = item.slug || slugifyGuideCandidate(item.nome || "");
  if (candidateSlug && initial?.guideNames && Object.prototype.hasOwnProperty.call(initial.guideNames, candidateSlug)) {
    return `/guia/${encodeURIComponent(initial.guideNames[candidateSlug])}`;
  }
  return "";
}

function nomineeCard(item, year) {
  const img = image(item.imagem_url);
  const guideUrl = resolveCategoryNomineeGuideUrl(item);
  return `<article class="awards-nominee-card awards-category-nominee-card">
    ${img ? `<img src="${img}" alt="${esc(item.nome)}" width="640" height="380" loading="lazy" decoding="async">` : `<div class="awards-category-nominee-empty" aria-hidden="true">${esc(item.nome.trim().charAt(0).toLocaleUpperCase("pt-BR"))}</div>`}
    <div class="awards-card-body">
      ${Number(year) === 2026 ? '<img class="award-nominee-seal" src="/assets/melhores/indicado-2026.png" alt="Indicado em 2026" width="95" height="30" loading="lazy">' : ""}
      <h3>${esc(item.nome)}</h3>
      ${item.descricao_curta ? `<p>${esc(item.descricao_curta)}</p>` : ""}
      ${guideUrl ? `<a class="awards-guide-link" href="${esc(guideUrl)}">Ver no Guia Comercial <span aria-hidden="true">→</span></a>` : ""}
    </div>
  </article>`;
}

function setMeta(edition, category) {
  const canonical = `${location.origin}${awardPath("category", { year: edition.ano, slug: category.slug })}`;
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
  const isSsr = nomineesContainer?.dataset.serverRendered === "true";
  if (isSsr) {
    const initial = getInitialAwardsBootstrap();
    document.querySelector("[data-share-category]")?.addEventListener("click", async () => {
      const title = initial?.category?.nome && initial?.edition?.nome
        ? `${initial.category.nome} | ${initial.edition.nome}`
        : document.title;
      await sharePage({ title, text: `Veja a categoria no Melhores de Urânia.`, url: location.href });
    });
  }
  const edition = await obterEdicaoPorAno(ano).catch(() => null);
  if (edition) {
    const periodState = await consultarPeriodoVotacao(edition.id).catch(() => null);
    if (periodState) {
      clock = { time: new Date(periodState.agora).getTime(), received: performance.now() };
      edition.status = periodState.status;
      edition.votacao_inicio_site = periodState.votacao_inicio_site;
      edition.votacao_fim = periodState.votacao_fim;
    }
  }
  if (!edition) {
    if (!isSsr && nomineesContainer) nomineesContainer.innerHTML = '<div class="awards-empty">Edição não encontrada.</div>';
    return;
  }
  const category = await obterCategoriaPublica(edition.id, slug).catch(() => null);
  if (!category) {
    if (!isSsr && nomineesContainer) nomineesContainer.innerHTML = '<div class="awards-empty">Categoria não encontrada.</div>';
    return;
  }

  const nominees = await listarIndicadosPorCategoria(edition.id, category.id).catch(() => null);
  if (!Array.isArray(nominees)) {
    if (!isSsr && nomineesContainer) nomineesContainer.innerHTML = '<div class="awards-empty">Não foi possível carregar esta categoria.</div>';
    return;
  }
  const votingOpen = isVotingOpen(edition);
  const categoryVoteUrl = awardPath("voting", { year: edition.ano, slug: category.slug });
  const editionUrl = awardPath("edition", { year: edition.ano });

  setMeta(edition, category);

  document.getElementById("category-copy").innerHTML = `
    <span class="awards-public-badge">Categoria ${esc(edition.ano)}</span>
    <h1><em class="award-accent">${esc(category.nome)}</em></h1>
    <p>${esc(category.descricao || "Conheça os indicados desta categoria.")}</p>
    <div class="hero-actions">
      <a class="button button-primary" href="${votingOpen ? categoryVoteUrl : editionUrl}">${votingOpen ? "Votar nesta categoria" : "Ver edição"}</a>
      <a class="button button-secondary" href="${awardPath("voting", { year: edition.ano })}">Central da votação</a>
      <button class="button button-secondary" type="button" data-share-category>Compartilhar</button>
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
      <a class="button button-secondary" href="${awardPath("rules", { year: edition.ano })}">Regulamento</a>
      <a class="button button-secondary" href="${awardPath("permanent", { slug: category.slug })}">Histórico</a>
    </div>`;

  nomineesContainer.innerHTML = nominees.length
    ? `<div class="awards-section-head awards-category-list-head">
        <div>
          <p class="eyebrow">Indicados</p>
          <h2>Participantes da <em class="award-accent">categoria</em></h2>
        </div>
        <p>${nominees.length} nome${nominees.length === 1 ? "" : "s"} publicado${nominees.length === 1 ? "" : "s"} nesta edição.</p>
      </div>
      <div class="awards-nominee-grid">${nominees.map(item => nomineeCard(item, edition.ano)).join("")}</div>`
    : '<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>';

  document.querySelector("[data-share-category]")?.addEventListener("click", async () => {
    await sharePage({
      title: `${category.nome} | ${edition.nome}`,
      text: `Veja a categoria ${category.nome} no ${edition.nome}.`,
      url: location.href
    });
  });
}

init().catch(error => {
  console.error("Categoria Melhores:", error);
  document.getElementById("category-nominees").innerHTML = '<div class="awards-empty">Não foi possível carregar esta categoria.</div>';
});
