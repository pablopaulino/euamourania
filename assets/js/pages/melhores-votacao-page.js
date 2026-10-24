import {
  obterEdicaoPorAno,
  listarCategoriasPublicas,
  listarIndicadosPublicos,
  enviarVotoMelhores,
  consultarPeriodoVotacao
} from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { getAppDownloadConfig } from "../services/appDownloadConfig.js";
import { TURNSTILE_SITE_KEY } from "../supabase-config.js";

const root = document.getElementById("awards-voting-root");
const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const voteStorageKey = editionId => `euamourania:melhores:votos:${editionId}`;
const sessionVotes = new Map();
const voteFeedback = new Map();
let voteClock = null;
let appDownload = null;
const serverNow = () => voteClock ? voteClock.agora + (performance.now() - voteClock.recebido) : Date.now();
const appStart = edition => edition.votacao_inicio;
const siteStart = edition => edition.votacao_inicio_site;
function appInvite(edition, compact = false, afterVote = false) {
  if (Number(edition.ano) !== 2026 || !appDownload) return "";
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent || "");
  const android = /Android/i.test(navigator.userAgent || "") && !ios;
  const destination = ios ? appDownload.appPageUrl : android ? appDownload.googlePlayUrl : appDownload.appPageUrl;
  const href = /^https:\/\//.test(destination || "") ? destination : appDownload.appPageUrl;
  const now = serverNow();
  const appOpen = edition.status === "votacao_aberta" && appStart(edition) && now >= new Date(appStart(edition)).getTime();
  const siteOpen = isVotingOpen(edition);
  const ended = edition.votacao_fim && now > new Date(edition.votacao_fim).getTime();
  const dateLabel = value => value ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "data a confirmar";
  const copy = afterVote
    ? ["Seu voto foi registrado!", "Obrigado por participar! Você também pode participar pelo aplicativo Viva Urânia.", "Conhecer o Viva Urânia"]
    : ended
      ? ["Acompanhe o Viva Urânia", "A votação foi encerrada. Conheça o aplicativo e acompanhe as novidades do prêmio.", "Conhecer o Viva Urânia"]
      : edition.status !== "votacao_aberta" && appStart(edition) && now >= new Date(appStart(edition)).getTime()
      ? ["Aguarde a abertura oficial", "A votação ainda não foi ativada. Conheça o Viva Urânia enquanto preparamos a premiação.", "Conhecer o Viva Urânia"]
      : !appOpen
      ? ["Vote primeiro pelo Viva Urânia!", `A votação do Melhores de Urânia 2026 começa em ${dateLabel(appStart(edition))} pelo aplicativo. Baixe agora e prepare-se para participar!`, "Baixar o Viva Urânia"]
      : !siteOpen
        ? ["A votação já começou no Viva Urânia!", `Você já pode participar pelo aplicativo. A votação no site Eu Amo Urânia começa em ${dateLabel(siteStart(edition))}.`, "Votar pelo aplicativo"]
        : ["Você também pode votar pelo Viva Urânia!", "Além do site, o aplicativo Viva Urânia também participa da votação do Melhores de Urânia 2026.", "Baixar o aplicativo"];
  return `<aside class="vote-app-invite ${compact ? "is-compact" : ""}" aria-label="Viva Urânia">
    <div><strong>${esc(copy[0])}</strong><p>${esc(copy[1])}</p>${ios ? '<small>O aplicativo ainda não está disponível para iOS.</small>' : ""}</div>
    <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(ios ? "Conhecer o Viva Urânia" : copy[2])}<span aria-hidden="true"> ↗</span></a>
  </aside>`;
}

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
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(voteStorageKey(editionId)) || "{}"); } catch {}
  return { ...stored, ...(sessionVotes.get(editionId) || {}) };
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
  sessionVotes.set(editionId, votes);
  try { localStorage.setItem(voteStorageKey(editionId), JSON.stringify(votes)); } catch {}
}

function reconcileVotes(editionId, confirmed = []) {
  const votes = {};
  for (const row of confirmed) {
    if (!row.categoria_id || !row.indicado_id) continue;
    (votes[row.categoria_id] ||= []).push(row.indicado_id);
  }
  sessionVotes.set(editionId, votes);
  try { localStorage.setItem(voteStorageKey(editionId), JSON.stringify(votes)); } catch {}
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

function getVotableCategories(categories, nominees) {
  const grouped = new Map(categories.map(category => [category.id, nominees.filter(item => item.categoria_id === category.id)]));
  return categories.filter(category => (grouped.get(category.id) || []).length > 0);
}

function progressFor(edition, categories, nominees) {
  const votes = readVotes(edition.id);
  const votable = getVotableCategories(categories, nominees);
  const completed = votable.filter(category => votesFor(votes, category.id).length >= 1);
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
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
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
  const nextLink = progress.next ? votingUrl(edition, progress.next) : `${hubUrl(edition)}?concluido=1`;
  return `
    <header class="vote-hub-hero">
      <div class="vote-brand"><span class="vote-brand-symbol" aria-hidden="true">✦</span><span>Prêmio Melhores de Urânia <b>${esc(edition.ano)}</b></span></div>
      <p class="vote-kicker">Uma realização Eu Amo Urânia · Votação oficial</p>
      <h1>${esc(edition.nome)}</h1>
      <p>Seu voto valoriza quem faz a diferença na cidade. Escolha, confirme e avance no seu ritmo.</p>
      <div class="vote-flow-steps" aria-label="Como votar"><span><b>01</b> Escolha um indicado</span><span><b>02</b> Confirme o voto</span><span><b>03</b> Avance de categoria</span></div>
      <div class="vote-hub-progress" aria-label="${progress.completed.length} de ${progress.total} categorias votadas">
        <span>${progress.completed.length} de ${progress.total} categorias votadas</span>
        <span>${progress.percent}%</span>
      </div>
      <div class="vote-progress-track" aria-hidden="true"><span style="width:${progress.percent}%"></span></div>
      <a class="button button-primary vote-primary" href="${nextLink}" data-awards-vote-continue>${progress.total && progress.percent === 100 ? "Ver conclusão" : progress.completed.length ? "Continuar votação" : "Começar votação"}<span aria-hidden="true">→</span></a>
    </header>`;
}

export function renderHub(edition, categories, nominees) {
  setMeta(edition, "Central da votação");
  const open = isVotingOpen(edition);
  if (!open) {
    const ended = edition.votacao_fim && serverNow() > new Date(edition.votacao_fim).getTime();
    root.innerHTML = `
      <section class="vote-closed">
        <div class="vote-brand"><span class="vote-brand-symbol" aria-hidden="true">✦</span><span>Prêmio Melhores de Urânia <b>${esc(edition.ano)}</b></span></div>
        <p class="vote-kicker">Votação oficial</p>
        <h1>${esc(edition.nome)}</h1>
        <p>${ended ? "A votação pelo site foi encerrada." : "A votação pelo site ainda não começou."} Período previsto: ${esc(formatDate(edition.votacao_inicio_site))} até ${esc(formatDate(edition.votacao_fim))}.</p>
        <a class="button button-primary vote-primary" href="${editionUrl(edition)}">Voltar para a edição</a>
      </section>${appInvite(edition)}`;
    return;
  }

  const progress = progressFor(edition, categories, nominees);
  const showDone = new URLSearchParams(location.search).has("concluido") && progress.total > 0 && progress.percent === 100;
  if (showDone) {
    renderCompletion(edition, categories, nominees);
    return;
  }

  const grouped = new Map(categories.map(category => [category.id, nominees.filter(item => item.categoria_id === category.id)]));
  root.innerHTML = `
    ${progressCard(edition, categories, nominees)}
    ${appInvite(edition)}
    <section class="vote-hub-list" aria-labelledby="vote-category-list-title">
      <h2 id="vote-category-list-title">Categorias</h2>
      <div class="vote-category-list">
        ${categories.map(category => {
          const total = grouped.get(category.id)?.length || 0;
          const voted = votesFor(progress.votes, category.id).length > 0;
          const disabled = !total;
          return `<a class="vote-category-row ${voted ? "is-complete" : ""} ${disabled ? "is-disabled" : ""}" href="${disabled ? "#" : votingUrl(edition, category)}" ${disabled ? 'aria-disabled="true"' : ""}>
            <strong>${esc(category.nome)}</strong>
            <small>${total ? `${total} indicado${total === 1 ? "" : "s"}` : "sem indicados publicados"}</small>
            <span class="vote-category-arrow" aria-hidden="true">${voted ? "✓" : "→"}</span>
          </a>`;
        }).join("")}
      </div>
    </section>`;
}

function nomineeButton(category, nominee, votes) {
  const votedList = votesFor(votes, category.id);
  const voted = votedList.includes(nominee.id);
  const maxChoices = 1;
  const reachedLimit = votedList.length >= maxChoices;
  const img = image(nominee.imagem_url);
  const initial = esc(String(nominee.nome || "?").trim().charAt(0).toUpperCase());
  return `
    <article class="vote-nominee ${voted ? "is-voted" : ""}">
      <button class="vote-nominee-button" type="button" data-select-nominee data-nominee="${esc(nominee.id)}" data-nominee-name="${esc(nominee.nome)}" aria-pressed="false" aria-label="${voted ? "Voto enviado para" : "Selecionar"} ${esc(nominee.nome)}" ${voted || reachedLimit ? "disabled" : ""}>
        <span class="vote-nominee-media">
          ${img ? `<img src="${img}" alt="" loading="lazy">` : `<span class="vote-nominee-empty" aria-hidden="true">${initial}</span>`}
          <span class="vote-nominee-check" aria-hidden="true">✓</span>
        </span>
        <span class="vote-nominee-name">${esc(nominee.nome)}</span>
      </button>
    </article>`;
}

export function renderCategory(edition, categories, nominees, slug) {
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
  const nextToVisit = progress.votable.find(item => item.id !== category.id && votesFor(progress.votes, item.id).length === 0) || null;
  const categoryVotes = votesFor(progress.votes, category.id);
  const maxChoices = 1;
  const reachedLimit = categoryVotes.length >= maxChoices;
  const votedNames = categoryVotes.map(id => items.find(item => item.id === id)?.nome).filter(Boolean);
  const nextHref = nextToVisit ? votingUrl(edition, nextToVisit) : `${hubUrl(edition)}?concluido=1`;
  const categoryShareUrl = `${location.origin}${votingUrl(edition, category)}`;
  const demo = location.pathname.startsWith("/preview/melhores/") && new URLSearchParams(location.search).get("demo") === "1";
  const feedback = demo ? "Escolha simulada nesta prévia. Nenhum voto oficial foi enviado." : voteFeedback.get(`${edition.id}:${category.id}`) || "Sua escolha foi recebida.";
  const selectedNominee = categoryVotes.length === 1 ? items.find(item => item.id === categoryVotes[0]) : null;
  const selectedImage = image(selectedNominee?.imagem_url);

  if (!open) {
    renderHub(edition, categories, nominees);
    return;
  }

  root.innerHTML = `
    <div class="vote-brand"><span class="vote-brand-symbol" aria-hidden="true">✦</span><span>Prêmio Melhores de Urânia <b>${esc(edition.ano)}</b></span></div>
    <div class="vote-step-nav">
      <a href="${hubUrl(edition)}">← Todas as categorias</a>
      <span>Categoria ${index + 1} de ${progress.votable.length}</span>
    </div>
    <div class="vote-progress-track" role="progressbar" aria-label="Categorias votadas" aria-valuemin="0" aria-valuemax="${progress.total}" aria-valuenow="${progress.completed.length}"><span style="width:${progress.percent}%"></span></div>
    <section class="vote-step" aria-labelledby="vote-step-title">
      <header class="vote-step-heading">
        <p class="vote-kicker">Votação oficial · ${esc(edition.ano)}</p>
        <h1 id="vote-step-title">${esc(category.nome)}</h1>
        <p>${reachedLimit ? "Sua participação nesta categoria foi recebida." : maxChoices > 1 ? `Quem merece seu voto? Escolha até ${maxChoices} indicados, confirmando cada escolha.` : "Quem merece seu voto? Escolha um indicado e confirme antes de enviar."}</p>
      </header>
      ${reachedLimit ? `<div class="vote-saved-state" role="status">
        <span class="vote-saved-icon" aria-hidden="true">✓</span>
        <div class="vote-saved-copy"><h2>Voto enviado.</h2><p>${esc(feedback)}</p></div>
        ${selectedNominee ? `<div class="vote-saved-nominee"><span class="vote-saved-photo">${selectedImage ? `<img src="${selectedImage}" alt="">` : `<span aria-hidden="true">${esc(selectedNominee.nome.trim().charAt(0).toUpperCase())}</span>`}</span><span>Sua escolha<strong>${esc(selectedNominee.nome)}</strong></span></div>` : votedNames.length ? `<p class="vote-saved-list">Você escolheu: <strong>${votedNames.map(esc).join(", ")}</strong></p>` : ""}
      </div>${appInvite(edition, true, true)}` : `
        ${categoryVotes.length ? `<div class="vote-confirmation" role="status"><span aria-hidden="true">✓</span><p>${esc(feedback)} ${votedNames.length ? `<strong>${votedNames.map(esc).join(", ")}</strong>` : ""}</p></div>` : ""}
        ${items.length ? `<div class="vote-nominees">${items.map(nominee => nomineeButton(category, nominee, progress.votes)).join("")}</div>` : `<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>`}
      `}
      <div class="vote-step-actions">
        <div class="vote-action-bar">
          <p class="vote-action-caption" data-selection-caption role="status" aria-live="polite">${reachedLimit ? "Escolha confirmada nesta categoria" : categoryVotes.length ? `${categoryVotes.length} de até ${maxChoices} votos enviados` : "Escolha um indicado para continuar"}</p>
          ${reachedLimit ? `<a class="button button-primary vote-primary" href="${nextHref}" data-next-category>${nextToVisit ? "Próxima categoria" : "Finalizar participação"}<span aria-hidden="true">→</span></a>` : `<button class="button button-primary vote-primary" type="button" data-vote data-edition="${esc(edition.id)}" data-category="${esc(category.id)}" data-max-choices="${maxChoices}" disabled>Escolha um indicado</button>`}
          ${categoryVotes.length && !reachedLimit ? `<a class="vote-action-skip" href="${nextHref}" data-next-category>${nextToVisit ? "Seguir para a próxima categoria" : "Finalizar participação"}</a>` : ""}
        </div>
        <div class="vote-step-links">
          ${previous && previous.id !== nextToVisit?.id ? `<a href="${votingUrl(edition, previous)}">Categoria anterior</a>` : `<a href="${hubUrl(edition)}">Ver categorias</a>`}
          ${categoryVotes.length ? `<button type="button" data-share-category data-share-url="${categoryShareUrl}" data-category-name="${esc(category.nome)}">Compartilhar</button><a href="/app.html">Baixar o app</a>` : ""}
        </div>
      </div>
    </section>${!reachedLimit ? appInvite(edition, true) : ""}`;

  const confirmButton = root.querySelector("[data-vote]");
  root.querySelectorAll("[data-select-nominee]").forEach(choice => {
    choice.addEventListener("click", () => {
      if (!confirmButton || choice.disabled) return;
      root.querySelectorAll("[data-select-nominee]").forEach(item => {
        item.setAttribute("aria-pressed", String(item === choice));
        item.setAttribute("aria-label", `${item === choice ? "Selecionado" : "Selecionar"} ${item.dataset.nomineeName}`);
        item.closest(".vote-nominee")?.classList.toggle("is-active", item === choice);
      });
      confirmButton.dataset.nominee = choice.dataset.nominee;
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirmar voto →";
      confirmButton.setAttribute("aria-label", `Confirmar voto em ${choice.dataset.nomineeName}`);
      root.querySelector("[data-selection-caption]").textContent = `Você escolheu: ${choice.dataset.nomineeName}`;
    });
  });
}

function renderCompletion(edition, categories, nominees) {
  const progress = progressFor(edition, categories, nominees);
  const shareUrl = `${location.origin}${editionUrl(edition)}`;
  root.innerHTML = `
    <section class="vote-complete">
      <div class="vote-brand"><span class="vote-brand-symbol" aria-hidden="true">✦</span><span>Prêmio Melhores de Urânia <b>${esc(edition.ano)}</b></span></div>
      <p class="vote-kicker">Participação enviada · ${progress.completed.length} de ${progress.total}</p>
      <h1>Obrigado por votar.</h1>
      <p>Suas escolhas foram recebidas. Convide mais pessoas a participar ou acompanhe a premiação no aplicativo.</p>
      <div class="vote-complete-meta">${progress.percent}% das categorias votadas</div>
      <div class="vote-progress-track" aria-hidden="true"><span style="width:${progress.percent}%"></span></div>
      <div class="vote-complete-actions">
        <button class="button button-primary vote-primary" type="button" data-share-voting>Compartilhar votação <span aria-hidden="true">→</span></button>
        <a href="/app.html">Baixar o app</a>
        <a href="${hubUrl(edition)}">Ver categorias</a>
        <a href="${editionUrl(edition)}">Voltar para a edição</a>
      </div>
    </section>`;
  if (location.pathname.startsWith("/preview/melhores/") && new URLSearchParams(location.search).get("demo") === "1") return;
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
  if (!button || button.disabled || !button.dataset.nominee) return;
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = "Registrando…";
  registrarEventoMelhores("melhores_vote_start", {
    edicaoId: button.dataset.edition,
    metadados: { categoria_id: button.dataset.category, indicado_id: button.dataset.nominee, origem_fluxo: "central_votacao" }
  });
  try {
    const turnstileToken = await getTurnstileToken("vote");
    const result = await enviarVotoMelhores({
      edicao_id: button.dataset.edition,
      categoria_id: button.dataset.category,
      indicado_id: button.dataset.nominee,
      origem: "site",
      pagina: location.pathname,
      turnstile_token: turnstileToken
    });
    saveVote(button.dataset.edition, button.dataset.category, button.dataset.nominee);
    voteFeedback.set(`${button.dataset.edition}:${button.dataset.category}`, result.message || "Sua escolha foi recebida.");
    registrarEventoMelhores("melhores_vote_complete", {
      edicaoId: button.dataset.edition,
      metadados: { categoria_id: button.dataset.category, indicado_id: button.dataset.nominee, origem_fluxo: "central_votacao" }
    });
    toast(result.message || "Sua escolha foi recebida.");
    renderCategory(edition, categories, nominees, getCategorySlug());
    root.querySelector(".vote-saved-state, .vote-confirmation")?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start"
    });
  } catch (error) {
    button.disabled = false;
    button.textContent = oldText;
    registrarEventoMelhores("melhores_vote_error", {
      edicaoId: button.dataset.edition,
      metadados: { categoria_id: button.dataset.category, indicado_id: button.dataset.nominee, erro: error.message, origem_fluxo: "central_votacao" }
    });
    toast(error instanceof TypeError
      ? "Não foi possível confirmar a resposta. Tente novamente; se o voto já foi salvo, ele não será duplicado."
      : error.message);
  }
}

async function handleCategoryShare(event, edition) {
  const button = event.target.closest("[data-share-category]");
  if (!button) return;
  const url = button.dataset.shareUrl || location.href;
  const categoryName = button.dataset.categoryName || "categoria";
  registrarEventoMelhores("melhores_share_click", {
    edicaoId: edition.id,
    destino: url,
    metadados: { canal: "native_categoria", categoria: categoryName }
  });
  if (navigator.share) {
    await navigator.share({
      title: `${categoryName} | ${edition.nome}`,
      text: `Vote na categoria ${categoryName} do Melhores de Urânia.`,
      url
    }).catch(() => null);
    return;
  }
  await navigator.clipboard?.writeText(url).catch(() => null);
  toast("Link da categoria copiado.");
}

async function init() {
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      root.innerHTML = `<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>`;
      return;
    }
    const [period, download, categories, nominees] = await Promise.all([
      consultarPeriodoVotacao(edition.id),
      getAppDownloadConfig(),
      listarCategoriasPublicas(edition.id),
      listarIndicadosPublicos(edition.id)
    ]);
    voteClock = { agora: new Date(period.agora).getTime(), recebido: performance.now() };
    reconcileVotes(edition.id, period.votos_site);
    edition.status = period.status;
    edition.votacao_inicio = period.votacao_inicio_app;
    edition.votacao_inicio_site = period.votacao_inicio_site;
    edition.votacao_fim = period.votacao_fim;
    appDownload = download;
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
    root.addEventListener("click", event => {
      handleCategoryShare(event, edition);
      handleVote(event, edition, categories, nominees);
    });
    const refreshPeriod = async () => {
      try {
        const latest = await consultarPeriodoVotacao(edition.id);
        voteClock = { agora: new Date(latest.agora).getTime(), recebido: performance.now() };
        reconcileVotes(edition.id, latest.votos_site);
        edition.status = latest.status;
        edition.votacao_inicio = latest.votacao_inicio_app;
        edition.votacao_inicio_site = latest.votacao_inicio_site;
        edition.votacao_fim = latest.votacao_fim;
        if (getCategorySlug()) renderCategory(edition, categories, nominees, getCategorySlug());
        else renderHub(edition, categories, nominees);
      } catch { /* A API de voto continua sendo a autoridade para aceitar votos. */ }
    };
    window.setInterval(refreshPeriod, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshPeriod(); });
  } catch (error) {
    console.error("Central de votação:", error);
    root.innerHTML = `<div class="awards-empty">Não foi possível carregar a votação agora.</div>`;
  }
}

if (!(location.pathname.startsWith("/preview/melhores/") && new URLSearchParams(location.search).get("demo") === "1")) init();
