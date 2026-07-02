import { callPublicRpc, fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safe = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const topPositions = new Set(["todas_paginas", "home_topo", "noticias_topo", "guia_topo", "turismo_topo", "eventos_topo"]);
const placedCampaigns = new Set();
const tracked = new Set();
let campaigns = [];
let legacy = false;

const config = campaign => campaign.configuracao_futura && typeof campaign.configuracao_futura === "object"
  ? campaign.configuracao_futura
  : {};
const format = campaign => ["automatico", "super_banner", "horizontal", "retangulo", "quadrado", "vertical", "nativo"].includes(config(campaign).formato)
  ? config(campaign).formato
  : "automatico";
const positions = campaign => (campaign.campanha_posicoes || []).map(item => item.posicao);

function youtube(url) {
  const match = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : "";
}

function track(id, type) {
  if (!id || legacy) return;
  const key = `${type}:${id}:${location.pathname}`;
  if (type === "impressao" && tracked.has(key)) return;
  tracked.add(key);
  callPublicRpc("registrar_evento_publicidade", {
    p_campanha: id,
    p_tipo: type
  }, { timeout: 4000, keepalive: true }).catch(() => {});
}

function media(campaign, position = "", popup = false) {
  const image = safe(campaign.imagem_url);
  const mobile = safe(config(campaign).imagem_mobile_url);
  const video = safe(campaign.video_url);
  const youtubeUrl = youtube(campaign.video_url);
  if ((campaign.tipo === "video" || popup) && youtubeUrl) {
    return `<iframe src="${youtubeUrl}" title="${esc(campaign.nome)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  if ((campaign.tipo === "video" || popup) && video) {
    return `<video src="${video}" controls playsinline preload="metadata"></video>`;
  }
  if (!image) return "";
  const eager = topPositions.has(position);
  return `<picture class="ad-campaign-picture">${mobile ? `<source media="(max-width:650px)" srcset="${mobile}">` : ""}<img src="${image}" alt="${esc(config(campaign).texto_alternativo || campaign.empresa_anunciante || "Publicidade")}" ${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
}

function creative(campaign, position) {
  const content = media(campaign, position);
  if (!content) return "";
  const settings = config(campaign);
  const selectedFormat = format(campaign);
  const title = settings.titulo_publico || (selectedFormat === "nativo" ? campaign.empresa_anunciante : "");
  const description = settings.texto_publico || "";
  const logo = safe(campaign.logo_empresa_url)
    ? `<img class="ad-campaign-logo" src="${safe(campaign.logo_empresa_url)}" alt="${esc(campaign.empresa_anunciante)}" loading="lazy" decoding="async">`
    : "";
  const callToAction = campaign.texto_botao
    ? `<span class="ad-campaign-button">${esc(campaign.texto_botao)}</span>`
    : "";
  const copy = title || description
    ? `<span class="ad-campaign-copy">${title ? `<strong>${esc(title)}</strong>` : ""}${description ? `<span>${esc(description)}</span>` : ""}${callToAction}</span>`
    : callToAction;
  const body = `<span class="ad-sponsored">Publicidade</span>${content}${logo}${copy}`;
  const classes = `banner-item ad-campaign ad-format-${selectedFormat}${settings.imagem_mobile_url ? " has-mobile" : ""}`;
  return safe(campaign.link_destino)
    ? `<a class="${classes}" data-campaign-id="${campaign.id}" href="${safe(campaign.link_destino)}" ${campaign.abrir_nova_aba ? 'target="_blank" rel="noopener sponsored"' : 'rel="sponsored"'}>${body}</a>`
    : `<div class="${classes}" data-campaign-id="${campaign.id}">${body}</div>`;
}

function hasRenderableMedia(campaign) {
  if (campaign.tipo === "video") {
    return Boolean(youtube(campaign.video_url) || safe(campaign.video_url) || safe(campaign.imagem_url));
  }
  return Boolean(safe(campaign.imagem_url));
}

function candidates(position) {
  return campaigns
    .filter(campaign => campaign.tipo !== "popup"
      && positions(campaign).includes(position)
      && !placedCampaigns.has(campaign.id)
      && hasRenderableMedia(campaign))
    .sort((a, b) => Number(b.prioridade || 0) - Number(a.prioridade || 0));
}

function zoneMarkup(position, items, inline = false) {
  const slides = items.map((campaign, index) => {
    const content = creative(campaign, position);
    return content ? `<div class="ad-slide ${index === 0 ? "active" : ""}" data-ad-slide="${index}" ${index === 0 ? "" : "hidden"}>${content}</div>` : "";
  }).filter(Boolean);
  if (!slides.length) return "";
  const controls = slides.length > 1
    ? `<div class="ad-rotator-controls"><button type="button" data-ad-step="-1" aria-label="Anúncio anterior">‹</button><div class="ad-rotator-dots">${slides.map((_, index) => `<button type="button" data-ad-index="${index}" class="${index === 0 ? "active" : ""}" aria-label="Ver anúncio ${index + 1}"></button>`).join("")}</div><button type="button" data-ad-step="1" aria-label="Próximo anúncio">›</button></div>`
    : "";
  const rotator = `<div class="ad-rotator" data-ad-current="0">${slides.join("")}${controls}</div>`;
  return `<aside class="banner-zone ad-zone ${inline ? "ad-zone-inline" : ""}" data-banner="${position}" aria-label="Publicidade">${inline ? rotator : `<div class="container banner-list">${rotator}</div>`}</aside>`;
}

function observeImpression(node) {
  const id = node?.dataset.campaignId;
  if (!id) return;
  if (!("IntersectionObserver" in window)) {
    track(id, "impressao");
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .45)) {
      track(id, "impressao");
      observer.disconnect();
    }
  }, { threshold: [.45] });
  observer.observe(node);
}

function setupRotator(zone, items) {
  const rotator = zone.querySelector(".ad-rotator");
  const slides = [...zone.querySelectorAll(".ad-slide")];
  const dots = [...zone.querySelectorAll("[data-ad-index]")];
  if (!rotator || !slides.length) return;
  let current = 0;
  const activate = index => {
    current = (index + slides.length) % slides.length;
    rotator.dataset.adCurrent = String(current);
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === current;
      slide.hidden = !active;
      slide.classList.toggle("active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => dot.classList.toggle("active", dotIndex === current));
    observeImpression(slides[current].querySelector("[data-campaign-id]"));
  };
  const stop = () => {
    if (rotator._adTimer) clearInterval(rotator._adTimer);
    rotator._adTimer = null;
  };
  const start = () => {
    stop();
    if (slides.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seconds = Math.max(5, Math.min(30, Number(config(items[current]).rotacao_segundos) || 8));
    rotator._adTimer = setInterval(() => activate(current + 1), seconds * 1000);
  };
  zone.addEventListener("click", event => {
    const step = event.target.closest("[data-ad-step]");
    const dot = event.target.closest("[data-ad-index]");
    if (step) activate(current + Number(step.dataset.adStep));
    if (dot) activate(Number(dot.dataset.adIndex));
    if (step || dot) start();
  });
  zone.addEventListener("mouseenter", stop);
  zone.addEventListener("mouseleave", start);
  zone.addEventListener("focusin", stop);
  zone.addEventListener("focusout", start);
  activate(0);
  start();
}

function insertZone(position, target, where = "beforebegin", inline = false) {
  if (document.querySelector(`[data-banner="${position}"]`)) return false;
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return false;
  const items = candidates(position);
  const html = zoneMarkup(position, items, inline);
  if (!html) return false;
  element.insertAdjacentHTML(where, html);
  items.forEach(campaign => placedCampaigns.add(campaign.id));
  const zone = document.querySelector(`[data-banner="${position}"]`);
  setupRotator(zone, items);
  return true;
}

function insertBetweenCards(position, containerSelector, cardSelector, afterIndex) {
  if (document.querySelector(`[data-banner="${position}"]`)) return;
  const container = document.querySelector(containerSelector);
  const cards = container ? [...container.querySelectorAll(cardSelector)] : [];
  if (!cards.length) return;
  insertZone(position, cards[Math.min(afterIndex, cards.length - 1)], "afterend", true);
}

function insertInsideArticle() {
  const position = "noticia_meio";
  if (document.querySelector(`[data-banner="${position}"]`)) return;
  const article = document.querySelector(".article-copy");
  if (!article) return;
  const blocks = [...article.children].filter(node => /^(P|H2|H3|BLOCKQUOTE|FIGURE|UL|OL)$/.test(node.tagName));
  if (!blocks.length) return;
  const index = Math.min(blocks.length - 1, Math.max(1, Math.floor(blocks.length / 2)));
  insertZone(position, blocks[index], "afterend", true);
}

function render() {
  const path = location.pathname;
  insertZone("todas_paginas", "main");
  if (path === "/" || path === "/index.html") {
    insertZone("home_topo", ".hero");
    insertZone("home_hero_conteudo", ".hero", "afterend");
    insertZone("home_entre_secoes", ".destination");
    insertZone("home_rodape", ".site-footer");
  }
  if (/\/news\/?(?:index\.html)?$/.test(path) || path.endsWith("news.html")) {
    insertZone("noticias_topo", ".page-hero");
    insertBetweenCards("noticias_entre_listagem", "#news-container", ".news-item", 3);
  }
  if (path.includes("news-details") || path.includes("news-detalhes") || path.startsWith("/noticias/")) {
    insertInsideArticle();
    insertZone("noticia_final", ".related-news");
  }
  if (path.endsWith("guia.html")) {
    insertZone("guia_topo", ".page-hero");
    insertBetweenCards("guia_entre_estabelecimentos", "#guia-container", ".card-guia", 5);
    insertZone("guia_rodape", ".site-footer");
  }
  if (path.endsWith("turismo.html")) {
    insertZone("turismo_topo", ".page-hero");
    insertBetweenCards("turismo_entre_cartoes", "#turismo-container", ".card-guia", 2);
    insertZone("turismo_rodape", ".site-footer");
  }
  if (path.includes("/eventos")) {
    insertZone("eventos_topo", ".page-hero");
    insertBetweenCards("eventos_entre_eventos", "#eventos-list", ".event-card", 2);
    insertZone("eventos_rodape", ".site-footer");
  }
}

function canShowPopup(campaign) {
  if (campaign.popup_reexibir === "sempre") return true;
  const last = Number(localStorage.getItem(`euamourania:ad:${campaign.id}`) || 0);
  if (!last) return true;
  const wait = campaign.popup_reexibir === "7d" ? 604800000 : 86400000;
  return Date.now() - last >= wait;
}

function showPopup(campaign) {
  const content = media(campaign, "popup", true);
  if (document.querySelector(".ad-popup") || !canShowPopup(campaign) || !content) return;
  setTimeout(() => {
    if (document.querySelector(".ad-popup")) return;
    const close = campaign.popup_botao_fechar
      ? '<button class="ad-popup-close" aria-label="Fechar anúncio">×</button>'
      : "";
    const callToAction = campaign.texto_botao
      ? `<span class="ad-campaign-button">${esc(campaign.texto_botao)}</span>`
      : "";
    const linked = safe(campaign.link_destino)
      ? `<a href="${safe(campaign.link_destino)}" data-campaign-id="${campaign.id}" ${campaign.abrir_nova_aba ? 'target="_blank" rel="noopener sponsored"' : 'rel="sponsored"'}>${content}${callToAction}</a>`
      : content;
    document.body.insertAdjacentHTML("beforeend", `<div class="ad-popup" role="dialog" aria-modal="true" aria-label="Publicidade"><div class="ad-popup-backdrop"></div><div class="ad-popup-card">${close}${linked}</div></div>`);
    localStorage.setItem(`euamourania:ad:${campaign.id}`, String(Date.now()));
    track(campaign.id, "impressao");
    const dismiss = () => document.querySelector(".ad-popup")?.remove();
    document.querySelector(".ad-popup-close")?.addEventListener("click", dismiss);
    document.querySelector(".ad-popup-backdrop")?.addEventListener("click", () => {
      if (campaign.popup_botao_fechar) dismiss();
    });
  }, Math.max(0, Number(campaign.popup_atraso_seg) || 0) * 1000);
}

function legacyToCampaign(rows) {
  legacy = true;
  return rows.map(banner => ({
    id: banner.id,
    nome: banner.titulo,
    empresa_anunciante: banner.titulo,
    tipo: "banner",
    imagem_url: banner.imagem_url,
    link_destino: banner.link_url,
    abrir_nova_aba: true,
    configuracao_futura: { formato: "automatico" },
    campanha_posicoes: [{
      posicao: ({
        home_meio: "home_entre_secoes",
        noticias_meio: "noticias_entre_listagem",
        noticia_individual_meio: "noticia_meio",
        noticia_individual_final: "noticia_final",
        guia_meio: "guia_entre_estabelecimentos",
        turismo_meio: "turismo_entre_cartoes"
      }[banner.posicao] || banner.posicao)
    }]
  }));
}

async function init() {
  if (!publicSupabaseConfigured()) return;
  try {
    campaigns = await fetchPublicRows("campanhas_publicitarias", {
      select: "*,campanha_posicoes(posicao)",
      status: "eq.ativo",
      order: "prioridade.desc,criado_em.desc"
    }, { ttl: 60000 });
  } catch (error) {
    try {
      campaigns = legacyToCampaign(await fetchPublicRows("banners", {
        select: "*",
        status: "eq.ativo",
        order: "ordem.asc"
      }, { ttl: 60000 }));
    } catch {
      console.warn("Publicidade indisponível:", error.message);
      return;
    }
  }
  render();
  campaigns
    .filter(campaign => campaign.tipo === "popup")
    .sort((a, b) => Number(b.prioridade || 0) - Number(a.prioridade || 0))
    .slice(0, 1)
    .forEach(showPopup);
  document.addEventListener("click", event => {
    const node = event.target.closest("[data-campaign-id]");
    if (node && !event.target.closest("[data-ad-step],[data-ad-index]")) track(node.dataset.campaignId, "clique");
  });
  if (campaigns.length) {
    const observer = new MutationObserver(render);
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }
}

init();
