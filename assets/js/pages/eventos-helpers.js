import { fetchPublicRows } from "../services/publicDataService.js";

export const DOMAIN = "https://euamourania.com.br";
export const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
export const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? value : "";
export const strip = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
export const clamp = (value, length = 160) => {
  const text = strip(value);
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
export const fmtDate = value => value
  ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "Data a confirmar";
export const fmtDateTime = value => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value))
  : "Data a confirmar";
export const parseJsonList = value => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export async function safeRows(table, params, options) {
  try { return await fetchPublicRows(table, params, options); }
  catch (error) {
    console.warn(`Eventos 2.0: ${table} indisponível`, error);
    return [];
  }
}

export function fact(label, value) {
  return value ? `<div class="event-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : "";
}

export function gallery(items, title = "Galeria") {
  const list = parseJsonList(items).filter(item => safeImage(item.url || item.imagem || item.src || item));
  if (!list.length) return "";
  return `<section class="event-section">
    <div class="event-section-title"><p class="eyebrow">${esc(title)}</p><h2>Registros do evento</h2></div>
    <div class="event-gallery">${list.slice(0, 12).map((item, index) => {
      const url = safeImage(item.url || item.imagem || item.src || item);
      const alt = item.alt || item.legenda || `${title} ${index + 1}`;
      return `<figure><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy"><figcaption>${esc(item.legenda || alt)}</figcaption></figure>`;
    }).join("")}</div>
  </section>`;
}

export function editionCard(evento, edicao) {
  const image = safeImage(edicao.banner_url || edicao.cartaz_url || evento.imagem_capa_url);
  const url = `/eventos/${encodeURIComponent(evento.slug)}/${edicao.ano}`;
  return `<article class="event-edition-card">
    ${image ? `<a href="${url}"><img src="${esc(image)}" alt="${esc(edicao.titulo)}" loading="lazy"></a>` : ""}
    <div>
      <span class="event-status ${esc(edicao.status)}">${esc(edicao.status || "edição")}</span>
      <h3><a href="${url}">${esc(edicao.titulo || `${evento.nome} ${edicao.ano}`)}</a></h3>
      <p>${esc(edicao.subtitulo || `${fmtDate(edicao.data_inicio)}${edicao.local ? ` · ${edicao.local}` : ""}`)}</p>
      <a class="event-card-action" href="${url}">Abrir edição</a>
    </div>
  </article>`;
}

export async function relatedNews(evento, limit = 3) {
  const terms = [evento.nome, evento.categoria].filter(Boolean).join(" ");
  if (!terms) return [];
  const rows = await safeRows("noticias", {
    select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em",
    status: "eq.publicado",
    order: "publicado_em.desc",
    limit: "12"
  }, { ttl: 300000 });
  const normalized = terms.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return rows.filter(item => {
    const text = [item.titulo, item.resumo, item.categoria_nome].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return normalized.split(/\s+/).some(token => token.length > 3 && text.includes(token));
  }).slice(0, limit);
}

export function relatedNewsHtml(items) {
  if (!items.length) return "";
  return `<section class="event-section">
    <div class="event-section-title"><p class="eyebrow">Notícias relacionadas</p><h2>Também no portal</h2></div>
    <div class="event-related-grid">${items.map(item => {
      const image = safeImage(item.imagem_url);
      return `<article class="related-card">
        ${image ? `<a href="/noticias/${encodeURIComponent(item.slug)}"><img src="${esc(image)}" alt="${esc(item.titulo)}" loading="lazy"></a>` : '<div class="related-placeholder">Eu Amo Urânia</div>'}
        <div class="related-card-body">
          <p class="related-meta">${esc(item.categoria_nome || "Notícia")} · ${esc(fmtDate(item.publicado_em))}</p>
          <h3><a href="/noticias/${encodeURIComponent(item.slug)}">${esc(item.titulo)}</a></h3>
        </div>
      </article>`;
    }).join("")}</div>
  </section>`;
}
