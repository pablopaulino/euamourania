const { verifiedBadge } = require("./viva-verified.js");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const PAGE_SIZE = 6;
const SELECT = {
  guide: "id,nome,slug,categoria_nome,descricao,imagem_url,whatsapp,endereco,horario,recomendado,verificado",
  tourism: "id,nome,slug,descricao,imagem_url,endereco,horario,mapa_url,destaque,categoria_id,categoria_nome"
};
const icons = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>'
};
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const compact = (value = "", length = 112) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
const image = (value, fallback = "") => {
  const raw = String(value || "").trim();
  if (/^https:\/\//i.test(raw) || /^\/?assets\//i.test(raw)) return esc(raw.startsWith("assets/") ? `/${raw}` : raw);
  return fallback;
};
const http = value => /^https:\/\//i.test(String(value || "")) ? esc(value) : "";
const projection = (item, type) => Object.fromEntries(SELECT[type].split(",")
  .filter(key => Object.hasOwn(item, key)).map(key => [key, item[key]]));

function guideCard(item) {
  const detail = `/guia/${encodeURIComponent(item.slug || item.id)}`;
  const picture = image(item.imagem_url);
  const placeholder = '<div class="media-placeholder"><img src="/assets/1505 - Urania - Logo Horizontal - 1.png" alt="Eu Amo Urânia" width="190" height="56" loading="lazy" decoding="async"></div>';
  const tags = [item.whatsapp && '<span class="tag-whatsapp">WhatsApp</span>', item.endereco && "<span>Endereço</span>", item.horario && "<span>Horário</span>"].filter(Boolean);
  const whatsapp = String(item.whatsapp || "").replace(/\D/g, "");
  return `<article class="card-guia" id="guia-${esc(item.id)}" data-guide-id="${esc(item.id)}"${item.recomendado ? ' data-guide-featured="true"' : ""}>${item.recomendado ? '<span class="badge-destaque">Recomendado</span>' : ""}<a class="card-media guide-card-link" href="${detail}" aria-label="Ver detalhes de ${esc(item.nome)}">${picture ? `<img src="${picture}" class="card-img-top" alt="${esc(item.nome)}" width="420" height="320" loading="lazy" decoding="async">` : placeholder}</a><div class="card-body">${item.categoria_nome ? `<p class="guide-category">${esc(item.categoria_nome)}</p>` : ""}<h2 class="card-title"><a href="${detail}">${esc(item.nome)}</a>${verifiedBadge(item.verificado)}</h2><p class="card-text">${esc(item.descricao || "Conheça este estabelecimento no Guia de Urânia.")}</p>${tags.length ? `<div class="guide-mobile-tags">${tags.slice(0, 3).join("")}</div>` : ""}<div class="guide-card-actions"><a href="${detail}" class="btn-guide-details">Ver detalhes <span aria-hidden="true">→</span></a>${whatsapp ? `<a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener" class="btn-whatsapp" aria-label="Falar com ${esc(item.nome)} pelo WhatsApp">WhatsApp</a>` : ""}</div></div></article>`;
}

function tourismCard(item, index, categories) {
  const detail = `/turismo/${encodeURIComponent(item.slug || item.id)}`;
  const picture = image(item.imagem_url, "/assets/Design sem nome (9).png");
  const description = compact(item.descricao, 118);
  const location = compact(String(item.endereco || "").split(/[,·|-]/).map(part => part.trim()).filter(Boolean).slice(0, 2).join(", "), 48);
  const hours = compact(item.horario, 48);
  const map = http(item.mapa_url) || (item.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" "))}` : "");
  const category = categories.find(row => row.id === item.categoria_id)?.nome || item.categoria_nome || "Turismo";
  return `<article class="tourism-card-preview card-guia" data-tourism-id="${esc(item.id)}"${item.destaque ? ' data-tourism-featured="true"' : ""}>
    <a class="tourism-card-photo" href="${detail}" aria-label="Conhecer ${esc(item.nome)}">
      <img src="${picture}" alt="${esc(item.nome)}" width="620" height="470" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      ${item.destaque ? '<span class="tourism-featured-badge">Destaque</span>' : ""}
    </a>
    <div class="tourism-card-content">
      <p class="tourism-card-category">${esc(category)}</p>
      <h3><a href="${detail}">${esc(item.nome)}</a></h3>
      ${description ? `<p class="tourism-card-description">${esc(description)}</p>` : ""}
      ${location || hours ? `<div class="tourism-quick-facts">${location ? `<span>${icons.pin}<b>${esc(location)}</b></span>` : ""}${hours ? `<span>${icons.clock}<b>${esc(hours)}</b></span>` : ""}</div>` : ""}
      <div class="tourism-card-actions"><a class="tourism-details-link" href="${detail}">Ver detalhes <span aria-hidden="true">→</span></a>${map ? `<a class="tourism-route-link" href="${map}" target="_blank" rel="noopener" aria-label="Como chegar a ${esc(item.nome)}" title="Como chegar">${icons.route}</a>` : ""}</div>
    </div>
  </article>`;
}

function replaceTarget(html, id, markup) {
  const target = new RegExp(`(<div id="${id}"[^>]*)(>)[\\s\\S]*?(<\\/div>)`, "i");
  if (!target.test(html)) throw new Error(`Alvo de listagem ${id} ausente`);
  return html.replace(target, (_, start, end, close) => `${start} data-server-rendered="true"${end}${markup}${close}`);
}

function renderListHtml(type, items, categories = [], hasMore = false) {
  const guide = type === "guide";
  const file = guide ? "guia.html" : "turismo.html";
  let html = readFileSync(path.resolve(__dirname, "..", file), "utf8");
  const data = { items: items.map(item => projection(item, type)), categories, hasMore };
  const markup = guide ? items.map(guideCard).join("") : items.map((item, index) => tourismCard(item, index, categories)).join("");
  html = replaceTarget(html, guide ? "guia-container" : "turismo-container", markup);
  html = html.replace(guide ? "Carregando guia…" : "Carregando lugares…", items.length ? "" : guide ? "Nenhuma empresa publicada." : "Nenhum ponto turístico publicado.");
  if (!guide) {
    const visual = items.find(item => item.destaque && image(item.imagem_url)) || items.find(item => image(item.imagem_url));
    if (visual) html = html.replace(/(<img id="tourism-hero-image" src=")[^"]*(" alt=")[^"]*(")/,
      (_, open, middle, close) => `${open}${image(visual.imagem_url)}${middle}${esc(`Vista de ${visual.nome}, em Urânia`)}${close}`);
  }
  const id = guide ? "initial-guide-list-data" : "initial-tourism-list-data";
  return html.replace("</body>", `<script id="${id}" type="application/json">${safeJson(data)}</script></body>`);
}

async function fetchRows(table, params, timeout = 7000) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`Consulta pública ${table} retornou HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`Resposta pública inválida de ${table}`);
  return rows;
}

async function renderList(type, res) {
  const guide = type === "guide";
  try {
    const categoriesRequest = fetchRows("categorias", guide
      ? { select: "nome,slug,ordem", tipo: "eq.guia", status: "eq.ativo", order: "ordem.asc,nome.asc" }
      : { select: "id,nome", tipo: "eq.turismo", status: "eq.ativo", order: "ordem.asc,nome.asc" },
      1500
    ).catch(() => []);
    const rows = await fetchRows(guide ? "guia_comercial" : "turismo", {
      select: SELECT[type], status: "eq.publicado", order: guide ? "recomendado.desc,nome.asc" : "destaque.desc,nome.asc", limit: String(PAGE_SIZE + 1)
    });
    // Categories enhance labels and filters; they cannot hold back the main cards.
    const categories = await Promise.race([categoriesRequest, new Promise(resolve => setTimeout(() => resolve([]), 120))]);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", guide ? "no-store" : "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(200).send(renderListHtml(type, rows.slice(0, PAGE_SIZE), categories, rows.length > PAGE_SIZE));
  } catch (error) {
    console.error(`[public-list-ssr] ${type}:`, error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    const file = guide ? "guia.html" : "turismo.html";
    const html = readFileSync(path.resolve(__dirname, "..", file), "utf8");
    return res.status(503).send(html.replace(guide ? "Carregando guia…" : "Carregando lugares…", "Conteúdo temporariamente indisponível. Tente novamente em instantes."));
  }
}

const renderGuideList = (_req, res) => renderList("guide", res);
const renderTourismList = (_req, res) => renderList("tourism", res);

module.exports = { renderGuideList, renderTourismList, renderListHtml, guideCard, tourismCard };
