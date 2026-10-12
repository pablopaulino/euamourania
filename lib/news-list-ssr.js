const { readFileSync } = require("node:fs");
const path = require("node:path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DOMAIN = "https://euamourania.com.br";
const FIELDS = "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque,visualizacoes";
const INITIAL_LIMIT = 10; // Três matérias na capa, seis no feed e uma sentinela.
const FALLBACK_IMAGE = "/assets/Design sem nome (9).png";
const template = readFileSync(path.resolve(__dirname, "../news/index.html"), "utf8");

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const short = (value = "", limit = 150) => {
  const text = String(value || "").trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}…` : text;
};
const slugify = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
const newsUrl = slug => `/noticias/${encodeURIComponent(slug)}`;
const categoryUrl = category => `/news/${encodeURIComponent(slugify(category || "urania"))}`;
const categoryLink = category => `<a href="${categoryUrl(category)}">${esc(category || "Urânia")}</a>`;
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo"
  }).format(date);
};
function imageUrl(value, options = {}) {
  if (!value) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, DOMAIN);
    if (url.protocol !== "https:") return FALLBACK_IMAGE;
    if (url.pathname.includes("/storage/v1/object/public/")) {
      url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      if (options.width) url.searchParams.set("width", String(options.width));
      if (options.height) url.searchParams.set("height", String(options.height));
      if (options.quality) url.searchParams.set("quality", String(options.quality));
      url.searchParams.set("resize", "cover");
    }
    return esc(url.href);
  } catch {
    return FALLBACK_IMAGE;
  }
}
function nowStrip(items) {
  const links = items.slice(0, 6).map(item => `<a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a>`).join("");
  const duplicateLinks = links.replaceAll("<a ", '<a tabindex="-1" ');
  return `<div class="news-now"><strong><i></i> Agora</strong><div class="news-now-viewport" tabindex="0" aria-label="Últimas manchetes"><div class="news-now-track"><span>${links}</span><span aria-hidden="true">${duplicateLinks}</span></div></div></div>`;
}
function leadStory(item) {
  const url = newsUrl(item.slug), summary = short(item.resumo, 185);
  return `<article class="cover-lead"><a class="cover-lead-image" href="${url}" aria-label="${esc(item.titulo)}"><img src="${imageUrl(item.imagem_url, { width: 1100, height: 760, quality: 78 })}" alt="${esc(item.titulo)}" width="1100" height="760" fetchpriority="high" decoding="async"></a><div class="cover-lead-copy"><div><span>Manchete</span>${categoryLink(item.categoria_nome)}</div><h2><a href="${url}">${esc(item.titulo)}</a></h2>${summary ? `<p>${esc(summary)}</p>` : ""}<footer><time datetime="${esc(item.publicado_em)}">${esc(formatDate(item.publicado_em))}</time><a href="${url}">Ler notícia <b aria-hidden="true">→</b></a></footer></div></article>`;
}
function secondaryStory(item) {
  const url = newsUrl(item.slug);
  return `<article class="cover-secondary"><a class="cover-secondary-image" href="${url}" aria-label="${esc(item.titulo)}"><img src="${imageUrl(item.imagem_url, { width: 560, height: 380, quality: 75 })}" alt="${esc(item.titulo)}" width="560" height="380" loading="lazy" decoding="async"></a><div><p>${categoryLink(item.categoria_nome)}<time datetime="${esc(item.publicado_em)}">${esc(formatDate(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3><a class="secondary-arrow" href="${url}" aria-label="Ler ${esc(item.titulo)}">→</a></div></article>`;
}
function trending(items) {
  if (!items.length) return "";
  return `<section class="news-trending" aria-labelledby="trending-title"><header><p class="news-eyebrow">Mais lidas</p><h2 id="trending-title">Em alta.</h2></header><div>${items.map((item, index) => `<a href="${newsUrl(item.slug)}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(item.titulo)}</strong><b aria-hidden="true">↗</b></a>`).join("")}</div></section>`;
}
function newsCard(item) {
  const url = newsUrl(item.slug), summary = short(item.resumo, 150);
  return `<article class="news-item archive-card"><a class="archive-card-image" href="${url}" aria-label="${esc(item.titulo)}"><img src="${imageUrl(item.imagem_url, { width: 760, height: 470, quality: 75 })}" alt="${esc(item.titulo)}" width="760" height="470" loading="lazy" decoding="async"></a><div class="archive-card-copy"><p>${categoryLink(item.categoria_nome)}<time datetime="${esc(item.publicado_em)}">${esc(formatDate(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3>${summary ? `<p class="archive-summary">${esc(summary)}</p>` : ""}<a class="archive-card-link" href="${url}">Ler notícia <span aria-hidden="true">→</span></a></div></article>`;
}
function publicItem(row) {
  return Object.fromEntries(FIELDS.split(",").map(key => [key, row?.[key] ?? null]));
}
function apply(html, pattern, replacement, name) {
  if (!pattern.test(html)) throw new Error(`Alvo SSR ausente: ${name}`);
  return html.replace(pattern, replacement);
}
function composeNewsList(initial) {
  const latest = initial.items;
  const lead = initial.highlight || latest.find(item => item.destaque) || latest[0];
  const supporting = latest.filter(item => item.id !== lead?.id).slice(0, 2);
  const featuredIds = new Set([lead, ...supporting].filter(Boolean).map(item => item.id));
  const feed = latest.filter(item => !featuredIds.has(item.id));
  const popular = initial.popular.length ? initial.popular : [...latest].sort((a, b) =>
    Number(b.visualizacoes || 0) - Number(a.visualizacoes || 0)).slice(0, 5);
  let html = template;
  const featured = lead ? `${nowStrip(latest)}<div class="news-cover"><div class="cover-grid">${leadStory(lead)}<div class="cover-secondary-list">${supporting.map(secondaryStory).join("")}</div></div>${trending(popular)}</div>` : "";
  const cards = feed.slice(0, 6);
  const filterNames = [...new Set([...initial.categories, ...latest.map(item => item.categoria_nome)].filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const filters = [["", "Todas"], ...filterNames.map(name => [name, name])].map(([value, label], index) =>
    `<button type="button" data-category="${esc(value)}" aria-pressed="${index === 0}" class="${index === 0 ? "active" : ""}">${esc(label)}</button>`).join("");
  html = apply(html, /<div id="news-featured" aria-live="polite">[\s\S]*?<\/div>/, `<div id="news-featured" aria-live="polite" data-server-rendered="true">${featured}</div>`, "news-featured");
  html = apply(html, /<div id="news-category-filters"([^>]*)><\/div>/, `<div id="news-category-filters"$1>${filters}</div>`, "news-category-filters");
  html = apply(html, /<p id="news-status"[^>]*>[\s\S]*?<\/p>/, `<p id="news-status" class="news-loading" role="status"${latest.length ? " hidden" : ""}>${latest.length ? "" : "Nenhuma notícia publicada."}</p>`, "news-status");
  html = apply(html, /<div id="news-container"><\/div>/, `<div id="news-container" data-server-rendered="true">${cards.length ? `<div class="news-card-grid">${cards.map(newsCard).join("")}</div>` : latest.length ? '<div class="news-empty"><strong>Nenhuma notícia encontrada.</strong></div>' : ""}</div>`, "news-container");
  if (feed.length > cards.length || initial.hasMore) {
    html = apply(html, /(<button id="news-load-more"[^>]*?) hidden(>)/, "$1$2", "news-load-more");
  }
  const script = `<script id="initial-news-list-data" type="application/json">${safeJson(initial)}</script>`;
  return html.replace("</head>", `${script}</head>`);
}
async function rows(table, query, timeoutMs = 5000, externalSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (externalSignal?.aborted) abort();
  externalSignal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_KEY },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`${table}: resposta inválida`);
    return data;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", abort);
  }
}
async function renderNewsList(req, res) {
  const publishedBefore = new Date().toISOString();
  const common = `select=${FIELDS}&status=eq.publicado&publicado_em=lte.${encodeURIComponent(publishedBefore)}`;
  const optionalAbort = new AbortController();
  const optionalSettled = Promise.allSettled([
    rows("noticias", `${common}&destaque=eq.true&order=publicado_em.desc&limit=1`, 3000, optionalAbort.signal),
    rows("noticias", `${common}&order=visualizacoes.desc,publicado_em.desc&limit=5`, 3000, optionalAbort.signal),
    rows("categorias", "select=nome&tipo=eq.noticias&status=eq.ativo&order=ordem.asc&limit=100", 3000, optionalAbort.signal)
  ]);
  let latest;
  try {
    latest = await rows("noticias", `${common}&order=publicado_em.desc&limit=${INITIAL_LIMIT}`, 6500);
  } catch (error) {
    optionalAbort.abort();
    console.error("[news-list-ssr] Falha na consulta principal:", error);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "60");
    return res.status(503).send("Notícias temporariamente indisponíveis. Tente novamente em instantes.");
  }
  // As consultas secundárias não podem segurar a capa por vários segundos.
  let graceTimer;
  await Promise.race([optionalSettled, new Promise(resolve => { graceTimer = setTimeout(resolve, 250); })]);
  clearTimeout(graceTimer);
  optionalAbort.abort();
  const optional = await optionalSettled;
  const value = (index, fallback = []) => optional[index].status === "fulfilled" ? optional[index].value : fallback;
  const initial = {
    items: latest.map(publicItem),
    highlight: value(0)[0] ? publicItem(value(0)[0]) : null,
    popular: value(1).map(publicItem),
    categories: value(2).map(item => item.nome).filter(Boolean),
    publishedBefore,
    hasMore: latest.length >= INITIAL_LIMIT,
    nextOffset: latest.length
  };
  try {
    const html = composeNewsList(initial);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(200).send(html);
  } catch (error) {
    console.error("[news-list-ssr] Falha ao compor o HTML:", error);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Notícias temporariamente indisponíveis. Tente novamente em instantes.");
  }
}

module.exports = { renderNewsList, composeNewsList, publicItem };
