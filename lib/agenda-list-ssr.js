// Initial public Agenda markup. Keep the HTML identical to the 2026 client cards.
const { readFileSync } = require("node:fs");
const path = require("node:path");

const DOMAIN = "https://euamourania.com.br";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const EVENT_SELECT = "id,slug,titulo,descricao,imagem_url,data_inicio,data_fim,local,endereco,destaque,recorrencia_tipo,recorrencia_ate";
const TRADITION_SELECT = "id,slug,nome,descricao_curta,imagem_capa_url,categoria,recorrencia,periodo_aproximado,destaque";
const EDITION_SELECT = "id,evento_id,ano,status,data_inicio";
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const json = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const plain = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const compact = (value, limit = 150) => { const text = plain(value); return text.length > limit ? `${text.slice(0, limit).trim()}…` : text; };
const safeHttp = value => /^https:\/\//i.test(String(value || "")) ? esc(value) : "";
const imageUrl = (value, options = {}) => {
  if (!/^(https:\/\/|\/?assets\/)/i.test(String(value || ""))) return "";
  try {
    const url = new URL(value, DOMAIN);
    if (url.protocol !== "https:") return "";
    if (url.pathname.includes("/storage/v1/object/public/")) {
      url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      for (const [key, option] of Object.entries({ width: options.width || 760, height: options.height || 520, quality: options.quality || 76, resize: "cover" })) url.searchParams.set(key, String(option));
    }
    return esc(url.href);
  } catch { return ""; }
};
const dateInfo = value => {
  const date = value && new Date(value), zone = "America/Sao_Paulo";
  if (!date || Number.isNaN(date.getTime())) return { day: "—", month: "A definir", weekday: "", long: "Data a confirmar", time: "", iso: "" };
  const fmt = options => new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: zone }).format(date);
  return { day: fmt({ day: "2-digit" }), month: fmt({ month: "short" }).replace(".", "").toUpperCase(), weekday: fmt({ weekday: "short" }).replace(".", "").toUpperCase(), long: fmt({ day: "2-digit", month: "long", year: "numeric" }), time: fmt({ hour: "2-digit", minute: "2-digit" }), iso: date.toISOString() };
};
const cityDay = value => new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(value);
const recurrenceLabel = type => ({ semanal: "Semanal", mensal: "Mensal", anual: "Anual" })[type] || "";
const routeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>';

function nextOccurrence(item, now = new Date()) {
  const first = new Date(item.data_inicio || "");
  if (Number.isNaN(first.getTime())) return null;
  const recurring = ["semanal", "mensal", "anual"].includes(item.recorrencia_tipo);
  const originalEnd = item.data_fim ? new Date(item.data_fim) : null;
  const duration = originalEnd && !Number.isNaN(originalEnd.getTime()) ? Math.max(0, originalEnd - first) : null;
  if (!recurring) return (originalEnd ? originalEnd >= now : cityDay(first) >= cityDay(now)) ? item : null;
  const limit = new Date(now); limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  const recurrenceEnd = item.recorrencia_ate ? new Date(item.recorrencia_ate) : limit;
  if (!Number.isNaN(recurrenceEnd.getTime()) && recurrenceEnd < limit) limit.setTime(recurrenceEnd.getTime());
  const candidate = new Date(first);
  if (item.recorrencia_tipo === "semanal" && candidate < now) {
    // Jump close to today's occurrence; a weekly event may have been created
    // many years ago and must not disappear because of an iteration cap.
    const weeks = Math.max(0, Math.floor((now - first) / (7 * 86400000)) - 1);
    candidate.setUTCDate(candidate.getUTCDate() + weeks * 7);
  }
  let guard = 0;
  while (candidate <= limit && guard < 1040) {
    const end = duration == null ? null : new Date(candidate.getTime() + duration);
    if ((end && end >= now) || (!end && cityDay(candidate) >= cityDay(now))) {
      return { ...item, original_id: item.id, data_inicio: candidate.toISOString(), data_fim: end ? end.toISOString() : null, recorrencia_label: recurrenceLabel(item.recorrencia_tipo) };
    }
    if (item.recorrencia_tipo === "semanal") candidate.setUTCDate(candidate.getUTCDate() + 7);
    else if (item.recorrencia_tipo === "mensal") candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    else candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
    guard++;
  }
  return null;
}

function mapUrl(item) {
  if (safeHttp(item.mapa_url)) return safeHttp(item.mapa_url);
  const destination = item.endereco || item.local;
  return destination ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.titulo, destination, "Urânia SP"].filter(Boolean).join(" "))}` : "";
}

function eventCard(item, index) {
  const date = dateInfo(item.data_inicio), url = `/eventos/agenda/${encodeURIComponent(item.slug)}`;
  const image = imageUrl(item.imagem_url), route = mapUrl(item), description = compact(item.descricao, 170);
  return `<article class="agenda-event${image ? " has-image" : " no-image"}" data-event-id="${esc(item.original_id || item.id)}">
    <time class="agenda-date" datetime="${esc(date.iso)}" aria-label="${esc(`${date.long}${date.time ? ` às ${date.time}` : ""}`)}"><strong>${esc(date.day)}</strong><span>${esc(date.month)}</span><small>${esc(date.weekday)}</small></time>
    ${image ? `<a class="agenda-event-image" href="${url}" aria-label="Ver ${esc(item.titulo)}"><img src="${image}" alt="${esc(item.titulo)}" width="760" height="520" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></a>` : ""}
    <div class="agenda-event-copy"><div class="agenda-event-meta">${date.time ? `<time datetime="${esc(date.iso)}">${esc(date.time)}</time>` : ""}${item.recorrencia_label || recurrenceLabel(item.recorrencia_tipo) ? `<span>${esc(item.recorrencia_label || recurrenceLabel(item.recorrencia_tipo))}</span>` : ""}</div>
      <h3><a href="${url}">${esc(item.titulo)}</a></h3>${item.local ? `<p class="agenda-location">${esc(item.local)}</p>` : ""}${description ? `<p class="agenda-description">${esc(description)}</p>` : ""}
      <div class="agenda-event-actions"><a class="agenda-event-link" href="${url}">Ver evento <span aria-hidden="true">→</span></a>${route ? `<a class="agenda-route-link" href="${route}" target="_blank" rel="noopener" aria-label="Como chegar a ${esc(item.titulo)}" title="Como chegar">${routeIcon}<span>Como chegar</span></a>` : ""}</div>
    </div></article>`;
}

function archiveCard(item, editions) {
  const url = `/eventos/${encodeURIComponent(item.slug)}`, image = imageUrl(item.imagem_capa_url, { width: 680, height: 430, quality: 75 });
  const current = editions.find(edition => ["anunciado", "confirmado", "acontecendo"].includes(edition.status));
  const facts = [item.recorrencia, item.periodo_aproximado, editions.length ? `${editions.length} ${editions.length > 1 ? "edições" : "edição"}` : null].filter(Boolean);
  return `<article class="agenda-archive-card" data-event-principal-id="${esc(item.id)}">
    ${image ? `<a class="agenda-archive-image" href="${url}" aria-label="Conhecer ${esc(item.nome)}"><img src="${image}" alt="${esc(item.nome)}" width="680" height="430" loading="lazy" decoding="async"></a>` : '<div class="agenda-archive-mark" aria-hidden="true"><span>Tradição</span></div>'}
    <div class="agenda-archive-copy"><p>${esc(item.categoria || "Evento de Urânia")}</p><h3><a href="${url}">${esc(item.nome)}</a></h3>${item.descricao_curta ? `<p class="agenda-archive-description">${esc(compact(item.descricao_curta, 145))}</p>` : ""}${facts.length ? `<div class="agenda-archive-facts">${facts.map(fact => `<span>${esc(fact)}</span>`).join("")}</div>` : ""}<div class="agenda-archive-actions"><a href="${url}">Conhecer evento <b aria-hidden="true">→</b></a>${current ? `<a href="${url}/${encodeURIComponent(current.ano)}">Edição ${esc(current.ano)}</a>` : `<a href="${url}#edicoes">Ver edições</a>`}</div></div>
  </article>`;
}

function renderAgendaHtml(events, traditions, editions = []) {
  let html = readFileSync(path.resolve(__dirname, "..", "eventos", "index.html"), "utf8");
  const byEvent = new Map();
  for (const edition of editions) byEvent.set(edition.evento_id, [...(byEvent.get(edition.evento_id) || []), edition]);
  const current = events.length ? events.map(eventCard).join("") : '<div class="agenda-empty"><strong>Nada marcado por enquanto.</strong><p>A agenda será atualizada assim que novos eventos forem confirmados.</p><a href="/cadastrar-evento.html">Cadastrar evento <span aria-hidden="true">→</span></a></div>';
  const archive = traditions?.length ? traditions.map(item => archiveCard(item, byEvent.get(item.id) || [])).join("") : '<div class="agenda-empty archive-empty"><strong>O acervo está sendo organizado.</strong><p>As tradições e edições anteriores aparecerão aqui.</p></div>';
  html = html.replace('<div id="agenda-current-list" class="agenda-timeline"></div>', `<div id="agenda-current-list" class="agenda-timeline" data-server-rendered="true">${current}</div>`);
  if (traditions !== null) html = html.replace('<div id="agenda-archive-list" class="agenda-archive-grid"></div>', `<div id="agenda-archive-list" class="agenda-archive-grid" data-server-rendered="true">${archive}</div>`);
  if (!html.includes('id="agenda-current-list" class="agenda-timeline" data-server-rendered="true"') || (traditions !== null && !html.includes('id="agenda-archive-list" class="agenda-archive-grid" data-server-rendered="true"'))) throw new Error("Agenda template changed without SSR target update");
  html = html.replace('<p id="agenda-status" class="agenda-loading" role="status">Organizando a programação…</p>', '<p id="agenda-status" class="agenda-loading" role="status" hidden></p>');
  const structured = events.length ? `<script id="agenda-structured-data" type="application/ld+json">${json({ "@context": "https://schema.org", "@type": "ItemList", itemListElement: events.slice(0, 10).map((item, index) => ({ "@type": "ListItem", position: index + 1, url: `${DOMAIN}/eventos/agenda/${encodeURIComponent(item.slug)}`, name: item.titulo })) })}</script>` : "";
  return html.replace("</head>", `${structured}</head>`).replace("</body>", `<script id="initial-agenda-list-data" type="application/json">${json({ count: events.length })}</script></body>`);
}

async function rows(table, params, timeout = 7000) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`Consulta pública ${table} retornou HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Resposta pública inválida de ${table}`);
  return data;
}

async function renderAgendaList(_req, res) {
  try {
    const now = new Date(), day = cityDay(now);
    const upcoming = rows("eventos", { select: EVENT_SELECT, status: "eq.publicado", or: `(data_fim.gte.${day},data_inicio.gte.${day})`, order: "data_inicio.asc", limit: "24" });
    const recurring = rows("eventos", { select: EVENT_SELECT, status: "eq.publicado", recorrencia_tipo: "in.(semanal,mensal,anual)", or: `(recorrencia_ate.is.null,recorrencia_ate.gte.${day})`, order: "data_inicio.desc", limit: "40" });
    const traditionsRequest = rows("eventos_principais", { select: TRADITION_SELECT, ativo: "eq.true", order: "destaque.desc,atualizado_em.desc", limit: "18" }).catch(() => []);
    const editionsRequest = rows("eventos_edicoes", { select: EDITION_SELECT, status: "in.(anunciado,confirmado,acontecendo,encerrado,cancelado)", order: "ano.desc,data_inicio.desc", limit: "90" }).catch(() => []);
    const [next, repeat] = await Promise.all([upcoming, recurring]);
    const seen = new Set(), events = [...next, ...repeat].filter(item => item.id && item.slug && !seen.has(item.id) && seen.add(item.id))
      .map(item => nextOccurrence(item, now)).filter(Boolean).sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio)).slice(0, 8);
    const secondary = await Promise.race([
      Promise.all([traditionsRequest, editionsRequest]),
      new Promise(resolve => setTimeout(() => resolve(null), 400))
    ]);
    const [traditions, editions] = secondary || [null, []];
    const visibleTraditions = traditions?.filter(item => item.id && item.slug && item.nome) ?? null;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(200).send(renderAgendaHtml(events, visibleTraditions, editions));
  } catch (error) {
    console.error("[agenda-list-ssr]", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(readFileSync(path.resolve(__dirname, "..", "eventos", "index.html"), "utf8")
      .replace("Organizando a programação…", "Agenda temporariamente indisponível. Tente novamente em instantes."));
  }
}

module.exports = { renderAgendaList, renderAgendaHtml, nextOccurrence, eventCard, archiveCard };
