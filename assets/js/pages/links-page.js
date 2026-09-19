import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const hub = document.getElementById("links-hub");
const status = document.getElementById("links-status");
const socialSection = document.querySelector(".links-social");
const socialDock = document.getElementById("social-dock");
const CACHE_KEY = "euamourania:links-hub:v3";

const FALLBACKS = {
  site: { id: "site-principal", titulo: "Nosso site", url: "/" },
  news: { id: "pagina-noticias", titulo: "Notícias", url: "/news/" },
  app: { id: "app-viva-urania", titulo: "Viva Urânia", url: "/app" },
  group: { id: "whatsapp-grupo-noticias", titulo: "Grupo de notícias", url: "https://chat.whatsapp.com/H8uSnazUFAREgQZziiwmPf?s=cl&p=i&ilr=0" },
  channel: { id: "whatsapp-canal-noticias", titulo: "Canal de notícias", url: "https://whatsapp.com/channel/0029VapPdlLGpLHTXQELk210" },
  contact: { id: "falar-com-equipe", titulo: "Falar com a equipe", url: "https://wa.me/555517976005583" },
  instagram: { id: "social-instagram", titulo: "Instagram", url: "https://instagram.com/euamourania" },
  tiktok: { id: "social-tiktok", titulo: "TikTok", url: "https://tiktok.com/@euamourania" },
  youtube: { id: "social-youtube", titulo: "YouTube", url: "https://www.youtube.com/@EuAmoUr%C3%A2nia" },
  facebook: { id: "social-facebook", titulo: "Facebook", url: "https://facebook.com/euamourania" },
  x: { id: "social-x", titulo: "X", url: "https://x.com/euamourania" }
};

const icons = {
  app: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 2.5h9.6a2.7 2.7 0 0 1 2.7 2.7v13.6a2.7 2.7 0 0 1-2.7 2.7H7.2a2.7 2.7 0 0 1-2.7-2.7V5.2a2.7 2.7 0 0 1 2.7-2.7Zm0 2A.7.7 0 0 0 6.5 5.2v13.6c0 .4.3.7.7.7h9.6c.4 0 .7-.3.7-.7V5.2a.7.7 0 0 0-.7-.7H7.2Zm3 12.8h3.6v1.4h-3.6v-1.4Z"/></svg>',
  news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v11h.5a.5.5 0 0 0 .5-.5V8h2v8.5a2.5 2.5 0 0 1-2.5 2.5H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm0 2v10a1 1 0 0 0 1 1h11V6H5Zm2 2h8v2H7V8Zm0 4h8v2H7v-2Z"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm6.7 8h-3.2a15 15 0 0 0-1.2-5 7.1 7.1 0 0 1 4.4 5ZM12 5c.7 1 1.3 3 1.5 6h-3c.2-3 .8-5 1.5-6ZM5.3 13h3.2a15 15 0 0 0 1.2 5 7.1 7.1 0 0 1-4.4-5Zm3.2-2H5.3a7.1 7.1 0 0 1 4.4-5 15 15 0 0 0-1.2 5Zm3.5 8c-.7-1-1.3-3-1.5-6h3c-.2 3-.8 5-1.5 6Zm2.3-1a15 15 0 0 0 1.2-5h3.2a7.1 7.1 0 0 1-4.4 5Z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Zm0 2a7 7 0 1 1-3.9 12.8l-.5-.3-1.8.5.5-1.8-.3-.5A7 7 0 0 1 12 5Zm-2.7 3c-.2 0-.5.1-.7.3-.4.4-.8 1-.8 1.8 0 1.1.8 2.3.9 2.5.1.2 1.7 2.7 4.2 3.7 2 .8 2.5.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.3l-1.6-.8c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.6.1-.3-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5.2-.4c.1-.2 0-.3 0-.5L10 8.5c-.2-.4-.4-.5-.7-.5Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm4 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm4.5-3.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.2 3h3a4.8 4.8 0 0 0 3.8 3.8v3a7.8 7.8 0 0 1-3.8-1v6.1a6.1 6.1 0 1 1-5.3-6v3.1a3.1 3.1 0 1 0 2.3 3V3Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.2 7.4a3 3 0 0 0-2.1-2.1C17.2 4.8 12 4.8 12 4.8s-5.2 0-7.1.5a3 3 0 0 0-2.1 2.1A18 18 0 0 0 2.3 12c0 1.6.1 3.1.5 4.6a3 3 0 0 0 2.1 2.1c1.9.5 7.1.5 7.1.5s5.2 0 7.1-.5a3 3 0 0 0 2.1-2.1c.4-1.5.5-3 .5-4.6s-.1-3.1-.5-4.6ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.6 21v-8h2.7l.4-3.1h-3.1V8c0-.9.3-1.5 1.6-1.5h1.7V3.7c-.9-.1-1.7-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.1H7.4V13h2.8v8h3.4Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.3 3h4.4l4.1 5.5L17.6 3h2.1l-5.9 7 6.2 11h-4.4l-4.5-6-5.3 6H3.7l6.4-7.5L4.3 3Zm3.3 1.8 9 14.4h1.8l-9-14.4H7.6Z"/></svg>'
};

const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const safeUrl = value => /^(https?:\/\/|\/)/i.test(String(value || "")) ? escapeHtml(value) : "#";
const externalAttributes = value => /^https?:\/\//i.test(String(value || "")) ? 'target="_blank" rel="noopener noreferrer"' : "";
const searchable = link => normalize(`${link?.titulo || ""} ${link?.url || ""} ${link?.icone || ""} ${link?.tipo_destaque || ""}`);
const findLink = (links, predicate, fallback) => links.find(predicate) || fallback;

function classify(links) {
  return {
    app: findLink(links, link => searchable(link).includes("viva urania") || searchable(link).includes("tipo_destaque app") || /\/app\/?$/i.test(link.url || ""), FALLBACKS.app),
    news: findLink(links, link => searchable(link).includes("noticia") && !/whatsapp|chat\./i.test(link.url || ""), FALLBACKS.news),
    site: findLink(links, link => normalize(link.titulo).includes("nosso site") || /^https:\/\/euamourania\.com\.br\/?$/i.test(link.url || ""), FALLBACKS.site),
    group: findLink(links, link => /chat\.whatsapp\.com/i.test(link.url || ""), FALLBACKS.group),
    channel: findLink(links, link => /whatsapp\.com\/channel/i.test(link.url || "") || normalize(link.titulo).includes("canal whatsapp"), FALLBACKS.channel),
    contact: findLink(links, link => /wa\.me|api\.whatsapp\.com/i.test(link.url || "") && !/chat\.|channel/i.test(link.url || ""), FALLBACKS.contact),
    instagram: findLink(links, link => searchable(link).includes("instagram"), FALLBACKS.instagram),
    tiktok: findLink(links, link => searchable(link).includes("tiktok"), FALLBACKS.tiktok),
    youtube: findLink(links, link => searchable(link).includes("youtube") || searchable(link).includes("youtu.be"), FALLBACKS.youtube),
    facebook: findLink(links, link => searchable(link).includes("facebook"), FALLBACKS.facebook),
    x: findLink(links, link => searchable(link).includes("twitter") || /(^|\/\/)(www\.)?x\.com\//i.test(link.url || ""), FALLBACKS.x)
  };
}

function accessCard(item, type, label, delay) {
  return `<a class="hub-card hub-access" href="${safeUrl(item.url)}" data-link-id="${escapeHtml(item.id)}" ${externalAttributes(item.url)} style="--delay:${delay}ms"><span class="hub-card-icon">${icons[type]}</span><strong>${escapeHtml(label)}</strong><span class="hub-card-arrow" aria-hidden="true">↗</span></a>`;
}

function whatsappCard(item, label, delay) {
  return `<a class="hub-card hub-whatsapp" href="${safeUrl(item.url)}" data-link-id="${escapeHtml(item.id)}" ${externalAttributes(item.url)} style="--delay:${delay}ms"><span class="hub-card-icon">${icons.whatsapp}</span><strong>${escapeHtml(label)}</strong><span class="hub-card-arrow" aria-hidden="true">↗</span></a>`;
}

function renderHub(links, latestNews) {
  const items = classify(links);
  const current = latestNews || { id: "latest-news", titulo: "Veja as últimas notícias de Urânia", slug: "" };
  const currentUrl = current.slug ? `/noticias/${encodeURIComponent(current.slug)}` : "/news/";
  hub.innerHTML = `
    <a class="hub-card hub-app" href="${safeUrl(items.app.url)}" data-link-id="${escapeHtml(items.app.id)}" ${externalAttributes(items.app.url)} style="--delay:40ms">
      <span class="hub-app-logo"><img src="/assets/viva-origem-colorido.svg" alt="" width="64" height="64"></span>
      <span class="hub-app-copy"><span class="hub-kicker">Viva Urânia</span><h2>O app da cidade</h2><p>Guia, turismo, eventos, notícias, serviços e muito mais.</p></span>
      <span class="hub-app-action">Baixar <span aria-hidden="true">→</span></span>
    </a>
    ${accessCard(items.news, "news", "Notícias", 80)}
    ${accessCard(items.site, "site", "Nosso site", 110)}
    <a class="hub-card hub-now" href="${safeUrl(currentUrl)}" data-link-id="${escapeHtml(current.id || "latest-news")}" style="--delay:140ms">
      <span class="hub-now-label">Agora em Urânia</span>
      <div><h2>${escapeHtml(current.titulo)}</h2><span class="hub-card-arrow" aria-hidden="true">→</span></div>
    </a>
    ${whatsappCard(items.group, "Grupo de notícias", 170)}
    ${whatsappCard(items.channel, "Canal de notícias", 200)}
    <a class="hub-card hub-contact" href="${safeUrl(items.contact.url)}" data-link-id="${escapeHtml(items.contact.id)}" ${externalAttributes(items.contact.url)} style="--delay:230ms"><span><span class="hub-card-icon">${icons.whatsapp}</span>Falar com a equipe</span><span class="hub-card-arrow" aria-hidden="true">↗</span></a>`;
  hub.classList.remove("is-loading");
  hub.setAttribute("aria-busy", "false");

  const socialItems = [[items.instagram, "instagram"], [items.tiktok, "tiktok"], [items.youtube, "youtube"], [items.facebook, "facebook"], [items.x, "x"]];
  socialDock.innerHTML = socialItems.map(([item, type]) => `<a class="social-link" href="${safeUrl(item.url)}" data-link-id="${escapeHtml(item.id)}" ${externalAttributes(item.url)} aria-label="${escapeHtml(item.titulo || type)}" title="${escapeHtml(item.titulo || type)}">${icons[type]}</a>`).join("");
  socialSection.hidden = false;
  status.textContent = "Central digital carregada.";
}

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}
function saveCache(links, latestNews) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ links, latestNews, savedAt: Date.now() })); } catch {}
}

async function loadHub() {
  const cached = readCache();
  renderHub(Array.isArray(cached?.links) ? cached.links : [], cached?.latestNews || null);
  if (!publicSupabaseConfigured()) return;

  try {
    const [links, news] = await Promise.all([
      fetchPublicRows("links", { select: "id,titulo,url,icone,rotulo,descricao,tipo_destaque,ordem", status: "eq.ativo", order: "ordem.asc" }, { ttl: 600000, timeout: 5000 }),
      fetchPublicRows("noticias", { select: "id,titulo,slug,categoria_nome,publicado_em,destaque", status: "eq.publicado", publicado_em: `lte.${new Date().toISOString()}`, order: "destaque.desc,publicado_em.desc", limit: "1" }, { ttl: 120000, timeout: 5000 })
    ]);
    const latestNews = news[0] || null;
    saveCache(links, latestNews);
    renderHub(links, latestNews);
  } catch (error) {
    console.error("Não foi possível atualizar a central de links:", error);
    status.textContent = "Os acessos principais continuam disponíveis.";
  }
}

loadHub();
