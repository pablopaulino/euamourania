import { callPublicRpc, fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safe = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const topPositions = new Set();
const disabledTopPositions = new Set(["home_topo", "noticias_topo", "guia_topo", "turismo_topo", "eventos_topo"]);
const trackedImpressions = new Set();
const adsenseAttempted = new Set();
const adsense = {
  client: "ca-pub-6427480219886739",
  maxPerPage: 3,
  slots: {
    topo: "1899945573",
    listagens: "8841557208",
    noticias: "9680985838",
    noticiaMeio: "6769128877",
    finalRodape: "3031817003"
  }
};
let campaigns = [];
let legacy = false;
let adsenseCount = 0;

const config = campaign => campaign.configuracao_futura && typeof campaign.configuracao_futura === "object"
  ? campaign.configuracao_futura
  : {};
const format = campaign => ["automatico", "super_banner", "horizontal", "retangulo", "quadrado", "vertical", "nativo"].includes(config(campaign).formato)
  ? config(campaign).formato
  : "automatico";
const positions = campaign => (campaign.campanha_posicoes || []).map(item => item.posicao);
const rotationSeconds = campaign => Math.max(5, Math.min(30, Number(config(campaign).rotacao_segundos) || 8));
const priorityWeight = campaign => 1 + Math.log2(1 + Math.max(0, Number(campaign.prioridade) || 0));

function isCampaignActive(campaign, requirePosition = true) {
  const now = Date.now();
  const starts = campaign.data_inicio ? new Date(campaign.data_inicio).getTime() : null;
  const ends = campaign.data_fim ? new Date(campaign.data_fim).getTime() : null;
  return campaign.status === "ativo"
    && (!starts || starts <= now)
    && (!ends || ends >= now)
    && (!requirePosition || positions(campaign).length > 0);
}

function automaticLayout(position, campaign) {
  if (["noticias_entre_listagem", "noticia_meio", "guia_entre_estabelecimentos", "turismo_entre_cartoes", "eventos_entre_eventos"].includes(position)) {
    return config(campaign).titulo_publico || config(campaign).texto_publico ? "nativo" : "retangulo";
  }
  if (position === "todas_paginas") {
    return config(campaign).titulo_publico || config(campaign).texto_publico ? "nativo" : "horizontal";
  }
  if (position.endsWith("_rodape")) return "horizontal";
  return "super_banner";
}

function weightedIndex(items, excluded = -1) {
  const available = items.map((campaign, index) => ({ index, weight: priorityWeight(campaign) }))
    .filter(item => item.index !== excluded);
  if (!available.length) return excluded >= 0 ? excluded : 0;
  const total = available.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of available) {
    cursor -= item.weight;
    if (cursor <= 0) return item.index;
  }
  return available[available.length - 1].index;
}

function youtube(url) {
  const match = String(url || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : "";
}

function track(id, type, position = "geral") {
  if (!id || legacy) return;
  const key = `${id}:${position}:${location.pathname}`;
  if (type === "impressao" && trackedImpressions.has(key)) return;
  if (type === "impressao") trackedImpressions.add(key);
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
  const settings = config(campaign);
  const selectedFormat = format(campaign);
  const layout = selectedFormat === "automatico" ? automaticLayout(position, campaign) : selectedFormat;
  const content = media(campaign, position);
  if (!content && layout !== "nativo") return "";
  const title = settings.titulo_publico || (layout === "nativo" ? campaign.empresa_anunciante : "");
  const description = settings.texto_publico || "";
  const logo = safe(campaign.logo_empresa_url)
    ? `<img class="ad-campaign-logo" src="${safe(campaign.logo_empresa_url)}" alt="${esc(campaign.empresa_anunciante)}" loading="lazy" decoding="async">`
    : "";
  const buttonText = campaign.texto_botao || (campaign.link_destino ? "Veja agora" : "");
  const callToAction = buttonText
    ? `<span class="ad-campaign-button">${esc(buttonText)}</span>`
    : "";
  const copy = title || description
    ? `<span class="ad-campaign-copy">${title ? `<strong>${esc(title)}</strong>` : ""}${description ? `<span>${esc(description)}</span>` : ""}</span>`
    : "";
  const campaignName = !copy && !logo && callToAction && campaign.empresa_anunciante
    ? `<span class="ad-campaign-copy"><strong>${esc(campaign.empresa_anunciante)}</strong></span>`
    : "";
  const panel = logo || copy || campaignName || callToAction
    ? `<span class="ad-campaign-panel">${logo}${copy || campaignName}${callToAction}</span>`
    : "";
  const nativePlaceholder = !content && layout === "nativo"
    ? `<span class="ad-native-placeholder">${safe(campaign.logo_empresa_url) ? `<img class="ad-native-logo" src="${safe(campaign.logo_empresa_url)}" alt="${esc(campaign.empresa_anunciante)}" loading="lazy" decoding="async">` : `<strong>${esc(campaign.empresa_anunciante || "Publicidade")}</strong>`}</span>`
    : "";
  const body = `<span class="ad-sponsored">Publicidade</span>${content || nativePlaceholder}${panel}`;
  const classes = `banner-item ad-campaign ad-format-${selectedFormat} ad-layout-${layout}${content ? "" : " no-media"}${panel ? " has-panel" : ""}${settings.imagem_mobile_url ? " has-mobile" : ""}`;
  return safe(campaign.link_destino)
    ? `<a class="${classes}" data-campaign-id="${campaign.id}" href="${safe(campaign.link_destino)}" ${campaign.abrir_nova_aba ? 'target="_blank" rel="noopener sponsored"' : 'rel="sponsored"'}>${body}</a>`
    : `<div class="${classes}" data-campaign-id="${campaign.id}">${body}</div>`;
}

function hasRenderableMedia(campaign, position = "") {
  const selectedFormat = format(campaign);
  const layout = selectedFormat === "automatico" && position ? automaticLayout(position, campaign) : selectedFormat;
  const hasNativeCopy = Boolean(config(campaign).titulo_publico || config(campaign).texto_publico);
  if (campaign.tipo === "video") {
    return Boolean(youtube(campaign.video_url) || safe(campaign.video_url) || safe(campaign.imagem_url));
  }
  return Boolean(safe(campaign.imagem_url) || (layout === "nativo" && hasNativeCopy));
}

function candidates(position) {
  if (disabledTopPositions.has(position)) return [];
  return campaigns
    .filter(campaign => campaign.tipo !== "popup"
      && positions(campaign).includes(position)
      && isCampaignActive(campaign)
      && hasRenderableMedia(campaign, position))
    .sort((a, b) => Number(b.prioridade || 0) - Number(a.prioridade || 0));
}

function hasAdConsent() {
  try {
    return localStorage.getItem("cookieConsent") === "accepted"
      && localStorage.getItem("cookieConsentVersion") === "2";
  } catch {
    return false;
  }
}

function loadAdSenseScript() {
  if (document.querySelector('script[data-euamourania-adsense]')) return;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.euamouraniaAdsense = "true";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsense.client)}`;
  document.head.append(script);
}

function activateAdSense(zone) {
  const unit = zone.querySelector(".adsbygoogle");
  if (!unit) return;
  loadAdSenseScript();
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (error) {
    console.warn("AdSense indisponível:", error.message);
  }
  const observer = new MutationObserver(() => {
    if (unit.dataset.adStatus === "unfilled") {
      observer.disconnect();
      zone.remove();
    }
  });
  observer.observe(unit, { attributes: true, attributeFilter: ["data-ad-status"] });
  setTimeout(() => {
    observer.disconnect();
    if (!unit.dataset.adStatus && !unit.offsetHeight) {
      zone.remove();
    }
  }, 12000);
}

function insertAdSenseZone(position, slot, target, where = "beforebegin", inline = false) {
  if (disabledTopPositions.has(position)) return false;
  if (!hasAdConsent() || !slot || adsenseCount >= adsense.maxPerPage) return false;
  if (adsenseAttempted.has(position)) return false;
  if (document.querySelector(`[data-banner="${position}"]`) || candidates(position).length) return false;
  const element = typeof target === "string" ? document.querySelector(target) : target;
  if (!element) return false;
  const classes = `banner-zone ad-zone adsense-zone ${inline ? "ad-zone-inline" : ""}`;
  const unit = `<div class="adsense-unit"><span class="adsense-label">Publicidade</span><ins class="adsbygoogle" style="display:block" data-ad-client="${adsense.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
  element.insertAdjacentHTML(where, `<aside class="${classes}" data-banner="${position}" data-ad-provider="google" aria-label="Publicidade do Google">${inline ? unit : `<div class="container banner-list">${unit}</div>`}</aside>`);
  const zone = document.querySelector(`[data-banner="${position}"][data-ad-provider="google"]`);
  if (!zone) return false;
  adsenseAttempted.add(position);
  adsenseCount += 1;
  activateAdSense(zone);
  return true;
}

function insertAdSenseBetweenCards(position, slot, containerSelector, cardSelector, afterIndex) {
  if (document.querySelector(`[data-banner="${position}"]`)) return;
  const container = document.querySelector(containerSelector);
  const cards = container ? [...container.querySelectorAll(cardSelector)] : [];
  if (!cards.length) return;
  insertAdSenseZone(position, slot, cards[Math.min(afterIndex, cards.length - 1)], "afterend", true);
}

function insertAdSenseInsideArticle() {
  const position = "noticia_meio";
  if (document.querySelector(`[data-banner="${position}"]`)) return;
  const article = document.querySelector(".article-copy");
  if (!article) return;
  const blocks = [...article.children].filter(node => /^(P|H2|H3|BLOCKQUOTE|FIGURE|UL|OL)$/.test(node.tagName));
  if (!blocks.length) return;
  const index = Math.min(blocks.length - 1, Math.max(1, Math.floor(blocks.length / 2)));
  insertAdSenseZone(position, adsense.slots.noticiaMeio, blocks[index], "afterend", true);
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

function observeImpression(node, position) {
  const id = node?.dataset.campaignId;
  if (!id) return;
  if (!("IntersectionObserver" in window)) {
    track(id, "impressao", position);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .45)) {
      track(id, "impressao", position);
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
  let current = weightedIndex(items);
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
    observeImpression(slides[current].querySelector("[data-campaign-id]"), zone.dataset.banner);
  };
  const stop = () => {
    if (rotator._adTimer) clearTimeout(rotator._adTimer);
    rotator._adTimer = null;
  };
  const start = () => {
    stop();
    if (slides.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seconds = rotationSeconds(items[current]);
    rotator._adTimer = setTimeout(() => {
      activate(weightedIndex(items, current));
      start();
    }, seconds * 1000);
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
  activate(current);
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

function insertRepeatedBetweenCards(position, containerSelector, cardSelector, interval) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  const cards = [...container.querySelectorAll(cardSelector)];
  const items = candidates(position);
  if (!cards.length || !items.length) return;
  for (let index = interval - 1; index < cards.length - 1; index += interval) {
    const next = cards[index].nextElementSibling;
    if (next?.matches(`[data-banner="${position}"][data-inline-list-ad="true"]`)) continue;
    const html = zoneMarkup(position, items, true);
    if (!html) return;
    cards[index].insertAdjacentHTML("afterend", html.replace("<aside ", '<aside data-inline-list-ad="true" '));
    const zone = cards[index].nextElementSibling?.matches(`[data-banner="${position}"]`) ? cards[index].nextElementSibling : null;
    if (zone) setupRotator(zone, items);
  }
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

function insertFirstAvailable(position, targets, where = "beforebegin", inline = false) {
  return targets.some(target => insertZone(position, target, where, inline));
}

function insertGlobalZone() {
  const footer = document.querySelector(".site-footer, footer");
  if (footer) return insertZone("todas_paginas", footer, "beforebegin");
  const main = document.querySelector("main");
  return main ? insertZone("todas_paginas", main, "beforeend") : false;
}

function render() {
  const path = location.pathname;
  if (path === "/" || path === "/index.html") {
    insertZone("home_hero_conteudo", ".hero", "afterend");
    insertZone("home_entre_secoes", ".destination");
    insertZone("home_rodape", ".site-footer");
  }
  if (/\/news\/?(?:index\.html)?$/.test(path) || path.endsWith("news.html")) {
    insertRepeatedBetweenCards("noticias_entre_listagem", "#news-container", ".news-item", 6);
  }
  if (path.includes("news-details") || path.includes("news-detalhes") || path.startsWith("/noticias/")) {
    insertInsideArticle();
    insertZone("noticia_final", ".related-news");
  }
  if (path.endsWith("guia.html")) {
    insertRepeatedBetweenCards("guia_entre_estabelecimentos", "#guia-container", ".card-guia", 6);
    insertZone("guia_rodape", ".site-footer");
  }
  if (path.includes("guia-details") || path.startsWith("/guia/")) {
    insertFirstAvailable("guia_entre_estabelecimentos", [".guide-related-sections", ".guide-business-actions", ".tourism-detail-layout", "main"], "afterend", true);
    insertZone("guia_rodape", ".site-footer");
  }
  if (path.endsWith("turismo.html")) {
    insertBetweenCards("turismo_entre_cartoes", "#turismo-container", ".card-guia", 2);
    insertZone("turismo_rodape", ".site-footer");
  }
  if (path.includes("turismo-details")) {
    insertFirstAvailable("turismo_entre_cartoes", [".tourism-related-sections", ".tourism-detail-layout", ".tourism-detail-content", "main"], "afterend", true);
    insertZone("turismo_rodape", ".site-footer");
  }
  if (path.includes("/eventos")) {
    insertBetweenCards("eventos_entre_eventos", "#eventos-list", ".event-card", 2);
    insertFirstAvailable("eventos_entre_eventos", [".evento-edicoes", ".event-editions", ".event-detail-content", ".event-main-content", "main"], "afterend", true);
    insertZone("eventos_rodape", ".site-footer");
  }
  if (path.includes("/links") || path.includes("/urania") || path.includes("/colabore") || path.includes("/categorias") || path.endsWith("quem-somos.html")) {
    insertFirstAvailable("home_entre_secoes", [".newsletter-section", ".urania-cta", ".links-footer-actions", ".editorial-newsletter", ".site-footer"], "beforebegin");
  }
  insertGlobalZone();
}

document.addEventListener("guia:renderizado", () => insertRepeatedBetweenCards("guia_entre_estabelecimentos", "#guia-container", ".card-guia", 6));
document.addEventListener("noticias:renderizado", () => insertRepeatedBetweenCards("noticias_entre_listagem", "#news-container", ".news-item", 6));

function renderAdSense() {
  if (!hasAdConsent()) return;
  const path = location.pathname;
  if (path === "/" || path === "/index.html") {
    insertAdSenseZone("home_hero_conteudo", adsense.slots.listagens, ".hero", "afterend");
    insertAdSenseZone("home_entre_secoes", adsense.slots.listagens, ".destination");
    insertAdSenseZone("home_rodape", adsense.slots.finalRodape, ".site-footer");
  }
  if (/\/news\/?(?:index\.html)?$/.test(path) || path.endsWith("news.html")) {
    insertAdSenseBetweenCards("noticias_entre_listagem", adsense.slots.listagens, "#news-container", ".news-item", 3);
  }
  if (path.includes("news-details") || path.includes("news-detalhes") || path.startsWith("/noticias/")) {
    insertAdSenseInsideArticle();
    insertAdSenseZone("noticia_final", adsense.slots.finalRodape, ".related-news");
  }
  if (path.endsWith("guia.html")) {
    insertAdSenseBetweenCards("guia_entre_estabelecimentos", adsense.slots.listagens, "#guia-container", ".card-guia", 5);
    insertAdSenseZone("guia_rodape", adsense.slots.finalRodape, ".site-footer");
  }
  if (path.endsWith("turismo.html")) {
    insertAdSenseBetweenCards("turismo_entre_cartoes", adsense.slots.listagens, "#turismo-container", ".card-guia", 2);
    insertAdSenseZone("turismo_rodape", adsense.slots.finalRodape, ".site-footer");
  }
  if (path.includes("/eventos")) {
    insertAdSenseBetweenCards("eventos_entre_eventos", adsense.slots.listagens, "#eventos-list", ".event-card", 2);
    insertAdSenseZone("eventos_rodape", adsense.slots.finalRodape, ".site-footer");
  }
}

function renderAllAdvertising() {
  render();
  renderAdSense();
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
    track(campaign.id, "impressao", "popup");
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
  if (publicSupabaseConfigured()) {
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
        console.warn("Publicidade própria indisponível:", error.message);
      }
    }
  }
  renderAllAdvertising();
  campaigns
    .filter(campaign => campaign.tipo === "popup" && isCampaignActive(campaign, false) && hasRenderableMedia(campaign, "popup"))
    .sort((a, b) => Number(b.prioridade || 0) - Number(a.prioridade || 0))
    .slice(0, 1)
    .forEach(showPopup);
  document.addEventListener("click", event => {
    const node = event.target.closest("[data-campaign-id]");
    if (node && !event.target.closest("[data-ad-step],[data-ad-index]")) {
      track(node.dataset.campaignId, "clique", node.closest("[data-banner]")?.dataset.banner || "popup");
    }
  });
  window.addEventListener("cookie-consent:accepted", renderAllAdvertising);
  let renderQueued = false;
  const observer = new MutationObserver(() => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderAllAdvertising();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
}

init();
