import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("links-list");
const status = document.getElementById("links-status");

const NEWS_GROUP_LINK = {
  id: "whatsapp-grupo-noticias",
  titulo: "Grupo de notícias no WhatsApp",
  url: "https://chat.whatsapp.com/H8uSnazUFAREgQZziiwmPf?s=cl&p=i&ilr=0",
  featured: true,
  label: "Grupo de notícias",
  description: "Entre para receber avisos, notícias e informações importantes de Urânia direto no WhatsApp."
};

const NEWS_PAGE_LINK = {
  id: "pagina-noticias",
  titulo: "Notícias",
  url: "/news/",
  iconType: "news"
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

const safeUrl = value => /^(https?:\/\/|\/)/i.test(value || "") ? escapeHtml(value) : "#";
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const icons = {
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.4 8.4 0 0 0-7.2 12.7l-.9 3.4 3.5-.9A8.4 8.4 0 1 0 12 3.5Zm0 1.8a6.6 6.6 0 1 1-3.7 12.1l-.4-.3-1.8.5.5-1.8-.3-.4A6.6 6.6 0 0 1 12 5.3Zm-2.4 3.5c-.2 0-.5.1-.7.3-.4.4-.8.9-.8 1.7 0 1.1.8 2.2.9 2.3.1.2 1.6 2.6 4 3.5 2 .8 2.4.6 2.8.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1-.1-.1-.2-.2-.5-.3l-1.6-.8c-.2-.1-.4-.1-.6.1-.1.2-.6.8-.7 1-.1.1-.3.2-.5.1-.3-.1-1-.4-1.8-1.1-.7-.6-1.1-1.4-1.3-1.7-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.3.2-.4.1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.5-.6-.5h-.3Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5Zm0 2A2.5 2.5 0 0 0 5.5 8v8A2.5 2.5 0 0 0 8 18.5h8a2.5 2.5 0 0 0 2.5-2.5V8A2.5 2.5 0 0 0 16 5.5H8Zm4 3.2a3.3 3.3 0 1 1 0 6.6 3.3 3.3 0 0 1 0-6.6Zm0 2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Zm4-2.7a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 21v-7.7h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.3c-.8-.1-1.6-.2-2.4-.2-2.4 0-4 1.5-4 4.1v2.1H7.5v3h2.7V21h3.2Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8.1a3 3 0 0 0-2.1-2.1C17 5.5 12 5.5 12 5.5s-5 0-6.9.5A3 3 0 0 0 3 8.1 31 31 0 0 0 2.5 12c0 1.3.1 2.6.5 3.9A3 3 0 0 0 5.1 18c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1c.4-1.3.5-2.6.5-3.9s-.1-2.6-.5-3.9ZM10.1 15V9l5.2 3-5.2 3Z"/></svg>',
  site: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm6.3 7.5h-2.8a12 12 0 0 0-1.1-4.1 6.6 6.6 0 0 1 3.9 4.1ZM12 5.4c.6.9 1.3 2.7 1.5 5.6h-3c.2-2.9.9-4.7 1.5-5.6ZM5.7 13h2.8c.1 1.6.4 3 .8 4.1A6.6 6.6 0 0 1 5.7 13Zm2.8-2H5.7a6.6 6.6 0 0 1 3.6-4.1c-.4 1.1-.7 2.5-.8 4.1Zm3.5 7.6c-.6-.9-1.3-2.7-1.5-5.6h3c-.2 2.9-.9 4.7-1.5 5.6Zm2.7-1.5c.4-1.1.7-2.5.8-4.1h2.8a6.6 6.6 0 0 1-3.6 4.1Z"/></svg>',
  news: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11.5A2.5 2.5 0 0 1 19 7v10.5h.5a1 1 0 0 0 1-1V8h2v8.5a3 3 0 0 1-3 3H6A3.5 3.5 0 0 1 2.5 16V7A2.5 2.5 0 0 1 5 4.5Zm0 2a.5.5 0 0 0-.5.5v9A1.5 1.5 0 0 0 6 17.5h11V7a.5.5 0 0 0-.5-.5H5Zm1.2 2h8.7v2H6.2v-2Zm0 3.2h8.7v2H6.2v-2Zm0 3.2h5.2v2H6.2v-2Z"/></svg>'
};

function isWhatsappGroup(link) {
  const title = normalize(link.titulo);
  const icon = normalize(link.icone);
  const url = normalize(link.url);
  return url.includes("chat.whatsapp.com")
    || (url.includes("wa.me") && title.includes("grupo"))
    || (title.includes("grupo") && (title.includes("whatsapp") || title.includes("noticia") || icon.includes("whatsapp")));
}

function iconFor(link) {
  if (link.iconType && icons[link.iconType]) return icons[link.iconType];
  const value = `${normalize(displayTitle(link))} ${normalize(link.titulo)} ${normalize(link.icone)} ${normalize(link.url)}`;
  if (value.includes("whatsapp") || value.includes("wa.me") || value.includes("chat.whatsapp")) return icons.whatsapp;
  if (value.includes("instagram")) return icons.instagram;
  if (value.includes("facebook") || value.includes("fb.")) return icons.facebook;
  if (value.includes("youtube") || value.includes("youtu.be")) return icons.youtube;
  if (value.includes("noticia") || value.includes("news")) return icons.news;
  return icons.site;
}

function displayTitle(link) {
  if (link.featured) return link.titulo;
  const title = normalize(link.titulo);
  const url = normalize(link.url);
  if ((title.includes("canal") && title.includes("whatsapp")) || title.includes("canal de noticia") || title.includes("canal noticias")) {
    return "Canal de Notícias";
  }
  if ((url.includes("wa.me") || url.includes("api.whatsapp.com") || title === "whatsapp" || title.includes("whatsapp")) && !isWhatsappGroup(link)) {
    return "Falar com a Equipe";
  }
  return link.titulo;
}

function linkAttributes(url = "") {
  return /^https?:\/\//i.test(url) ? 'target="_blank" rel="noopener noreferrer"' : "";
}

function sameDestination(a = "", b = "") {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.hostname === right.hostname && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}

function renderLink(link, index) {
  if (link.featured || isWhatsappGroup(link)) return renderFeaturedLink(link, index);
  return `
    <a href="${safeUrl(link.url)}" class="link-button" data-link-id="${escapeHtml(link.id)}" ${linkAttributes(link.url)} style="--link-delay:${index * 45}ms">
      <span class="link-button-main">
        <span class="link-button-icon">${iconFor(link)}</span>
        <span>${escapeHtml(displayTitle(link))}</span>
      </span>
      <span class="link-button-arrow" aria-hidden="true">→</span>
    </a>
  `;
}

function renderFeaturedLink(link, index) {
  return `
    <a href="${safeUrl(link.url)}" class="links-featured-card" data-link-id="${escapeHtml(link.id)}" target="_blank" rel="noopener noreferrer" style="--link-delay:${index * 45}ms">
      <span class="links-featured-glow" aria-hidden="true"></span>
      <span class="links-featured-icon">${icons.whatsapp}</span>
      <span class="links-featured-copy">
        <span class="links-featured-kicker">${escapeHtml(link.label || "Grupo oficial")}</span>
        <strong>${escapeHtml(link.titulo || "Grupo de notícias")}</strong>
        <small>${escapeHtml(link.description || "Receba avisos, novidades e publicações importantes de Urânia direto no celular.")}</small>
      </span>
      <span class="links-featured-action">Entrar agora <span aria-hidden="true">→</span></span>
    </a>
  `;
}

function withNewsGroup(links) {
  const withoutDuplicate = links.filter(link => !sameDestination(link.url, NEWS_GROUP_LINK.url) && !sameDestination(link.url, NEWS_PAGE_LINK.url));
  const ordered = [...withoutDuplicate];
  ordered.splice(Math.min(1, ordered.length), 0, NEWS_PAGE_LINK);
  ordered.splice(Math.min(2, ordered.length), 0, NEWS_GROUP_LINK);
  return ordered;
}

async function carregarLinks() {
  if (!publicSupabaseConfigured()) {
    status.textContent = "Configure o Supabase para carregar os links.";
    return;
  }

  status.textContent = "Carregando canais…";

  try {
    const links = await fetchPublicRows("links", {
      select: "id,titulo,url,icone,ordem",
      status: "eq.ativo",
      order: "ordem.asc"
    });

    const renderedLinks = links.length ? withNewsGroup(links) : [NEWS_PAGE_LINK, NEWS_GROUP_LINK];

    status.hidden = true;
    container.innerHTML = renderedLinks.map(renderLink).join("");
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar os links.";
  }
}

carregarLinks();
