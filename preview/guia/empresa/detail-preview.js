import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { definirMeta, textoPuro } from "/assets/js/utils.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "../banners-preview.js";

const root = document.getElementById("guia-details");
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const safeHttp = value => /^https?:\/\//i.test(value || "") ? esc(value) : "";
const fallbackImage = "/assets/1505 - Urania - Logo Horizontal - 1.png";
const params = new URLSearchParams(location.search);
const requestedSlug = params.get("slug") || location.pathname.match(/^\/guia\/([^/]+)\/?$/)?.[1] || "";
const nowIso = () => new Date().toISOString();
const truncate = (value = "", length = 115) => {
  const text = textoPuro(value || "").trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
const icons = {
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.2"/><path d="M17.3 6.8h.01"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>',
  map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1 5-2 1c1 3 3 5 6 6l1-2 5 1v3c0 2-2 4-4 4C9 20 4 15 3 7c0-2 2-4 4-4Z"/></svg>',
  globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  arrow:'<span aria-hidden="true">→</span>'
};

function instagramUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return safeHttp(value);
  const handle = String(value).replace(/^@/, "").replace(/[^a-z0-9._]/gi, "");
  return handle ? `https://instagram.com/${handle}` : "";
}

function mapsUrl(item) {
  if (safeHttp(item.mapa_url)) return safeHttp(item.mapa_url);
  const query = [item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function gallery(item) {
  let raw = item.galeria_urls;
  if (typeof raw === "string") {
    try { raw = JSON.parse(raw); } catch { raw = raw.split(/[\n,]/); }
  }
  return [item.imagem_url, ...(Array.isArray(raw) ? raw : [])]
    .map(value => safeImage(typeof value === "string" ? value : value?.url || value?.imagem_url))
    .filter((value, index, list) => value && list.indexOf(value) === index)
    .slice(0, 5);
}

const DAYS = [
  ["mon", "Segunda"], ["tue", "Terça"], ["wed", "Quarta"], ["thu", "Quinta"],
  ["fri", "Sexta"], ["sat", "Sábado"], ["sun", "Domingo"]
];
const DAY_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function parseHours(raw) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return []; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return DAYS.map(([key, label]) => {
    const item = raw[key];
    if (!item || typeof item !== "object") return null;
    if (item.closed === true || item.isClosed === true) return { key, label, closed: true, periods: [] };
    if (item.twenty_four_hours || item.open_24h || item.is_24h || item.all_day) return { key, label, allDay: true, periods: [["00:00", "24:00"]] };
    const candidates = Array.isArray(item.periods) ? item.periods : Array.isArray(item.shifts) ? item.shifts : [item];
    const periods = candidates.map(period => [String(period?.open || ""), String(period?.close || "")]).filter(([open, close]) => /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close));
    return periods.length ? { key, label, periods } : null;
  }).filter(Boolean);
}

function openingState(hours) {
  if (!hours.length) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const weekday = parts.find(part => part.type === "weekday")?.value?.toLowerCase().slice(0, 3);
  const hour = Number(parts.find(part => part.type === "hour")?.value || 0);
  const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
  const today = hours.find(day => day.key === weekday || day.key === DAY_INDEX[new Date().getDay()]);
  if (!today || today.closed) return { open: false, label: "Fechado agora" };
  if (today.allDay) return { open: true, label: "Aberto agora", detail: "24 horas" };
  const value = hour * 60 + minute;
  const active = today.periods.find(([open, close]) => {
    const [oh, om] = open.split(":").map(Number), [ch, cm] = close.split(":").map(Number);
    const start = oh * 60 + om, end = close === "24:00" ? 1440 : ch * 60 + cm;
    return end >= start ? value >= start && value < end : value >= start || value < end;
  });
  return active ? { open: true, label: "Aberto agora", detail: `Fecha às ${active[1].replace(":", "h")}` } : { open: false, label: "Fechado agora" };
}

function hoursMarkup(item) {
  const hours = parseHours(item.opening_hours);
  if (hours.length) return `<div class="hours-list">${DAYS.map(([key, label]) => {
    const day = hours.find(entry => entry.key === key);
    const value = !day || day.closed ? "Fechado" : day.allDay ? "24 horas" : day.periods.map(period => `${period[0]}–${period[1]}`).join(" / ");
    return `<div><span>${label}</span><strong>${esc(value)}</strong></div>`;
  }).join("")}${item.opening_hours_note ? `<p>${esc(item.opening_hours_note)}</p>` : ""}</div>`;
  return item.horario ? `<p class="hours-simple">${esc(item.horario)}</p>${item.opening_hours_note ? `<p class="hours-note">${esc(item.opening_hours_note)}</p>` : ""}` : "";
}

function companyCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="related-company" href="/preview/guia/empresa/?slug=${encodeURIComponent(item.slug || item.id)}">${image ? `<img src="${image}" alt="" width="360" height="250" loading="lazy">` : `<span class="related-placeholder">Eu Amo Urânia</span>`}<div><small>${esc(item.categoria_nome || "Guia")}</small><h3>${esc(item.nome)}</h3><p>${esc(truncate(item.descricao || item.endereco, 80))}</p><span>Ver empresa ${icons.arrow}</span></div></a>`;
}

function tourismCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="related-tourism" href="/turismo/${encodeURIComponent(item.slug || item.id)}">${image ? `<img src="${image}" alt="" width="420" height="300" loading="lazy">` : ""}<div><small>Descubra Urânia</small><h3>${esc(item.nome)}</h3><span>Conhecer ${icons.arrow}</span></div></a>`;
}

function newsCard(item, index) {
  const image = safeImage(item.imagem_url);
  return `<a class="related-news-card${index === 0 ? " is-featured" : ""}" href="/noticias/${encodeURIComponent(item.slug)}">${image ? `<img src="${image}" alt="" width="520" height="330" loading="lazy">` : ""}<div><small>${esc(item.categoria_nome || "Notícias")}</small><h3>${esc(item.titulo)}</h3><p>${esc(truncate(item.resumo || item.conteudo_html, 95))}</p><span>Ler notícia ${icons.arrow}</span></div></a>`;
}

async function relatedData(item) {
  const [companies, tourism, news] = await Promise.all([
    fetchPublicRows("guia_comercial", { select:"id,nome,slug,descricao,imagem_url,categoria_nome,endereco,recomendado", status:"eq.publicado", id:`neq.${item.id}`, ...(item.categoria_nome ? { categoria_nome:`eq.${item.categoria_nome}` } : {}), order:"recomendado.desc,nome.asc", limit:"3" }, { ttl:180000 }).catch(() => []),
    fetchPublicRows("turismo", { select:"id,nome,slug,descricao,imagem_url", status:"eq.publicado", order:"destaque.desc,nome.asc", limit:"3" }, { ttl:180000 }).catch(() => []),
    fetchPublicRows("noticias", { select:"id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em", status:"eq.publicado", publicado_em:`lte.${nowIso()}`, order:"publicado_em.desc", limit:"3" }, { ttl:180000 }).catch(() => [])
  ]);
  return { companies, tourism, news };
}

function sectionHeading(kicker, title, description = "", link = "") {
  return `<header class="detail-section-heading"><div><p>${esc(kicker)}</p><h2>${esc(title)}</h2>${description ? `<span>${esc(description)}</span>` : ""}</div>${link ? `<a href="${link}">Ver tudo ${icons.arrow}</a>` : ""}</header>`;
}

function addStructuredData(item, image, canonical) {
  const data = { "@context":"https://schema.org", "@type":"LocalBusiness", name:item.nome, image, url:canonical, description:textoPuro(item.descricao || ""), address:item.endereco || undefined, telephone:item.telefone || item.whatsapp || undefined, sameAs:[instagramUrl(item.instagram), safeHttp(item.facebook), safeHttp(item.site)].filter(Boolean) };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "guide-detail-structured-data";
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

async function loadItem() {
  if (requestedSlug) {
    const query = /^[0-9a-f-]{20,}$/i.test(requestedSlug) ? { id:`eq.${requestedSlug}` } : { slug:`eq.${requestedSlug}` };
    return (await fetchPublicRows("guia_comercial", { select:"*", ...query, status:"eq.publicado", limit:"1" }))[0];
  }
  return (await fetchPublicRows("guia_comercial", { select:"*", status:"eq.publicado", order:"recomendado.desc,nome.asc", limit:"1" }))[0];
}

async function render() {
  if (!publicSupabaseConfigured()) { root.innerHTML = '<p class="detail-error">Configure o Supabase para carregar a empresa.</p>'; return; }
  try {
    const item = await loadItem();
    if (!item) { root.innerHTML = '<p class="detail-error">Empresa não encontrada.</p>'; return; }
    const related = await relatedData(item);
    const images = gallery(item);
    const mainImage = images[0] || fallbackImage;
    const whatsappDigits = String(item.whatsapp || "").replace(/\D/g, "");
    const whatsapp = whatsappDigits ? `https://wa.me/${whatsappDigits}` : "";
    const instagram = instagramUrl(item.instagram);
    const map = mapsUrl(item);
    const phoneDigits = String(item.telefone || "").replace(/[^\d+]/g, "");
    const site = safeHttp(item.site), facebook = safeHttp(item.facebook);
    const structuredHours = parseHours(item.opening_hours);
    const state = openingState(structuredHours);
    const canonical = `https://euamourania.com.br/guia/${encodeURIComponent(item.slug || item.id)}`;
    const absoluteImage = new URL(mainImage, location.origin).href;
    const description = textoPuro(item.seo_descricao || item.descricao || `${item.nome} no Guia do Eu Amo Urânia.`).slice(0, 160);
    definirMeta({ titulo:`${item.seo_titulo || item.nome} | Guia Eu Amo Urânia`, descricao:description, imagem:absoluteImage, url:canonical });
    addStructuredData(item, absoluteImage, canonical);

    root.innerHTML = `<article class="business-page" data-guide-id="${esc(item.id)}">
      <section class="business-hero detail-container">
        <div class="business-media">
          <img id="business-main-image" src="${mainImage}" alt="${esc(item.nome)}" width="850" height="700" fetchpriority="high" decoding="async">
          ${images.length > 1 ? `<div class="business-gallery" aria-label="Galeria de ${esc(item.nome)}">${images.map((image, index) => `<button type="button" class="gallery-thumb${index === 0 ? " active" : ""}" data-image="${image}" aria-label="Ver imagem ${index + 1}"><img src="${image}" alt="" width="72" height="72" loading="lazy"></button>`).join("")}</div>` : ""}
        </div>
        <div class="business-intro">
          <div class="business-badges">${item.categoria_nome ? `<a href="/preview/guia/?busca=${encodeURIComponent(item.categoria_nome)}">${esc(item.categoria_nome)}</a>` : ""}${item.recomendado_editorial || item.recomendado ? `<strong>Recomendado</strong>` : ""}</div>
          <p class="business-kicker">Guia de Urânia</p>
          <h1>${esc(item.nome)}</h1>
          ${item.descricao ? `<p class="business-summary">${esc(item.descricao)}</p>` : ""}
          ${state ? `<div class="opening-state ${state.open ? "is-open" : "is-closed"}"><i></i><strong>${state.label}</strong>${state.detail ? `<span>${state.detail}</span>` : ""}</div>` : item.horario ? `<div class="opening-quick">${icons.clock}<span>${esc(item.horario)}</span></div>` : ""}
          ${item.endereco ? `<p class="business-address">${icons.pin}<span>${esc(item.endereco)}</span></p>` : ""}
          <div class="business-actions">
            ${whatsapp ? `<a class="primary-action" href="${whatsapp}" target="_blank" rel="noopener">${icons.whatsapp}<span>Chamar no WhatsApp</span>${icons.arrow}</a>` : phoneDigits ? `<a class="primary-action phone-primary" href="tel:${esc(phoneDigits)}">${icons.phone}<span>Ligar agora</span>${icons.arrow}</a>` : ""}
            <div class="secondary-actions">${instagram ? `<a href="${instagram}" target="_blank" rel="noopener" aria-label="Instagram">${icons.instagram}</a>` : ""}${map ? `<a href="${map}" target="_blank" rel="noopener" aria-label="Abrir no mapa">${icons.map}</a>` : ""}${phoneDigits ? `<a href="tel:${esc(phoneDigits)}" aria-label="Ligar">${icons.phone}</a>` : ""}<button id="share-business" type="button" aria-label="Compartilhar">${icons.share}</button></div>
          </div>
        </div>
      </section>

      <section class="business-information detail-container">
        <div class="info-copy">
          <p class="section-kicker">Informações úteis</p>
          <h2>Tudo para chegar e falar com facilidade.</h2>
          ${item.endereco ? `<div class="info-block"><span>${icons.pin}</span><div><small>Endereço</small><strong>${esc(item.endereco)}</strong>${map ? `<a href="${map}" target="_blank" rel="noopener">Abrir no mapa ${icons.arrow}</a>` : ""}</div></div>` : ""}
          <div class="contact-links" aria-label="Canais da empresa">${phoneDigits ? `<a href="tel:${esc(phoneDigits)}">${icons.phone}<span><strong>Telefone</strong><small>${esc(item.telefone)}</small></span></a>` : ""}${site ? `<a href="${site}" target="_blank" rel="noopener">${icons.globe}<span><strong>Site</strong><small>Visitar</small></span></a>` : ""}${instagram ? `<a href="${instagram}" target="_blank" rel="noopener">${icons.instagram}<span><strong>Instagram</strong><small>Abrir perfil</small></span></a>` : ""}${facebook ? `<a href="${facebook}" target="_blank" rel="noopener">${icons.globe}<span><strong>Facebook</strong><small>Abrir página</small></span></a>` : ""}</div>
        </div>
        ${structuredHours.length || item.horario ? `<aside class="hours-panel"><div class="hours-title">${icons.clock}<div><p>Horários</p><h2>Quando encontrar aberto</h2></div></div>${hoursMarkup(item)}</aside>` : ""}
      </section>

      ${related.companies.length ? `<section class="detail-related detail-container">${sectionHeading("Mais no Guia", `Outras opções em ${item.categoria_nome || "Urânia"}`, "Empresas e serviços que também podem ajudar você.", "/preview/guia/")}<div class="company-related-grid">${related.companies.map(companyCard).join("")}</div></section>` : ""}
      ${related.tourism.length ? `<section class="tourism-related"><div class="detail-container">${sectionHeading("Descubra Urânia", "Tem sempre algo para conhecer.", "Lugares, sabores e experiências perto de você.", "/turismo.html")}<div class="tourism-related-grid">${related.tourism.map(tourismCard).join("")}</div></div></section>` : ""}
      ${related.news.length ? `<section class="detail-related detail-container">${sectionHeading("Agora em Urânia", "O que está acontecendo na cidade.", "Informação local, direta e feita para quem vive aqui.", "/news/")}<div class="news-related-grid">${related.news.map(newsCard).join("")}</div></section>` : ""}
    </article>`;

    root.querySelectorAll(".gallery-thumb").forEach(button => button.addEventListener("click", () => {
      const image = document.getElementById("business-main-image");
      if (image) image.src = button.dataset.image;
      root.querySelectorAll(".gallery-thumb").forEach(item => item.classList.toggle("active", item === button));
    }));
    document.getElementById("share-business")?.addEventListener("click", async event => {
      try {
        if (navigator.share) return await navigator.share({ title:`${item.nome} | Guia Eu Amo Urânia`, text:item.descricao || `Conheça ${item.nome}.`, url:canonical });
        await navigator.clipboard.writeText(canonical);
        event.currentTarget.classList.add("copied");
        event.currentTarget.setAttribute("aria-label", "Link copiado");
      } catch { location.href = `https://wa.me/?text=${encodeURIComponent(`${item.nome} no Guia Eu Amo Urânia: ${canonical}`)}`; }
    });
    window.dispatchEvent(new CustomEvent("guia:renderizado", { detail:{ id:item.id } }));
  } catch (error) {
    console.error(error);
    root.innerHTML = '<p class="detail-error">Não foi possível carregar esta empresa.</p>';
  }
}

const header = document.querySelector(".site-header");
const menu = document.getElementById("menu-principal");
const menuButton = header?.querySelector(".menu-toggle");
const searchTrigger = header?.querySelector(".search-trigger");
const searchForm = header?.querySelector(".header-search-form");
const searchInput = document.getElementById("header-search-input");
const closeSearch = () => { header?.classList.remove("search-open"); searchTrigger?.setAttribute("aria-expanded", "false"); };
searchTrigger?.addEventListener("click", () => { menu?.classList.remove("is-open"); menuButton?.setAttribute("aria-expanded", "false"); header?.classList.add("search-open"); searchTrigger.setAttribute("aria-expanded", "true"); setTimeout(() => searchInput?.focus(), 180); });
menuButton?.addEventListener("click", () => { const open = menuButton.getAttribute("aria-expanded") !== "true"; menuButton.setAttribute("aria-expanded", String(open)); menu?.classList.toggle("is-open", open); });
header?.querySelector(".header-search-close")?.addEventListener("click", closeSearch);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeSearch(); });
document.querySelectorAll("#year").forEach(element => { element.textContent = new Date().getFullYear(); });
getAppDownloadConfig().then(app => document.querySelectorAll("[data-app-download]").forEach(link => { link.href = app.googlePlayUrl || app.appStoreUrl || app.appPageUrl || "/app.html"; })).catch(() => {});

function configureNewsletter() {
  const signup = document.querySelector(".newsletter-signup");
  if (!signup || signup.dataset.detailReady === "true") return Boolean(signup);
  signup.dataset.detailReady = "true";
  const title = signup.querySelector("h2");
  const description = signup.querySelector(".newsletter-box > div > p:last-child");
  const name = signup.querySelector('input[name="nome"]');
  if (title) title.textContent = "Urânia direto no seu e-mail.";
  if (description) description.textContent = "Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";
  if (name) { name.placeholder = "Seu nome"; name.required = true; }
  return true;
}

render().then(() => Promise.allSettled([
  import("/assets/js/pages/site-config-page.js"), import("/assets/js/pages/analytics-page.js"),
  import("/assets/js/pages/newsletter-public.js"), import("/assets/js/pages/google-analytics-page.js"),
  import("/assets/js/pages/smart-app-banner.js"), import("/assets/js/pages/error-monitor.js")
])).then(() => {
  if (configureNewsletter()) return;
  const observer = new MutationObserver(() => { if (configureNewsletter()) observer.disconnect(); });
  observer.observe(document.body, { childList:true, subtree:true });
  setTimeout(() => observer.disconnect(), 10000);
});
