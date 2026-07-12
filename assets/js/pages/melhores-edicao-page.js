import { obterEdicaoPorAno, listarCategoriasPublicas, listarIndicadosPublicos, enviarVotoMelhores } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const key = editionId => `euamourania:melhores:votos:${editionId}`;

function getYear() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})/);
  const query = new URLSearchParams(location.search).get("ano");
  return Number(match?.[1] || query || new Date().getFullYear());
}

function readVotes(editionId) {
  try { return JSON.parse(localStorage.getItem(key(editionId)) || "{}"); } catch { return {}; }
}

function saveVote(editionId, categoryId, nomineeId) {
  const votes = readVotes(editionId);
  votes[categoryId] = nomineeId;
  localStorage.setItem(key(editionId), JSON.stringify(votes));
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "A confirmar";
}

function isVotingOpen(edition) {
  const now = Date.now();
  return edition?.status === "votacao_aberta"
    && (!edition.votacao_inicio || new Date(edition.votacao_inicio).getTime() <= now)
    && (!edition.votacao_fim || new Date(edition.votacao_fim).getTime() >= now);
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "awards-toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4200);
}

function setMeta(edition) {
  const title = `${edition.nome} | Melhores de Urânia`;
  const description = (edition.descricao || "Participe da votação popular do Eu Amo Urânia.").slice(0, 155);
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  const canonical = `${location.origin}/melhores-de-urania/${edition.ano}/`;
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(edition.imagem_capa_url || "/assets/AD3A1763-min%20(1).jpg", location.origin).href);
}

function renderHero(edition, open) {
  const copy = document.getElementById("edition-copy");
  const panel = document.getElementById("edition-panel");
  if (copy) {
    copy.innerHTML = `<span class="awards-public-badge">Uma realização Eu Amo Urânia</span>
      <h1>${esc(edition.nome)}</h1>
      <p>${esc(edition.descricao || "Escolha seus favoritos nas categorias da premiação.")}</p>
      <div class="hero-actions"><a class="button button-primary" href="#vote-area">${open ? "Votar agora" : "Ver indicados"}</a><a class="button button-secondary" href="/melhores-de-urania/">Todas as edições</a></div>`;
  }
  if (panel) {
    const cover = image(edition.imagem_capa_url);
    panel.innerHTML = `${cover ? `<img src="${cover}" alt="${esc(edition.nome)}">` : ""}
      <h2>Status da edição</h2>
      <div class="awards-status-line">
        <span class="awards-chip ${open ? "open" : "closed"}">${esc(edition.status.replaceAll("_", " "))}</span>
        <span class="awards-chip">Votação: ${esc(formatDate(edition.votacao_inicio))}</span>
      </div>
      <p><strong>Encerramento:</strong> ${esc(formatDate(edition.votacao_fim || edition.encerramento_em))}</p>
      <p><strong>Pesos:</strong> Site ${Number(edition.peso_site || 0)}% · Instagram ${Number(edition.peso_instagram || 0)}%</p>`;
  }
}

function nomineeCard(edition, category, nominee, open, votedId) {
  const voted = votedId === nominee.id;
  const img = image(nominee.imagem_url);
  return `<article class="awards-nominee-card ${voted ? "awards-voted" : ""}">
    ${img ? `<img src="${img}" alt="${esc(nominee.nome)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      <h3>${esc(nominee.nome)}</h3>
      <p>${esc(nominee.descricao_curta || "Indicado ao Melhores de Urânia.")}</p>
      ${nominee.instagram ? `<p><small>Instagram: ${esc(nominee.instagram)}</small></p>` : ""}
      <button class="button button-primary awards-vote-button" data-vote data-edition="${edition.id}" data-category="${category.id}" data-nominee="${nominee.id}" ${open && !voted ? "" : "disabled"}>
        ${voted ? "Voto registrado" : open ? "Votar" : "Votação fechada"}
      </button>
    </div>
  </article>`;
}

function renderVoting(edition, categories, nominees) {
  const area = document.getElementById("vote-area");
  const open = isVotingOpen(edition);
  const votes = readVotes(edition.id);
  document.getElementById("vote-status-copy").textContent = open
    ? "Escolha um indicado por categoria. O sistema registra seu voto com validação segura."
    : "A votação não está aberta agora. Você pode conferir as categorias e indicados publicados.";
  if (!categories.length) {
    area.innerHTML = '<div class="awards-empty">Nenhuma categoria pública nesta edição.</div>';
    return;
  }
  const grouped = new Map(categories.map(category => [category.id, nominees.filter(n => n.categoria_id === category.id)]));
  area.innerHTML = `<aside class="awards-category-nav" aria-label="Categorias">${categories.map((category, index) => `<button type="button" data-scroll-category="${category.id}" class="${index === 0 ? "active" : ""}">${esc(category.nome)}</button>`).join("")}</aside>
    <div class="awards-nominees">
      ${categories.map(category => {
        const items = grouped.get(category.id) || [];
        return `<section class="awards-nominee-group" id="categoria-${category.id}">
          <header><h3>${esc(category.nome)}</h3><p>${esc(category.descricao || "Escolha seu indicado favorito.")}</p></header>
          ${items.length ? `<div class="awards-nominee-grid">${items.map(nominee => nomineeCard(edition, category, nominee, open, votes[category.id])).join("")}</div>` : '<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>'}
        </section>`;
      }).join("")}
    </div>`;
}

async function init() {
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      document.getElementById("vote-area").innerHTML = '<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>';
      return;
    }
    const open = isVotingOpen(edition);
    setMeta(edition);
    renderHero(edition, open);
    const [categories, nominees] = await Promise.all([
      listarCategoriasPublicas(edition.id),
      listarIndicadosPublicos(edition.id)
    ]);
    renderVoting(edition, categories, nominees);
  } catch (error) {
    console.error("Melhores de Urânia:", error);
    document.getElementById("vote-area").innerHTML = '<div class="awards-empty">Não foi possível carregar esta edição agora.</div>';
  }
}

document.addEventListener("click", async event => {
  const scroll = event.target.closest("[data-scroll-category]");
  if (scroll) {
    document.querySelectorAll("[data-scroll-category]").forEach(button => button.classList.toggle("active", button === scroll));
    document.getElementById(`categoria-${scroll.dataset.scrollCategory}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const vote = event.target.closest("[data-vote]");
  if (!vote || vote.disabled) return;
  vote.disabled = true;
  vote.textContent = "Registrando…";
  try {
    await enviarVotoMelhores({
      edicao_id: vote.dataset.edition,
      categoria_id: vote.dataset.category,
      indicado_id: vote.dataset.nominee,
      origem: "site",
      pagina: location.pathname
    });
    saveVote(vote.dataset.edition, vote.dataset.category, vote.dataset.nominee);
    document.querySelectorAll(`[data-category="${vote.dataset.category}"]`).forEach(button => {
      button.disabled = true;
      button.textContent = button === vote ? "Voto registrado" : "Voto já registrado";
      button.closest(".awards-nominee-card")?.classList.toggle("awards-voted", button === vote);
    });
    toast("Voto registrado com sucesso. Obrigado por participar!");
  } catch (error) {
    vote.disabled = false;
    vote.textContent = "Votar";
    toast(error.message);
  }
});

init();
