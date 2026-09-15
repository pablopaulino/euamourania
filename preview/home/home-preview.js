import { callPublicRpc, fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const plain = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const shorten = (value, size = 110) => plain(value).length > size ? `${plain(value).slice(0, size).trim()}…` : plain(value);
const safeUrl = value => /^(https?:\/\/|\/|assets\/)/i.test(String(value || "")) ? String(value) : "";
const todayIso = () => new Date().toISOString();
const newsUrl = item => `/noticias/${encodeURIComponent(item.slug || item.id || "")}`;
const eventUrl = item => `/eventos/agenda/${encodeURIComponent(item.slug || item.id || "")}`;
const guideUrl = item => item.slug ? `/guia/${encodeURIComponent(item.slug)}` : `/guia-details.html?slug=${encodeURIComponent(item.id || "")}`;
const tourismUrl = item => `/turismo/${encodeURIComponent(item.slug || item.id || "")}`;

document.getElementById("year").textContent = new Date().getFullYear();
const menuButton = document.querySelector(".menu-toggle");
const menu = document.getElementById("menu-principal");
const siteHeader = document.querySelector(".site-header");
const searchTrigger = document.querySelector(".search-trigger");
const searchForm = document.querySelector(".header-search-form");
const searchInput = document.getElementById("header-search-input");
const closeSearch = () => {
  siteHeader?.classList.remove("search-open");
  searchTrigger?.setAttribute("aria-expanded", "false");
  searchInput?.blur();
};
searchTrigger?.addEventListener("click", () => {
  menu?.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
  siteHeader?.classList.add("search-open");
  searchTrigger.setAttribute("aria-expanded", "true");
  window.setTimeout(() => searchInput?.focus(), 180);
});
document.querySelector(".header-search-close")?.addEventListener("click", closeSearch);
document.addEventListener("keydown", event => { if (event.key === "Escape" && siteHeader?.classList.contains("search-open")) closeSearch(); });
menuButton?.addEventListener("click", () => {
  closeSearch();
  const open = menu.classList.toggle("is-open");
  menuButton.setAttribute("aria-expanded", String(open));
});
menu?.addEventListener("click", event => {
  if (event.target.closest("a")) { menu.classList.remove("is-open"); menuButton?.setAttribute("aria-expanded", "false"); }
});

function fallbackMessage(element, message) {
  if (element) element.innerHTML = `<p class="loading">${esc(message)}</p>`;
}

async function renderNews() {
  const root = document.getElementById("home-news");
  try {
    const rows = await fetchPublicRows("noticias", {
      select: "id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em,destaque",
      status: "eq.publicado",
      publicado_em: `lte.${todayIso()}`,
      order: "destaque.desc,publicado_em.desc",
      limit: "8"
    }, { ttl: 120000 });
    const items = rows.filter(item => safeUrl(item.imagem_url)).slice(0, 3);
    if (!items.length) return fallbackMessage(root, "As notícias da cidade aparecerão aqui.");
    root.innerHTML = items.map((item, index) => `<a class="news-card" href="${newsUrl(item)}"><img src="${esc(safeUrl(item.imagem_url))}" alt="" width="760" height="560" ${index ? 'loading="lazy"' : 'fetchpriority="high"'}><div class="news-copy"><small>${esc(item.categoria_nome || "Notícia")}</small><h3>${esc(item.titulo)}</h3></div></a>`).join("");
  } catch (error) { fallbackMessage(root, "Não foi possível carregar as notícias agora."); }
}

async function renderBusinesses() {
  const root = document.getElementById("home-businesses");
  try {
    const rows = await fetchPublicRows("guia_comercial", {
      select: "id,nome,slug,categoria_nome,descricao,imagem_url,recomendado",
      status: "eq.publicado",
      order: "recomendado.desc,nome.asc",
      limit: "6"
    }, { ttl: 180000 });
    if (!rows.length) return fallbackMessage(root, "Os estabelecimentos do Guia aparecerão aqui.");
    root.innerHTML = rows.map(item => `<a class="business-card${item.recomendado ? " is-featured" : ""}" href="${guideUrl(item)}">${safeUrl(item.imagem_url) ? `<img src="${esc(safeUrl(item.imagem_url))}" alt="" width="82" height="82" loading="lazy">` : `<span class="business-placeholder" aria-hidden="true"></span>`}${item.recomendado ? '<span class="recommended">Recomendado</span>' : ""}<small>${esc(item.categoria_nome || "Guia da cidade")}</small><h3>${esc(item.nome)}</h3><p>${esc(shorten(item.descricao, 92) || "Conheça este lugar no Guia de Urânia.")}</p></a>`).join("");
  } catch { fallbackMessage(root, "Não foi possível carregar o Guia agora."); }
}

function occurrence(event, now = new Date()) {
  let date = event.data_inicio ? new Date(event.data_inicio) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const type = event.recorrencia_tipo;
  let guard = 0;
  while (date < now && ["semanal", "mensal", "anual"].includes(type) && guard++ < 100) {
    if (type === "semanal") date.setDate(date.getDate() + 7);
    if (type === "mensal") date.setMonth(date.getMonth() + 1);
    if (type === "anual") date.setFullYear(date.getFullYear() + 1);
  }
  const until = event.recorrencia_ate ? new Date(event.recorrencia_ate) : null;
  return until && date > until ? null : { ...event, nextDate: date };
}

async function renderAgenda() {
  const root = document.getElementById("home-agenda");
  try {
    let rows;
    try {
      rows = await fetchPublicRows("eventos", { select: "id,titulo,slug,local,data_inicio,data_fim,recorrencia_tipo,recorrencia_ate", status: "eq.publicado", order: "data_inicio.asc", limit: "40" }, { ttl: 120000 });
    } catch {
      rows = await fetchPublicRows("eventos", { select: "id,titulo,slug,local,data_inicio,data_fim", status: "eq.publicado", order: "data_inicio.asc", limit: "40" }, { ttl: 120000 });
    }
    const now = new Date(); now.setHours(0,0,0,0);
    const items = rows.map(item => occurrence(item, now)).filter(Boolean).sort((a,b) => a.nextDate - b.nextDate).slice(0, 3);
    if (!items.length) return fallbackMessage(root, "Nenhum evento futuro publicado no momento.");
    const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" });
    const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" });
    const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    root.innerHTML = items.map(item => `<a class="agenda-item" href="${eventUrl(item)}"><time class="agenda-date" datetime="${esc(item.nextDate.toISOString())}"><strong>${dateFmt.format(item.nextDate)}</strong><span>${esc(monthFmt.format(item.nextDate).replace(".", ""))}</span></time><div><h3>${esc(item.titulo)}</h3><p>${esc(item.local || "Urânia")} · ${esc(timeFmt.format(item.nextDate))}</p></div><b aria-hidden="true">→</b></a>`).join("");
  } catch { fallbackMessage(root, "Não foi possível consultar a agenda agora."); }
}

async function renderTourism() {
  const root = document.getElementById("home-tourism");
  try {
    const rows = await fetchPublicRows("turismo", { select: "id,nome,slug,descricao,imagem_url,destaque,categoria_nome", status: "eq.publicado", order: "destaque.desc,nome.asc", limit: "5" }, { ttl: 180000 });
    if (!rows.length) { root.innerHTML = "<span>Os lugares de Urânia aparecerão aqui.</span>"; return; }
    const visual = rows.find(item => safeUrl(item.imagem_url));
    if (visual) { const image = document.getElementById("tourism-image"); image.src = safeUrl(visual.imagem_url); image.alt = visual.nome || "Lugar para conhecer em Urânia"; }
    root.innerHTML = rows.map(item => `<a href="${tourismUrl(item)}"><span>${esc(item.nome)}</span><small>${esc(item.categoria_nome || "Conhecer")}</small></a>`).join("");
  } catch { root.innerHTML = "<span>Não foi possível carregar os lugares agora.</span>"; }
}

function campaignActive(item) {
  const now = Date.now();
  const start = item.data_inicio ? new Date(item.data_inicio).getTime() : 0;
  const end = item.data_fim ? new Date(item.data_fim).getTime() : Infinity;
  return (!start || start <= now) && (!end || end >= now);
}
function campaignPositions(item) { return (item.campanha_posicoes || []).map(position => position.posicao); }
function campaignsForPositions(items, preferences) {
  const active = [...items].filter(campaignActive).sort((a,b) => Number(b.prioridade || 0) - Number(a.prioridade || 0));
  const positioned = active.filter(item => preferences.some(position => campaignPositions(item).includes(position)));
  return positioned.length ? positioned : active;
}
function trackCampaign(item, type) { if (item?.id) callPublicRpc("registrar_evento_publicidade", { p_campanha: item.id, p_tipo: type }, { timeout: 4000, keepalive: true }).catch(() => {}); }
function renderAdMedia(root, item) { const image = safeUrl(item?.imagem_url || item?.logo_empresa_url); root.innerHTML = image ? `<img src="${esc(image)}" alt="${esc(item.empresa_anunciante || item.nome || "Publicidade")}" loading="lazy">` : ""; }

async function renderAds() {
  try {
    const rows = await fetchPublicRows("campanhas_publicitarias", { select: "id,nome,empresa_anunciante,imagem_url,logo_empresa_url,link_destino,texto_botao,status,data_inicio,data_fim,prioridade,configuracao_futura,campanha_posicoes(posicao)", status: "eq.ativo", order: "prioridade.desc,criado_em.desc", limit: "12" }, { ttl: 60000 });
    const smallCampaigns = campaignsForPositions(rows, ["home_hero_conteudo", "home_entre_secoes", "todas_paginas"]);
    const small = smallCampaigns[0];
    const largeCampaigns = campaignsForPositions(rows, ["home_entre_secoes", "home_rodape", "todas_paginas"]);
    if (smallCampaigns.length) {
      const root = document.getElementById("home-ad-small");
      const dots = document.getElementById("small-ad-dots");
      let activeIndex = 0;
      const showCampaign = (index, animate = true) => {
        activeIndex = (index + smallCampaigns.length) % smallCampaigns.length;
        const campaign = smallCampaigns[activeIndex];
        if (animate) root.classList.add("is-switching");
        window.setTimeout(() => {
          document.getElementById("small-ad-title").textContent = campaign.empresa_anunciante || campaign.nome || "Parceiro local";
          document.getElementById("small-ad-text").textContent = campaign.nome && campaign.nome !== campaign.empresa_anunciante ? campaign.nome : "Conheça esta iniciativa.";
          renderAdMedia(document.getElementById("small-ad-media"), campaign);
          const link = document.getElementById("small-ad-link");
          link.href = safeUrl(campaign.link_destino) || "#";
          link.textContent = campaign.texto_botao || "Saiba mais →";
          link.onclick = () => trackCampaign(campaign, "clique");
          [...dots.children].forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === activeIndex)));
          root.classList.remove("is-switching");
          trackCampaign(campaign, "impressao");
        }, animate ? 180 : 0);
      };
      dots.innerHTML = smallCampaigns.length > 1 ? smallCampaigns.map((_, index) => `<button type="button" aria-label="Ver campanha ${index + 1}" aria-current="${index === 0}"></button>`).join("") : "";
      [...dots.children].forEach((dot, index) => dot.addEventListener("click", () => showCampaign(index)));
      showCampaign(0, false);
      if (smallCampaigns.length > 1) window.setInterval(() => showCampaign(activeIndex + 1), 5000);
      root.hidden = false;
    }
    if (largeCampaigns.length) {
      const root = document.getElementById("home-partner");
      const dots = document.getElementById("partner-dots");
      let activeIndex = largeCampaigns.length > 1 && largeCampaigns[0].id === small?.id ? 1 : 0;
      const showCampaign = (index, animate = true) => {
        activeIndex = (index + largeCampaigns.length) % largeCampaigns.length;
        const campaign = largeCampaigns[activeIndex];
        if (animate) root.classList.add("is-switching");
        window.setTimeout(() => {
          document.getElementById("partner-title").textContent = campaign.empresa_anunciante || campaign.nome || "Parceiro de Urânia";
          document.getElementById("partner-text").textContent = campaign.nome && campaign.nome !== campaign.empresa_anunciante ? campaign.nome : "Uma iniciativa que também faz parte da cidade.";
          renderAdMedia(document.getElementById("partner-media"), campaign);
          const link = document.getElementById("partner-link");
          link.href = safeUrl(campaign.link_destino) || "#";
          link.querySelector("span").textContent = campaign.texto_botao || "Conhecer";
          link.onclick = () => trackCampaign(campaign, "clique");
          [...dots.children].forEach((dot, dotIndex) => dot.setAttribute("aria-current", String(dotIndex === activeIndex)));
          root.classList.remove("is-switching");
          trackCampaign(campaign, "impressao");
        }, animate ? 180 : 0);
      };
      dots.innerHTML = largeCampaigns.length > 1 ? largeCampaigns.map((_, index) => `<button type="button" aria-label="Ver campanha ${index + 1}" aria-current="${index === activeIndex}"></button>`).join("") : "";
      [...dots.children].forEach((dot, index) => dot.addEventListener("click", () => showCampaign(index)));
      showCampaign(activeIndex, false);
      if (largeCampaigns.length > 1) window.setInterval(() => showCampaign(activeIndex + 1), 5000);
      root.hidden = false;
    }
  } catch (error) { console.warn("Publicidade da prévia:", error.message); }
}

async function renderAwards() {
  try {
    const rows = await fetchPublicRows("melhores_edicoes", { select: "id,nome,ano,slug,descricao,imagem_capa_url,status", status: "in.(indicacoes_abertas,votacao_aberta,votacao_encerrada,resultado_publicado)", order: "ano.desc", limit: "1" }, { ttl: 180000 });
    const item = rows[0]; if (!item) return;
    const root = document.getElementById("home-awards");
    document.getElementById("awards-text").textContent = shorten(item.descricao, 180) || `${item.nome || "Melhores de Urânia"} ${item.ano || ""}`.trim();
    const link = document.getElementById("awards-link"); if (item.slug) link.href = `/melhores-de-urania/${encodeURIComponent(item.slug)}/`;
    if (safeUrl(item.imagem_capa_url)) document.getElementById("awards-media").innerHTML = `<img src="${esc(safeUrl(item.imagem_capa_url))}" alt="${esc(item.nome || "Melhores de Urânia")}" loading="lazy">`;
    root.hidden = false;
  } catch {}
}

async function init() {
  try {
    await import("/assets/js/pages/newsletter-public.js");
    const signup = document.querySelector(".newsletter-signup");
    if (signup) {
      signup.querySelector("h2").textContent = "Urânia direto no seu e-mail.";
      signup.querySelector(".newsletter-box > div > p:last-child").textContent = "Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";
      const name = signup.querySelector('input[name="nome"]');
      if (name) { name.placeholder = "Seu nome"; name.required = true; }
    }
  } catch {}
  try { const app = await getAppDownloadConfig(); const href = app.googlePlayUrl || app.appStoreUrl || app.appPageUrl || "/app.html"; document.getElementById("app-download").href = href; document.getElementById("header-app").href = href; } catch {}
  if (!publicSupabaseConfigured()) return;
  await Promise.allSettled([renderNews(), renderBusinesses(), renderAgenda(), renderTourism(), renderAds(), renderAwards()]);
}
init();
