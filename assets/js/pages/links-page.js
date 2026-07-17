import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("links-list");
const status = document.getElementById("links-status");
const summary = document.getElementById("links-summary");

const NEWS_GROUP_LINK = {
  id: "whatsapp-grupo-noticias",
  titulo: "Grupo de notícias no WhatsApp",
  url: "https://chat.whatsapp.com/H8uSnazUFAREgQZziiwmPf?s=cl&p=i&ilr=0",
  icone: "💬",
  featured: true,
  label: "Grupo de notícias",
  description: "Entre para receber avisos, notícias e informações importantes de Urânia direto no WhatsApp."
};

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "#";
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function isWhatsappGroup(link) {
  const title = normalize(link.titulo);
  const icon = normalize(link.icone);
  const url = normalize(link.url);
  return url.includes("chat.whatsapp.com")
    || (url.includes("wa.me") && title.includes("grupo"))
    || (title.includes("grupo") && (title.includes("whatsapp") || title.includes("noticia") || icon.includes("whatsapp")));
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
    <a href="${safeUrl(link.url)}" class="link-button" data-link-id="${escapeHtml(link.id)}" target="_blank" rel="noopener noreferrer" style="--link-delay:${index * 45}ms">
      <span class="link-button-main">
        <span class="link-button-icon" aria-hidden="true">${escapeHtml(link.icone || "↗")}</span>
        <span>${escapeHtml(link.titulo)}</span>
      </span>
      <span class="link-button-arrow" aria-hidden="true">→</span>
    </a>
  `;
}

function renderFeaturedLink(link, index) {
  return `
    <a href="${safeUrl(link.url)}" class="links-featured-card" data-link-id="${escapeHtml(link.id)}" target="_blank" rel="noopener noreferrer" style="--link-delay:${index * 45}ms">
      <span class="links-featured-glow" aria-hidden="true"></span>
      <span class="links-featured-icon" aria-hidden="true">${escapeHtml(link.icone || "💬")}</span>
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
  const withoutDuplicate = links.filter(link => !sameDestination(link.url, NEWS_GROUP_LINK.url));
  const ordered = [...withoutDuplicate];
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

    if (!links.length) {
      status.hidden = true;
      if (summary) summary.textContent = "Grupo de notícias disponível no WhatsApp.";
      container.innerHTML = renderFeaturedLink(NEWS_GROUP_LINK, 0);
      return;
    }

    const renderedLinks = withNewsGroup(links);

    status.hidden = true;
    if (summary) {
      summary.textContent = `${renderedLinks.length} canal${renderedLinks.length === 1 ? "" : "es"} disponível${renderedLinks.length === 1 ? "" : "eis"} para acompanhar o Eu Amo Urânia.`;
    }
    container.innerHTML = renderedLinks.map(renderLink).join("");
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar os links.";
  }
}

carregarLinks();
