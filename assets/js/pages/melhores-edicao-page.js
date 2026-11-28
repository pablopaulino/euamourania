import { awardPath, awardLocal, readAwardRoute } from "../melhoresRoutes.mjs";
import { obterEdicaoPorAno, listarCategoriasPublicas, listarIndicadosPublicos, enviarVotoMelhores, enviarIndicacaoMelhores, consultarPeriodoVotacao } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { getAppDownloadConfig } from "../services/appDownloadConfig.js";
import { TURNSTILE_SITE_KEY } from "../supabase-config.js";
import { sharePage } from "../services/shareService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
let voteClock = null;
let appDownload = null;
const serverNow = () => voteClock ? voteClock.agora + (performance.now() - voteClock.recebido) : Date.now();
const appHref = () => {
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent || "");
  const android = /Android/i.test(navigator.userAgent || "") && !ios;
  const href = android ? appDownload?.googlePlayUrl : appDownload?.appPageUrl;
  return /^https:\/\//.test(href || "") ? href : "https://euamourania.com.br/app";
};
const key = editionId => `euamourania:melhores:votos:${editionId}`;
const resultsUrl = edition => awardPath("results", { year: edition.ano, local: awardLocal() });
function getYear() {
  return Number(readAwardRoute().year || new Date().getFullYear());
}

function readVotes(editionId) {
  try { return JSON.parse(localStorage.getItem(key(editionId)) || "{}"); } catch { return {}; }
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
  try { localStorage.setItem(key(editionId), JSON.stringify(votes)); } catch {}
}

function reconcileVotes(editionId, confirmed = []) {
  const votes = {};
  for (const row of confirmed) {
    if (!row.categoria_id || !row.indicado_id) continue;
    (votes[row.categoria_id] ||= []).push(row.indicado_id);
  }
  try { localStorage.setItem(key(editionId), JSON.stringify(votes)); } catch {}
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "A confirmar";
}

function formatPeriod(start, end) {
  const formattedStart = formatDate(start);
  const formattedEnd = formatDate(end);
  if (!start && !end) return "A confirmar";
  if (!start) return `At\u00e9 ${formattedEnd}`;
  if (!end) return `A partir de ${formattedStart}`;
  return `${formattedStart} a ${formattedEnd}`;
}

function statusLabel(status = "") {
  const labels = {
    planejamento: "Em prepara\u00e7\u00e3o",
    indicacoes_abertas: "Indica\u00e7\u00f5es abertas",
    indicacoes_encerradas: "Indica\u00e7\u00f5es encerradas",
    votacao_aberta: "Vota\u00e7\u00e3o aberta",
    votacao_encerrada: "Vota\u00e7\u00e3o encerrada",
    apuracao: "Apura\u00e7\u00e3o",
    resultado_publicado: "Resultado publicado",
    arquivada: "Arquivada"
  };
  return labels[status] || String(status || "Status a confirmar").replaceAll("_", " ");
}

function isVotingOpen(edition) {
  const now = serverNow();
  return edition?.status === "votacao_aberta"
    && !!edition.votacao_inicio_site
    && new Date(edition.votacao_inicio_site).getTime() <= now
    && !!edition.votacao_fim
    && new Date(edition.votacao_fim).getTime() >= now;
}

function isIndicationOpen(edition) {
  const now = Date.now();
  return edition?.status === "indicacoes_abertas"
    && (!edition.indicacoes_inicio || new Date(edition.indicacoes_inicio).getTime() <= now)
    && (!edition.indicacoes_fim || new Date(edition.indicacoes_fim).getTime() >= now);
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
    script.onerror = () => { turnstileLoadPromise = null; script.remove(); reject(new Error("Não foi possível carregar a verificação de segurança.")); };
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

function showPostVotePanel(editionId, voteButton) {
  const existing = document.querySelector(".awards-post-vote");
  existing?.remove();
  const panel = document.createElement("div");
  panel.className = "awards-post-vote";
  panel.innerHTML = `
    <button type="button" class="awards-post-close" aria-label="Fechar">×</button>
    <strong>Seu voto foi registrado!</strong>
    <p>Obrigado por participar! Você também pode participar pelo aplicativo Viva Urânia.</p>
    <div>
      <a class="button button-secondary" href="${esc(appHref())}" target="_blank" rel="noopener noreferrer">Conhecer o Viva Urânia</a>
      <button type="button" class="button button-primary" data-awards-share="native">Compartilhar votação</button>
    </div>
  `;
  panel.dataset.editionId = editionId || "";
  voteButton?.closest(".awards-nominee-card")?.after(panel);
}

function setMeta(edition) {
  if (document.getElementById("awards-preview-app")?.dataset.serverRendered === "true") return;
  const title = `${edition.nome} | Melhores de Urânia`;
  const description = (edition.descricao || "Participe da votação popular do Eu Amo Urânia.").slice(0, 155);
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  const canonical = `${location.origin}${awardPath("edition", { year: edition.ano })}`;
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(edition.imagem_capa_url || "/assets/AD3A1763-min%20(1).jpg", location.origin).href);
}

function renderHero(edition) {
  const phase = phaseInfo(edition);
  const title = esc(edition.nome || `Melhores de Urânia ${edition.ano}`).replace(/Urânia/i, '<em class="award-accent">$&</em>');
  const primaryAction = phase.cta === "Ver regulamento" ? "" :
    `<a class="button button-primary" href="${phase.href}" data-awards-edition-cta data-edition-id="${edition.id}">${esc(phase.cta)}</a>`;
  document.getElementById("edition-copy").innerHTML = `<h1>${title}</h1><p>${esc(phase.text)}</p>
    <div class="hero-actions">${primaryAction}<a class="button button-secondary" href="${awardPath("rules", { year: edition.ano })}" data-awards-edition-cta data-edition-id="${edition.id}">Regulamento</a><a class="button button-secondary" href="${awardPath("method", { year: edition.ano })}" data-awards-edition-cta data-edition-id="${edition.id}">Metodologia</a><button class="button button-secondary" type="button" data-share-edition data-edition-id="${edition.id}">Compartilhar</button></div>`;
  const cover = Number(edition.ano) === 2026 ? "/assets/melhores/assinatura-2026.png" : image(edition.imagem_capa_url);
  document.getElementById("edition-panel").innerHTML = `
    ${cover ? `<img src="${cover}" alt="">` : ""}
    <span class="awards-chip">${esc(phase.label)}</span>`;
}

function phaseInfo(edition) {
  if (isIndicationOpen(edition)) {
    return {
      label: "Indicações abertas",
      title: "Indique quem merece participar",
      text: `Período: ${formatPeriod(edition.indicacoes_inicio, edition.indicacoes_fim)}.`,
      href: "#indicacoes",
      cta: "Enviar indicação"
    };
  }
  if (isVotingOpen(edition)) {
    return {
      label: "Votação aberta",
      title: "Vote nos seus favoritos",
      text: `Período no site: ${formatPeriod(edition.votacao_inicio_site, edition.votacao_fim)}.`,
      href: awardPath("voting", { year: edition.ano }),
      cta: "Participar da votação"
    };
  }
  if (edition.status === "resultado_publicado" || (edition.status === "arquivada" && edition.resultado_publicado_em)) {
    return {
      label: "Resultado publicado",
      title: "Confira os vencedores",
      text: "O resultado oficial desta edição já está disponível.",
      href: resultsUrl(edition),
      cta: "Ver resultados"
    };
  }
  if (Number(edition.ano) === 2026 && edition.status === "apuracao" && new Date(edition.divulgacao_em).getTime() === Date.parse("2026-11-23T13:00:00Z")) {
    return { label: "Divulgação dos vencedores", title: "Acompanhe os vencedores", text: "De 23 a 29 de novembro, às 10h, 15h e 20h, no horário de Brasília.", href: resultsUrl(edition), cta: "Ver resultados" };
  }
  if (edition.status === "votacao_aberta" && edition.votacao_inicio_site && serverNow() < new Date(edition.votacao_inicio_site).getTime()) {
    return { label: "Votação no site em breve", text: `A votação pelo site começa em ${formatDate(edition.votacao_inicio_site)}.`, href: "#vote-area", cta: "Ver indicados" };
  }
  if (edition.votacao_fim && serverNow() > new Date(edition.votacao_fim).getTime()) {
    return { label: statusLabel(edition.status), text: "A votação terminou. Acompanhe a divulgação dos resultados desta edição.", href: resultsUrl(edition), cta: "Ver resultados" };
  }
  return {
    label: statusLabel(edition.status),
    title: "Acompanhe a edição",
    text: "Veja as informações oficiais, regulamento, metodologia e categorias desta edição.",
    href: awardPath("rules", { year: edition.ano }),
    cta: "Ver regulamento"
  };
}

function renderEditionHub(edition, categories, nominees) {
  const hub = document.getElementById("edition-hub");
  if (!hub) return;
  hub.classList.add("awards-edition-hub");
  const links = [
    {
      eyebrow: "Cronograma",
      title: "Fases da edição",
      text: Number(edition.ano) === 2026 && new Date(edition.divulgacao_em).getTime() === Date.parse("2026-11-23T13:00:00Z") ? "Votação encerrada. Divulgação dos vencedores de 23 a 29 de novembro, às 10h, 15h e 20h (horário de Brasília)." : Number(edition.ano) === 2026 ? `App: 05/11 às 14h; site: 09/11 às 14h; Instagram: 09/11. Encerramento: 16/11 às 19h (Brasília). Divulgação dos vencedores: ${edition.divulgacao_em ? formatDate(edition.divulgacao_em) + " (horário de Brasília)" : "data a definir"}.` : `Indicações: ${formatPeriod(edition.indicacoes_inicio, edition.indicacoes_fim)}`
    },
    {
      eyebrow: "Categorias",
      title: categories.length ? `${categories.length} categorias` : "Categorias",
      text: categories.length ? `${nominees.length} indicado${nominees.length === 1 ? "" : "s"} publicado${nominees.length === 1 ? "" : "s"} até agora.` : "As categorias serão exibidas quando estiverem disponíveis publicamente.",
      href: categories.length ? "#vote-area" : ""
    },
    {
      eyebrow: "Regras",
      title: "Regulamento",
      text: "Critérios, participação, prazos e regras oficiais da edição.",
      href: awardPath("rules", { year: edition.ano })
    },
    {
      eyebrow: "Apuração",
      title: "Metodologia",
      text: "Como os votos e pesos são considerados na premiação.",
      href: awardPath("method", { year: edition.ano })
    }
  ];
  hub.innerHTML = `
    <div class="awards-hub-grid">
      ${links.map(item => `
        <${item.href ? `a href="${item.href}"` : "article"} class="awards-hub-card">
          <span>${esc(item.eyebrow)}</span>
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.text)}</small>
        </${item.href ? "a" : "article"}>`).join("")}
    </div>`;
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

function resolveNomineeGuideUrl(nominee) {
  if (!nominee) return "";
  const embedded = nominee.guia_comercial;
  if (embedded?.slug && (!embedded.status || embedded.status === "publicado")) {
    return `/guia/${encodeURIComponent(embedded.slug)}`;
  }
  const initial = getInitialAwardsBootstrap();
  const linkedId = nominee.guia_comercial_id || nominee.empresa_id;
  if (linkedId && initial?.guideSlugs && Object.prototype.hasOwnProperty.call(initial.guideSlugs, String(linkedId))) {
    return `/guia/${encodeURIComponent(initial.guideSlugs[String(linkedId)])}`;
  }
  const candidateSlug = nominee.slug || slugifyGuideCandidate(nominee.nome || "");
  if (candidateSlug && initial?.guideNames && Object.prototype.hasOwnProperty.call(initial.guideNames, candidateSlug)) {
    return `/guia/${encodeURIComponent(initial.guideNames[candidateSlug])}`;
  }
  return "";
}

function nomineeCard(edition, category, nominee, open, votedId) {
  const votedList = Array.isArray(votedId) ? votedId : (votedId ? [votedId] : []);
  const voted = votedList.includes(nominee.id);
  const maxChoices = 1;
  const reachedLimit = votedList.length >= maxChoices;
  const img = image(nominee.imagem_url);
  const guideUrl = resolveNomineeGuideUrl(nominee);
  return `<article class="awards-nominee-card ${open && voted ? "awards-voted" : ""}" data-awards-nominee-card data-edition-id="${edition.id}" data-category-id="${category.id}" data-nominee-id="${nominee.id}">
    <div class="edition-portrait">${img ? `<img src="${img}" alt="${esc(nominee.nome)}" width="640" height="640" loading="lazy" decoding="async">` : `<div class="awards-category-nominee-empty" aria-hidden="true">${esc(nominee.nome.trim().charAt(0).toLocaleUpperCase("pt-BR"))}</div>`}</div>
    <div class="awards-card-body">
      <h3>${esc(nominee.nome)}</h3>
      ${guideUrl ? `<a class="awards-guide-link" href="${esc(guideUrl)}">Ver no Guia Comercial <span aria-hidden="true">→</span></a>` : ""}
      ${open ? `<button class="button button-primary awards-vote-button" data-vote data-edition="${edition.id}" data-category="${category.id}" data-nominee="${nominee.id}" data-max-choices="${maxChoices}" ${open && !voted && !reachedLimit ? "" : "disabled"}>
        ${voted ? "Voto registrado" : "Votar"}
      </button>` : ""}
    </div>
  </article>`;
}

function renderVoting(edition, categories, nominees) {
  const area = document.getElementById("vote-area");
  const open = isVotingOpen(edition);
  const section = area?.closest(".awards-section");
  if (section && !open && !nominees.length) {
    section.hidden = true;
    area.innerHTML = "";
    return;
  }
  if (section) section.hidden = false;
  const votes = readVotes(edition.id);
  document.getElementById("vote-status-copy").textContent = open
    ? "Escolha um indicado por categoria. O sistema registra seu voto com validação segura."
    : "A votação não está aberta agora. Você pode conferir as categorias e indicados publicados.";
  if (!categories.length) {
    area.innerHTML = '<div class="awards-empty">Nenhuma categoria pública nesta edição.</div>';
    return;
  }
  const grouped = new Map(categories.map(category => [category.id, nominees.filter(n => n.categoria_id === category.id)]));
  area.innerHTML = `<aside class="awards-category-nav" aria-label="Categorias">${categories.map((category, index) => {
    const total = grouped.get(category.id)?.length || 0;
    return `<button type="button" data-scroll-category="${category.id}" class="${index === 0 ? "active" : ""}"><span>${esc(category.nome)}</span><small>${total} indicado${total === 1 ? "" : "s"}</small></button>`;
  }).join("")}</aside>
    <div class="awards-nominees">
      ${categories.map(category => {
        const items = grouped.get(category.id) || [];
        return `<section class="awards-nominee-group" id="categoria-${category.id}">
          <header><h3><a class="awards-link" href="${awardPath("category", { year: edition.ano, slug: category.slug })}">${esc(category.nome)}</a></h3><p>${open ? esc(category.descricao || "Escolha seu indicado favorito.") : `${items.length} indicado${items.length === 1 ? "" : "s"}`}</p></header>
          ${items.length ? `<div class="awards-nominee-grid" tabindex="0" role="region" aria-label="Indicados de ${esc(category.nome)}">${items.map(nominee => nomineeCard(edition, category, nominee, open, votesFor(votes, category.id))).join("")}</div>` : '<div class="awards-empty">Nenhum indicado publicado nesta categoria.</div>'}
        </section>`;
      }).join("")}
    </div>`;
}

function observeNomineeImpressions() {
  const cards = [...document.querySelectorAll("[data-awards-nominee-card]")];
  if (!cards.length || !("IntersectionObserver" in window)) return;
  const seen = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const key = `${card.dataset.categoryId}:${card.dataset.nomineeId}`;
      if (seen.has(key)) return;
      seen.add(key);
      registrarEventoMelhores("melhores_nominee_impression", {
        edicaoId: card.dataset.editionId,
        metadados: {
          categoria_id: card.dataset.categoryId,
          indicado_id: card.dataset.nomineeId
        }
      });
      observer.unobserve(card);
    });
  }, { threshold: 0.55 });
  cards.forEach(card => observer.observe(card));
}

function renderIndications(edition, categories) {
  const area = document.getElementById("indication-area");
  const copy = document.getElementById("indication-status-copy");
  if (!area) return;
  const open = isIndicationOpen(edition);
  const allowed = categories.filter(category => category.permite_indicacao_publica === true);
  if (copy) {
    copy.textContent = open
      ? "Escolha a categoria e informe quem merece participar. A equipe analisa antes de virar indicado oficial."
      : "";
  }
  if (!open) {
    area.innerHTML = `<div class="awards-alert"><strong>Indicações fechadas.</strong><br>Período: ${esc(formatDate(edition.indicacoes_inicio))} até ${esc(formatDate(edition.indicacoes_fim))}.</div>`;
    return;
  }
  if (!allowed.length) {
    area.innerHTML = '<div class="awards-empty">Nenhuma categoria está recebendo indicações públicas nesta edição.</div>';
    return;
  }
  area.innerHTML = `<form class="awards-indication-form" id="awards-indication-form" data-edition-id="${edition.id}">
    <input type="text" name="website" tabindex="-1" autocomplete="off" class="awards-honeypot" aria-hidden="true">
    <progress class="full award-indication-progress" max="2" value="1" aria-label="Campos obrigatórios preenchidos"></progress>
    <div>
      <label for="indication-category">Categoria *</label>
      <select id="indication-category" name="categoria_id" required>
        ${allowed.map(category => `<option value="${category.id}">${esc(category.nome)}</option>`).join("")}
      </select>
    </div>
    <div>
      <label for="indication-name">Nome indicado *</label>
      <input id="indication-name" name="nome_indicado" type="text" maxlength="160" placeholder="Nome da empresa, pessoa ou projeto" required>
    </div>
    <p class="full awards-indication-note">As sugestões passam por análise conforme o <a href="${awardPath("rules", { year: edition.ano })}">regulamento da edição</a>.</p>
    <div class="full awards-form-actions"><button class="button button-primary" type="submit">Enviar indicação</button></div>
  </form>`;
  const form = area.querySelector("#awards-indication-form");
  const progress = form.querySelector(".award-indication-progress");
  form.addEventListener("input", () => {
    progress.value = Number(Boolean(form.elements.categoria_id.value)) + Number(Boolean(form.elements.nome_indicado.value.trim()));
  });
}

function orderSectionsForPhase(edition) {
  const indicationSection = document.getElementById("indication-area")?.closest(".awards-section");
  const voteSection = document.getElementById("vote-area")?.closest(".awards-section");
  const hero = document.querySelector(".awards-public-hero");
  if (!indicationSection || !voteSection || !hero) return;
  if (isIndicationOpen(edition)) {
    hero.after(indicationSection);
    return;
  }
  voteSection.after(indicationSection);
}

function renderEditionAppInvite(edition) {
  if (Number(edition.ano) !== 2026) return;
  document.querySelector(".awards-edition-app-invite")?.remove();
  const now = serverNow();
  const ended = edition.votacao_fim && now > new Date(edition.votacao_fim).getTime();
  const appOpen = edition.status === "votacao_aberta" && edition.votacao_inicio && now >= new Date(edition.votacao_inicio).getTime();
  const siteOpen = isVotingOpen(edition);
  const dateLabel = value => value ? new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "data a confirmar";
  const copy = ended
    ? ["Acompanhe o Viva Urânia", "A votação foi encerrada. Acompanhe as novidades do prêmio pelo aplicativo.", "Conhecer o Viva Urânia"]
    : edition.status !== "votacao_aberta" && edition.votacao_inicio && now >= new Date(edition.votacao_inicio).getTime()
      ? ["Aguarde a abertura oficial", "A votação ainda não foi ativada. Conheça o Viva Urânia enquanto preparamos a premiação.", "Conhecer o Viva Urânia"]
      : !appOpen
        ? ["Vote primeiro pelo Viva Urânia!", `A votação do Melhores de Urânia 2026 começa em ${dateLabel(edition.votacao_inicio)} pelo aplicativo. Baixe agora e prepare-se para participar!`, "Baixar o Viva Urânia"]
        : !siteOpen
          ? ["A votação já começou no Viva Urânia!", `Você já pode participar pelo aplicativo. A votação no site Eu Amo Urânia começa em ${dateLabel(edition.votacao_inicio_site)}.`, "Votar pelo aplicativo"]
          : ["Você também pode votar pelo Viva Urânia!", "Além do site, o aplicativo Viva Urânia também participa da votação do Melhores de Urânia 2026.", "Baixar o aplicativo"];
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent || "");
  const card = document.createElement("aside");
  card.className = "awards-edition-app-invite";
  card.setAttribute("aria-label", "Viva Urânia");
  card.innerHTML = `<div><strong>${esc(copy[0])}</strong><p>${esc(copy[1])}</p>${ios ? "<small>O aplicativo ainda não está disponível para iOS.</small>" : ""}</div>
    <a href="${esc(appHref())}" target="_blank" rel="noopener noreferrer">${esc(ios ? "Conhecer o Viva Urânia" : copy[2])} ↗</a>`;
  if (appOpen && !ended && !siteOpen) document.getElementById("edition-panel")?.append(card);
}

async function init() {
  const hasSsr = document.getElementById("vote-area")?.dataset.serverRendered === "true"
    || document.getElementById("edition-hub")?.dataset.serverRendered === "true";
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      if (!hasSsr) {
        document.getElementById("vote-area").innerHTML = '<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>';
        document.getElementById("indication-area").innerHTML = '<div class="awards-empty">Indicações indisponíveis para esta edição.</div>';
      }
      return;
    }
    loadTurnstile().catch(() => {});
    const [period, download, categories, nominees] = await Promise.all([
      consultarPeriodoVotacao(edition.id), getAppDownloadConfig(),
      listarCategoriasPublicas(edition.id), listarIndicadosPublicos(edition.id)
    ]);
    voteClock = { agora: new Date(period.agora).getTime(), recebido: performance.now() };
    reconcileVotes(edition.id, period.votos_site);
    edition.status = period.status;
    edition.votacao_inicio = period.votacao_inicio_app;
    edition.votacao_inicio_site = period.votacao_inicio_site;
    edition.votacao_fim = period.votacao_fim;
    appDownload = download;
    const open = isVotingOpen(edition);
    registrarEventoMelhores("melhores_edition_view", {
      edicaoId: edition.id,
      metadados: { ano: edition.ano, status: edition.status, votacao_aberta: open }
    });
    setMeta(edition);
    renderHero(edition);

    renderEditionHub(edition, categories, nominees);
    orderSectionsForPhase(edition);
    renderEditionAppInvite(edition);
    renderVoting(edition, categories, nominees);
    observeNomineeImpressions();
    renderIndications(edition, categories);
    const initialPhase = () => [edition.status, isVotingOpen(edition),
      !!(edition.votacao_inicio && serverNow() >= new Date(edition.votacao_inicio).getTime()),
      !!(edition.votacao_fim && serverNow() > new Date(edition.votacao_fim).getTime())].join("|");
    let previousPhase = initialPhase();
    window.setInterval(async () => {
      try {
        const latest = await consultarPeriodoVotacao(edition.id);
        voteClock = { agora: new Date(latest.agora).getTime(), recebido: performance.now() };
        edition.status = latest.status;
        edition.votacao_inicio = latest.votacao_inicio_app;
        edition.votacao_inicio_site = latest.votacao_inicio_site;
        edition.votacao_fim = latest.votacao_fim;
        const phase = initialPhase();
        if (phase !== previousPhase) location.reload();
        previousPhase = phase;
      } catch { /* Falha de atualização não libera votação no backend. */ }
    }, 60000);
  } catch (error) {
    console.error("Melhores de Urânia:", error);
    if (!hasSsr) {
      document.getElementById("vote-area").innerHTML = '<div class="awards-empty">Não foi possível carregar esta edição agora.</div>';
      document.getElementById("indication-area").innerHTML = '<div class="awards-empty">Não foi possível carregar as indicações agora.</div>';
    }
  }
}

document.addEventListener("click", async event => {
  const scroll = event.target.closest("[data-scroll-category]");
  if (scroll) {
    document.querySelectorAll("[data-scroll-category]").forEach(button => button.classList.toggle("active", button === scroll));
    document.getElementById(`categoria-${scroll.dataset.scrollCategory}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    registrarEventoMelhores("melhores_category_view", {
      metadados: { categoria_id: scroll.dataset.scrollCategory }
    });
  }
  const vote = event.target.closest("[data-vote]");
  if (!vote || vote.disabled) return;
  vote.disabled = true;
  vote.textContent = "Registrando…";
  registrarEventoMelhores("melhores_vote_start", {
    edicaoId: vote.dataset.edition,
    metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee }
  });
  activeVoteAttempt = {
    edicaoId: vote.dataset.edition,
    metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee }
  };
  try {
    const turnstileToken = await getTurnstileToken("vote");
    await enviarVotoMelhores({
      edicao_id: vote.dataset.edition,
      categoria_id: vote.dataset.category,
      indicado_id: vote.dataset.nominee,
      origem: "site",
      pagina: location.pathname,
      turnstile_token: turnstileToken
    });
    activeVoteAttempt = null;
    saveVote(vote.dataset.edition, vote.dataset.category, vote.dataset.nominee);
    const storedVotes = votesFor(readVotes(vote.dataset.edition), vote.dataset.category);
    const reachedLimit = storedVotes.length >= Number(vote.dataset.maxChoices || 1);
    document.querySelectorAll(`[data-category="${vote.dataset.category}"]`).forEach(button => {
      const isAlreadyVoted = storedVotes.includes(button.dataset.nominee);
      button.disabled = isAlreadyVoted || reachedLimit;
      button.textContent = button === vote ? "Voto registrado" : "Voto já registrado";
      button.closest(".awards-nominee-card")?.classList.toggle("awards-voted", button === vote);
    });
    document.querySelectorAll(`[data-category="${vote.dataset.category}"]`).forEach(button => {
      const isAlreadyVoted = storedVotes.includes(button.dataset.nominee);
      button.disabled = isAlreadyVoted || reachedLimit;
      button.textContent = isAlreadyVoted ? "Voto registrado" : reachedLimit ? "Limite atingido" : "Votar";
      button.closest(".awards-nominee-card")?.classList.toggle("awards-voted", isAlreadyVoted);
    });
    registrarEventoMelhores("melhores_vote_complete", {
      edicaoId: vote.dataset.edition,
      metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee }
    });
    toast("Voto registrado com sucesso. Obrigado por participar!");
    const next = [...document.querySelectorAll(".awards-nominee-group")]
      .find(group => group.querySelector("[data-vote]:not(:disabled)"));
    if (next) {
      const categoryId = next.id.replace(/^categoria-/, "");
      document.querySelectorAll("[data-scroll-category]").forEach(button => button.classList.toggle("active", button.dataset.scrollCategory === categoryId));
      next.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    } else {
      showPostVotePanel(vote.dataset.edition, vote);
    }
  } catch (error) {
    activeVoteAttempt = null;
    vote.disabled = false;
    vote.textContent = "Votar";
    registrarEventoMelhores("melhores_vote_error", {
      edicaoId: vote.dataset.edition,
      metadados: { categoria_id: vote.dataset.category, indicado_id: vote.dataset.nominee, erro: error.message }
    });
    toast(error instanceof TypeError
      ? "Não foi possível confirmar a resposta. Tente novamente; um voto já salvo não será duplicado."
      : error.message);
  }
});

document.addEventListener("submit", async event => {
  const form = event.target.closest("#awards-indication-form");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Enviando…";
  const edicaoId = form.dataset.editionId;
  registrarEventoMelhores("melhores_indication_start", {
    edicaoId,
    metadados: { categoria_id: form.elements.categoria_id.value }
  });
  try {
    const turnstileToken = await getTurnstileToken("indication");
    const data = await enviarIndicacaoMelhores({
      edicao_id: edicaoId,
      categoria_id: form.elements.categoria_id.value,
      nome_indicado: form.elements.nome_indicado.value,
      website: form.elements.website.value,
      turnstile_token: turnstileToken,
      pagina: location.pathname
    });
    registrarEventoMelhores("melhores_indication_complete", {
      edicaoId,
      metadados: { categoria_id: form.elements.categoria_id.value, indicacao_id: data.indicacao_id }
    });
    form.reset();
    toast(data.message || "Indicação enviada com sucesso.");
  } catch (error) {
    registrarEventoMelhores("melhores_indication_error", {
      edicaoId,
      metadados: { categoria_id: form.elements.categoria_id.value, erro: error.message }
    });
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Enviar indicação";
  }
});

document.addEventListener("click", event => {
  const cta = event.target.closest("[data-awards-edition-cta]");
  if (!cta) return;
  registrarEventoMelhores("melhores_cta_click", {
    edicaoId: cta.dataset.editionId || null,
    destino: cta.href,
    metadados: { origem_cta: "hero_edicao" }
  });
});

document.addEventListener("click", async event => {
  const share = event.target.closest("[data-share-edition]");
  if (!share) return;
  await sharePage({
    title: document.title,
    text: "Acompanhe o Melhores de Urânia.",
    url: location.href
  });
  registrarEventoMelhores("melhores_share_click", {
    edicaoId: share.dataset.editionId || null,
    destino: location.href,
    metadados: { canal: "native", origem: "edicao" }
  });
});

let activeVoteAttempt = null;

window.addEventListener("pagehide", () => {
  if (!activeVoteAttempt) return;
  registrarEventoMelhores("melhores_vote_abandon", {
    edicaoId: activeVoteAttempt.edicaoId,
    metadados: activeVoteAttempt.metadados
  });
});

document.addEventListener("click", async event => {
  const close = event.target.closest(".awards-post-close");
  if (close) {
    close.closest(".awards-post-vote")?.remove();
    return;
  }
  const share = event.target.closest("[data-awards-share]");
  if (!share) return;
  const panel = share.closest(".awards-post-vote");
  registrarEventoMelhores("melhores_share_click", {
    edicaoId: panel?.dataset.editionId || null,
    destino: share.href || location.href,
    metadados: { canal: share.dataset.awardsShare || "native" }
  });
  if (share.dataset.awardsShare === "native" && navigator.share) {
    event.preventDefault();
    await navigator.share({
      title: document.title,
      text: "Participe do Melhores de Urânia.",
      url: location.href.split("#")[0]
    }).catch(() => null);
  }
});

init();
