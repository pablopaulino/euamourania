import {
  obterEdicaoPorAno,
  listarCategoriasPublicas,
  listarIndicadosPublicos,
  enviarVotoMelhores
} from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { TURNSTILE_SITE_KEY } from "../supabase-config.js";

const root = document.getElementById("awards-voting-root");
const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const voteStorageKey = editionId => `euamourania:melhores:votos:${editionId}`;

function getYear() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})/);
  const query = new URLSearchParams(location.search).get("ano");
  return Number(match?.[1] || query || new Date().getFullYear());
}

function getCategorySlug() {
  const match = location.pathname.match(/melhores-de-urania\/\d{4}\/votacao\/([^/?#]+)/);
  const query = new URLSearchParams(location.search).get("categoria");
  return match?.[1] ? decodeURIComponent(match[1]) : (query || "");
}

function readVotes(editionId) {
  try { return JSON.parse(localStorage.getItem(voteStorageKey(editionId)) || "{}"); } catch { return {}; }
}

function votesFor(votes, categoryId) {
  const value = votes[categoryId];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function saveVote(editionId, categoryId, nomineeId) {
  const votes = readVotes(editionId);
  const current = votesFor(votes, categoryId);
  if (!current.includes(nomineeId)) current.push(nomineeId);
  votes[categoryId] = current;
  localStorage.setItem(voteStorageKey(editionId), JSON.stringify(votes));
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

function getVotableCategories(categories, nominees) {
  const grouped = new Map(categories.map(category => [category.id, nominees.filter(item => item.categoria_id === category.id)]));
  return categories.filter(category => (grouped.get(category.id) || []).length > 0);
}

function progressFor(edition, categories, nominees) {
  const votes = readVotes(edition.id);
  const votable = getVotableCategories(categories, nominees);
  const completed = votable.filter(category => votesFor(votes, category.id).length > 0);
  const total = votable.length;
  const percent = total ? Math.round((completed.length / total) * 100) : 0;
  const next = votable.find(category => votesFor(votes, category.id).length === 0) || null;
  return { votes, votable, completed, total, percent, next };
}

function votingUrl(edition, category) {
  return `/melhores-de-urania/${edition.ano}/votacao/${encodeURIComponent(category.slug)}/`;
}

function hubUrl(edition) {
  return `/melhores-de-urania/${edition.ano}/votacao/`;
}

function editionUrl(edition) {
  return `/melhores-de-urania/${edition.ano}/`;
}

function setMeta(edition, suffix = "Votação") {
  const title = `${suffix} | ${edition.nome}`;
  const description = `Participe da votação oficial do ${edition.nome}.`;
  const canonical = `${location.origin}${hubUrl(edition)}`;
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(edition.imagem_capa_url || "/assets/compartilhamento-logo.png", location.origin).href);
}

function toast(message) {
  const el = document.createElement("div");
  el.className = "awards-toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.remove(), 4200);
}

const turnstileSiteKey = () => window.EUAM_TURNSTILE_SITE_KEY
  || document.querySelector('meta[name="turnstile-site-key"]')?.getAttribute("content")
  || TURNSTILE_SITE_KEY
  || "";
let turnstileLoadPromise;
let turnstileWidgetId = null;

function loadTurnstile() {
  if (!turnstileSiteKey()) return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (turnstileLoadPromise) return turnstileLoadPromise;
  turnstileLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Não foi possível carregar a verificação de segurança."));
    document.head.append(script);
  });
  return turnstileLoadPromise;
}

async function getTurnstileToken(action = "vote") {
  const sitekey = turnstileSiteKey();
  if (!sitekey) throw new Error("Votação indisponível: chave pública do Turnstile não configurada.");
  await loadTurnstile();
  return new Promise((resolve, reject) => {
    let container = document.getElementById("awards-turnstile");
    if (!container) {
      container = document.createElement("div");
      container.id = "awards-turnstile";
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.bottom = "0";
      document.body.append(container);
    }
    if (turnstileWidgetId !== null) {
      try { window.turnstile.remove(turnstileWidgetId); } catch {}
    }
    const timeout = setTimeout(() => reject(new Error("A verificação de segurança demorou demais. Tente novamente.")), 12000);
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey,
      size: "invisible",
      action,
      callback: token => {
        clearTimeout(timeout);
        resolve(token);
      },
      "error-callback": () => {
        clearTimeout(timeout);
        reject(new Error("Não foi possível validar a segurança. Tente novamente."));
      }
    });
    window.turnstile.execute(turnstileWidgetId);
  });
}

function progressCard(edition, categories, nominees) {
  const progress = progressFor(edition, categories, nominees);
  const remaining = Math.max(0, progress.total - progress.completed.length);
  const nextLink = progress.next ? votingUrl(edition, progress.next) : `${hubUrl(edition)}?concluido=1`;
  const ctaLabel = progress.completed.length ? "Continuar de onde parei" : "Começar votação";
  return `
    <article class="awards-voting-progress">
      <div class="awards-voting-progress-copy">
        <p class="eyebrow">Votação oficial</p>
        <h1>${esc(edition.nome)}</h1>
        <p>Uma experiência simples para escolher quem faz Urânia acontecer. Vote categoria por categoria, no seu ritmo.</p>
      </div>
      <div class="awards-progress-card">
        <span class="awards-progress-kicker">Sua votação</span>
        <div class="awards-progress-numbers">
          <span><strong>${progress.completed.length}</strong><small>votadas</small></span>
          <span><strong>${remaining}</strong><small>restantes</small></span>
          <span><strong>${progress.percent}%</strong><small>concluído</small></span>
        </div>
        <div class="awards-progress-bar" aria-label="${progress.percent}% concluído">
          <span style="width:${progress.percent}%"></span>
        </div>
        <a class="button button-primary awards-continue-button" href="${nextLink}" data-awards-vote-continue>${progress.total && progress.percent === 100 ? "Ver conclusão" : ctaLabel}</a>
      </div>
    </article>`;
}

function progressStrip(edition, categories, nominees) {
  const progress = progressFor(edition, categories, nominees);
  return `
    <div class="awards-voting-strip" aria-label="Progresso da votação">
      <span>Sua votação</span>
      <div class="awards-progress-bar" aria-label="${progress.percent}% concluído">
        <span style="width:${progress.percent}%"></span>
      </div>
      <strong>${progress.percent}%</strong>
      <a href="${hubUrl(edition)}">Categorias</a>
    </div>`;
}

function renderHub(edition, categories, nominees) {
  setMeta(edition, "Central da votação");
  const open = isVotingOpen(edition);
  if (!open) {
    root.innerHTML = `
      <section class="awards-voting-closed">
        <p class="eyebrow">Votação oficial</p>
        <h1>${esc(edition.nome)}</h1>
        <p>A votação não está aberta agora. Período previsto: ${esc(formatDate(edition.votacao_inicio))} até ${esc(formatDate(edition.votacao_fim))}.</p>
        <a class="button button-primary" href="${editionUrl(edition)}">Voltar para a edição</a>
      </section>`;
    return;
  }

  const progress = progressFor(edition, categories, nominees);
  const showDone = new URLSearchParams(location.search).has("concluido") || (progress.total > 0 && progress.percent === 100);
  if (showDone) {
    renderCompletion(edition, categories, nominees);
    return;
  }

  const grouped = new Map(categories.map(category => [category.id, nominees.filter(item => item.categoria_id === category.id)]));
  root.innerHTML = `
    ${progressCard(edition, categories, nominees)}
    <section class="awards-voting-panel">
      <div class="awards-voting-panel-head">
        <div>
          <p class="eyebrow">Continue de onde parou</p>
          <h2>Sua votação</h2>
        </div>
        <p>Veja o que já foi escolhido e avance pelas categorias abertas.</p>
      </div>
      <div class="awards-voting-categories">
        ${categories.map(category => {
          const total = grouped.get(category.id)?.length || 0;
          const voted = votesFor(progress.votes, category.id).length > 0;
          const disabled = !total;
          return `<a class="awards-voting-category ${voted ? "done" : ""} ${disabled ? "disabled" : ""}" href="${disabled ? "#" : votingUrl(edition, category)}" ${disabled ? 'aria-disabled="true"' : ""}>
            <span class="awards-voting-check">${voted ? "✓" : "→"}</span>
            <strong>${esc(category.nome)}</strong>
            <small>${total ? `${total} indicado${total === 1 ? "" : "s"}` : "sem indicados publicados"}</small>
          </a>`;
        }).join("")}
      </div>
    </section>`;
}

function nomineeButton(edition, category, nominee, votes) {
  const votedList = votesFor(votes, category.id);
  const voted = votedList.includes(nominee.id);
  const maxChoices = category.permite_multiplos_votos ? Math.max(1, Number(category.max_escolhas || 1)) : 1;
  const reachedLimit = votedList.length >= maxChoices;
  const img = image(nominee.imagem_url);
  return `
    <article class="awards-voting-nominee ${voted ? "selected" : ""}">
      ${img ? `<img src="${img}" alt="${esc(nominee.nome)}" loading="lazy">` : `<div class="awards-voting-nominee-empty">Eu Amo Urânia</div>`}
      <div class="awards-voting-nominee-copy">
        <h3>${esc(nominee.nome)}</h3>
        ${nominee.descricao_curta ? `<p>${esc(nominee.descricao_curta)}</p>` : ""}
      </div>
      <button class="button button-primary awards-vote-control" type="button" data-vote data-edition="${edition.id}" data-category="${category.id}" data-nominee="${nominee.id}" data-max-choices="${maxChoices}" ${voted || reachedLimit ? "disabled" : ""}>
        ${voted ? "Voto registrado" : reachedLimit ? "Limite atingido" : "Votar"}
      </button>
    </article>`;
}

function renderCategory(edition, categories, nominees, slug) {
  const category = categories.find(item => item.slug === slug);
  if (!category) {
    root.innerHTML = `<div class="awards-empty">Categoria não encontrada nesta edição.</div>`;
    return;
  }
  setMeta(edition, category.nome);
  const open = isVotingOpen(edition);
  const progress = progressFor(edition, categories, nominees);
  const items = nominees.filter(item => item.categoria_id === category.id);
  const index = progress.votable.findIndex(item => item.id === category.id);
  const previous = index > 0 ? progress.votable[index - 1] : null;
  const next = index >= 0 && index < progress.votable.length - 1 ? progress.votable[index + 1] : null;
  const categoryVotes = votesFor(progress.votes, category.id);
  const nextHref = next ? votingUrl(edition, next) : `${hubUrl(edition)}?concluido=1`;

  if (!open) {
    renderHub(edition, categories, nominees);
    return;
  }

  root.innerHTML = `
    <a class="awards-voting-back" href="${hubUrl(edition)}">← Central da votação</a>
    ${progressStrip(edition, categories, nominees)}
    <section class="awards-voting-panel awards-voting-category-panel">
      <div class="awards-voting-panel-head">
        <div>
          <p class="eyebrow">Categoria ${index + 1} de ${progress.votable.length}</p>
          <h2>${esc(category.nome)}</h2>
        </div>
        <p>${esc(category.descricao || "Escolha seu indicado favorito.")}</p>
      </div>
      ${items.length ? `<div class="awards-voting-nominees">${items.map(nominee => nomineeButton(edition, category, nominee, progress.votes)).join("")}</div>` : `<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>`}
      <nav class="awards-voting-flow" aria-label="Navegação da votação">
        ${previous ? `<a class="button button-secondary" href="${votingUrl(edition, previous)}">Categoria anterior</a>` : `<a class="button button-secondary" href="${hubUrl(edition)}">Central</a>`}
        <a class="button button-primary ${categoryVotes.length ? "" : "disabled"}" href="${nextHref}" data-next-category>${next ? "Próxima categoria" : "Finalizar participação"}</a>
      </nav>
    </section>`;
}

function renderCompletion(edition, categories, nominees) {
  const progress = progressFor(edition, categories, nominees);
  const shareUrl = `${location.origin}${editionUrl(edition)}`;
  root.innerHTML = `
    <section class="awards-voting-complete">
      <span class="awards-complete-icon" aria-hidden="true">✓</span>
      <p class="eyebrow">Participação registrada</p>
      <h1>Obrigado por participar!</h1>
      <p>Seu progresso mostra ${progress.completed.length} categoria${progress.completed.length === 1 ? "" : "s"} votada${progress.completed.length === 1 ? "" : "s"} nesta edição.</p>
      <div class="awards-progress-card compact">
        <div class="awards-progress-numbers">
          <span><strong>${progress.completed.length}</strong><small>votadas</small></span>
          <span><strong>${progress.total}</strong><small>categorias</small></span>
          <span><strong>${progress.percent}%</strong><small>concluído</small></span>
        </div>
        <div class="awards-progress-bar"><span style="width:${progress.percent}%"></span></div>
      </div>
      <div class="hero-actions">
        <button class="button button-primary" type="button" data-share-voting>Compartilhar votação</button>
        <a class="button button-secondary" href="${hubUrl(edition)}">Ver categorias</a>
        <a class="button button-secondary" href="${editionUrl(edition)}">Voltar para a edição</a>
      </div>
    </section>`;
  root.querySelector("[data-share-voting]")?.addEventListener("click", async () => {
    registrarEventoMelhores("melhores_share_click", {
      edicaoId: edition.id,
      destino: shareUrl,
      metadados: { canal: "native_conclusao" }
    });
    if (navigator.share) {
      await navigator.share({
        title: `Vote no ${edition.nome}`,
        text: "Participe da votação do Melhores de Urânia.",
        url: shareUrl
      }).catch(() => null);
      return;
    }
    await navigator.clipboard?.writeText(shareUrl).catch(() => null);
    toast("Link copiado.");
  });
}

async function handleVote(event, edition, categories, nominees) {
  const button = event.target.closest("[data-vote]");
  if (!button || button.disabled) return;
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = "Registrando…";
  registrarEventoMelhores("melhores_vote_start", {
    edicaoId: button.dataset.edition,
    metadados: { categoria_id: button.dataset.category, indicado_id: button.dataset.nominee, origem_fluxo: "central_votacao" }
  });
  try {
    const turnstileToken = await getTurnstileToken("vote");
    await enviarVotoMelhores({
      edicao_id: button.dataset.edition,
      categoria_id: button.dataset.category,
      indicado_id: button.dataset.nominee,
      origem: "site",
      pagina: location.pathname,
      turnstile_token: turnstileToken
    });
    saveVote(button.dataset.edition, button.dataset.category, button.dataset.nominee);
    registrarEventoMelhores("melhores_vote_complete", {
      edicaoId: button.dataset.edition,
      metadados: { categoria_id: button.dataset.category, indicado_id: button.dataset.nominee, origem_fluxo: "central_votacao" }
    });
    toast("Voto registrado com sucesso.");
    renderCategory(edition, categories, nominees, getCategorySlug());
  } catch (error) {
    button.disabled = false;
    button.textContent = oldText;
    registrarEventoMelhores("melhores_vote_error", {
      edicaoId: button.dataset.edition,
      metadados: { categoria_id: button.dataset.category, indicado_id: button.dataset.nominee, erro: error.message, origem_fluxo: "central_votacao" }
    });
    toast(error.message);
  }
}

async function init() {
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      root.innerHTML = `<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>`;
      return;
    }
    const [categories, nominees] = await Promise.all([
      listarCategoriasPublicas(edition.id),
      listarIndicadosPublicos(edition.id)
    ]);
    registrarEventoMelhores("melhores_voting_center_view", {
      edicaoId: edition.id,
      metadados: { ano: edition.ano, categoria: getCategorySlug() || null }
    });
    const slug = getCategorySlug();
    if (slug) {
      renderCategory(edition, categories, nominees, slug);
    } else {
      renderHub(edition, categories, nominees);
    }
    root.addEventListener("click", event => handleVote(event, edition, categories, nominees));
  } catch (error) {
    console.error("Central de votação:", error);
    root.innerHTML = `<div class="awards-empty">Não foi possível carregar a votação agora.</div>`;
  }
}

init();
