// Public event pages use the same 2026 markup with or without JavaScript.
// Keep this module independent of browser APIs so the Vercel function can render it.
const DOMAIN = "https://euamourania.com.br";
const FALLBACK_IMAGE = `${DOMAIN}/assets/compartilhamento-logo.png`;
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const plain = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const json = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
const select = {
  simple: "id,slug,titulo,descricao,imagem_url,data_inicio,data_fim,recorrencia_tipo,recorrencia_ate,local,endereco,organizador,whatsapp,destaque",
  tradition: "id,slug,nome,descricao_curta,historia_html,imagem_capa_url,galeria_historica,categoria,local_tradicional,recorrencia,periodo_aproximado,organizador,seo_titulo,seo_descricao",
  edition: "id,evento_id,ano,titulo,subtitulo,data_inicio,data_fim,programacao_html,atracoes_html,cartaz_url,banner_url,galeria,local,mapa_url,patrocinadores,status,resumo_pos_evento_html,publico_estimado,seo_titulo,seo_descricao"
};

const icons = {
  map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 5c3 0 4 2 4 4s-1 4-4 4"/></svg>'
};

function safeImage(value, options = {}) {
  if (!value || !(/^(https?:\/\/|\/?assets\/)/i.test(value))) return "";
  try {
    const url = new URL(value, DOMAIN);
    if (url.protocol !== "https:") return "";
    if (url.pathname.includes("/storage/v1/object/public/")) {
      url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      url.searchParams.set("width", String(options.width || 1200));
      url.searchParams.set("height", String(options.height || 820));
      url.searchParams.set("quality", String(options.quality || 80));
      url.searchParams.set("resize", "cover");
    }
    return url.href;
  } catch { return ""; }
}
function safeLink(value) {
  try {
    const url = new URL(value, DOMAIN);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}
function parseList(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== "string") return [];
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch { /* comma-separated legacy data */ }
  return raw.split(/[\n,]/).map(value => value.trim()).filter(Boolean);
}
function richHtml(value) {
  // Escape text, retain only a small set of presentation tags, and rebuild URLs.
  // No CMS-supplied attributes, scripts, style or event handlers enter the response.
  const source = String(value || "")
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<(script|style|object|embed|form|iframe|video)\b[^>]*>[^]*?<\/\1\s*>/gi, "");
  const allowed = new Set(["p", "h2", "h3", "h4", "blockquote", "br", "hr", "ul", "ol", "li", "strong", "b", "em", "i", "u", "figure", "figcaption"]);
  return source.split(/(<[^>]*>)/g).map(piece => {
    if (!piece.startsWith("<")) return piece.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tag = piece.match(/^<\s*(\/?)\s*([a-z][\w-]*)\b[^>]*>$/i);
    if (!tag) return esc(piece);
    const name = tag[2].toLowerCase();
    if (allowed.has(name)) return `<${tag[1] ? "/" : ""}${name}>`;
    if (tag[1]) return name === "a" ? "</a>" : "";
    if (name !== "a" && name !== "img") return "";
    const attribute = name === "a" ? "href" : "src";
    const match = piece.match(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"));
    const url = match && (name === "a" ? safeLink(match[2]) : safeImage(match[2], { width: 900, height: 700, quality: 76 }));
    if (!url) return "";
    if (name === "a") return `<a href="${esc(url)}" rel="noopener noreferrer">`;
    const alt = piece.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2] || "";
    return `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }).join("");
}
function dateInfo(value) {
  const date = value && new Date(value), zone = "America/Sao_Paulo";
  if (!date || Number.isNaN(date.getTime())) return { day: "—", month: "A definir", weekday: "", long: "Data a confirmar", time: "", iso: "" };
  const fmt = options => new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: zone }).format(date);
  return { day: fmt({ day: "2-digit" }), month: fmt({ month: "short" }).replace(".", "").toUpperCase(), weekday: fmt({ weekday: "long" }), long: fmt({ day: "2-digit", month: "long", year: "numeric" }), time: fmt({ hour: "2-digit", minute: "2-digit" }), iso: date.toISOString() };
}
function currentOccurrence(item, now = new Date()) {
  const start = item.data_inicio && new Date(item.data_inicio);
  if (!start || Number.isNaN(start.getTime()) || !["semanal", "mensal", "anual"].includes(item.recorrencia_tipo)) return item;
  const dayKey = value => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  const today = dayKey(now);
  const recurrenceEnd = item.recorrencia_ate && new Date(item.recorrencia_ate);
  const originalEnd = item.data_fim && new Date(item.data_fim);
  const duration = originalEnd && !Number.isNaN(originalEnd.getTime()) ? originalEnd - start : null;
  const next = new Date(start);
  let guard = 0;
  while (dayKey(next) < today && guard < 520) {
    if (item.recorrencia_tipo === "semanal") next.setUTCDate(next.getUTCDate() + 7);
    else if (item.recorrencia_tipo === "mensal") next.setUTCMonth(next.getUTCMonth() + 1);
    else next.setUTCFullYear(next.getUTCFullYear() + 1);
    guard++;
  }
  if (recurrenceEnd && !Number.isNaN(recurrenceEnd.getTime()) && next > recurrenceEnd) return item;
  return { ...item, data_inicio: next.toISOString(), data_fim: duration ? new Date(next.getTime() + duration).toISOString() : item.data_fim };
}
function statusLabel(value) { return ({ rascunho: "Em preparação", anunciado: "Anunciado", confirmado: "Confirmado", acontecendo: "Acontecendo", encerrado: "Encerrado", cancelado: "Cancelado" })[value] || value || "Edição"; }
function recurrenceLabel(value) { return ({ semanal: "Evento semanal", mensal: "Evento mensal", anual: "Evento anual" })[value] || ""; }
function fact(icon, label, value, extra = "") { return value ? `<div class="event-fact">${icon}<div><small>${esc(label)}</small><strong>${esc(value)}</strong>${extra}</div></div>` : ""; }
function mapUrl(item) {
  const direct = safeLink(item.mapa_url);
  if (direct) return direct;
  const target = item.endereco || item.local;
  return target ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.titulo, target, "Urânia SP"].filter(Boolean).join(" "))}` : "";
}
function meta(title, description, image, alt, url, structured, type = "website") {
  return { title, description: plain(description).slice(0, 200), image: image || FALLBACK_IMAGE, alt, url, structured, type };
}
function relatedMarkup(items) {
  if (!items.length) return "";
  return `<section class="event-related"><header><div><p class="event-kicker">Na agenda</p><h2>Outros eventos.</h2></div><a href="/eventos/">Ver agenda <span aria-hidden="true">→</span></a></header><div class="event-related-grid">${items.map(item => {
    const date = dateInfo(item.data_inicio), image = safeImage(item.imagem_url, { width: 520, height: 330, quality: 76 }), recurrence = recurrenceLabel(item.recorrencia_tipo);
    return `<a class="event-related-card" href="/eventos/agenda/${encodeURIComponent(item.slug)}">${image ? `<img src="${esc(image)}" alt="" width="520" height="330" loading="lazy" decoding="async">` : ""}<div><time datetime="${esc(date.iso)}"><strong>${esc(date.day)}</strong><span>${esc(date.month)}</span></time><section>${recurrence ? `<small>${esc(recurrence)}</small>` : ""}<h3>${esc(item.titulo)}</h3>${item.local ? `<p>${esc(item.local)}</p>` : ""}</section></div></a>`;
  }).join("")}</div></section>`;
}

function renderSimple(event, related) {
  const item = currentOccurrence(event), date = dateInfo(item.data_inicio), end = dateInfo(item.data_fim);
  const image = safeImage(item.imagem_url), map = mapUrl(item), phone = String(item.whatsapp || "").replace(/\D/g, ""), recurrence = recurrenceLabel(item.recorrencia_tipo);
  const canonical = `${DOMAIN}/eventos/agenda/${encodeURIComponent(item.slug)}`;
  const summary = plain(item.descricao) || "Informações deste evento no Eu Amo Urânia.";
  const body = `<article class="event-detail" data-event-id="${esc(item.id)}"><nav class="event-breadcrumb" aria-label="Navegação estrutural"><a href="/eventos/">Agenda</a><span>/</span><span aria-current="page">${esc(item.titulo)}</span></nav><section class="event-detail-hero${image ? " has-image" : " no-image"}">
    ${image ? `<div class="event-detail-media"><img src="${esc(image)}" alt="${esc(item.titulo)}" width="1200" height="820" fetchpriority="high" decoding="async"></div>` : '<div class="event-detail-media event-detail-placeholder"><span>Agenda de Urânia</span></div>'}
    <time class="event-date-signature" datetime="${esc(date.iso)}" aria-label="${esc(`${date.long}${date.time ? ` às ${date.time}` : ""}`)}"><strong>${esc(date.day)}</strong><span>${esc(date.month)}</span><small>${esc(date.weekday)}</small></time>
    <header class="event-detail-intro"><div class="event-detail-labels"><span>Agenda de Urânia</span>${recurrence ? `<b>${esc(recurrence)}</b>` : ""}${item.destaque ? "<b>Destaque</b>" : ""}</div><h1>${esc(item.titulo)}</h1><p>${esc(summary)}</p><div class="event-detail-actions">${phone ? `<a class="event-action primary" href="https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Vim pelo Eu Amo Urânia e quero saber mais sobre ${item.titulo}.`)}" target="_blank" rel="noopener">${icons.whatsapp}<span>Falar com a organização</span></a>` : ""}${map ? `<a class="event-action" href="${esc(map)}" target="_blank" rel="noopener">${icons.map}<span>Como chegar</span></a>` : ""}<button class="event-icon-action" type="button" data-share-event aria-label="Compartilhar evento" title="Compartilhar">${icons.share}</button></div></header></section>
    <section class="event-detail-main"><div class="event-detail-copy"><p class="event-kicker">Sobre o evento</p><h2>O que você precisa saber.</h2><div class="event-description"><p>${esc(summary)}</p></div></div><aside class="event-info-panel" aria-labelledby="event-info-title"><p class="event-kicker">Informações úteis</p><h2 id="event-info-title">Quando e onde.</h2>${fact(icons.calendar, "Data", date.long, item.data_fim && end.long !== date.long ? `<span>até ${esc(end.long)}</span>` : "")}${fact(icons.clock, "Horário", date.time, item.data_fim && end.time ? `<span>até ${esc(end.time)}</span>` : "")}${fact(icons.pin, "Local", item.local, item.endereco ? `<span>${esc(item.endereco)}</span>` : "")}${fact(icons.calendar, "Organização", item.organizador)}${map ? `<a class="event-panel-map" href="${esc(map)}" target="_blank" rel="noopener">${icons.map}<span>Abrir no mapa</span><b aria-hidden="true">→</b></a>` : ""}</aside></section>${relatedMarkup(related)}</article>`;
  return { body, metadata: meta(`${item.titulo} | Eu Amo Urânia`, summary, safeImage(item.imagem_url, { width: 1200, height: 820 }), item.titulo, canonical,
    { "@context": "https://schema.org", "@type": "Event", name: item.titulo, description: summary, url: canonical, image: image || undefined, startDate: item.data_inicio || undefined, endDate: item.data_fim || undefined, eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled", location: item.local || item.endereco ? { "@type": "Place", name: item.local || undefined, address: item.endereco || undefined } : undefined, organizer: item.organizador ? { "@type": "Organization", name: item.organizador } : undefined }, "article") };
}
function editionCard(event, item) {
  const image = safeImage(item.banner_url || item.cartaz_url || event.imagem_capa_url, { width: 700, height: 440, quality: 76 }), url = `/eventos/${encodeURIComponent(event.slug)}/${encodeURIComponent(item.ano)}`;
  return `<article class="tradition-edition-card">${image ? `<a href="${url}"><img src="${esc(image)}" alt="" width="700" height="440" loading="lazy" decoding="async"></a>` : ""}<div><p>${esc(statusLabel(item.status))}</p><h3>${esc(item.titulo || `${event.nome} ${item.ano}`)}</h3><span>${esc(dateInfo(item.data_inicio).long)}${item.local ? ` · ${esc(item.local)}` : ""}</span><a href="${url}">Ver edição <b aria-hidden="true">→</b></a></div></article>`;
}
function gallery(raw, title, name, max, className, kicker) {
  const images = parseList(raw).map(item => safeImage(typeof item === "string" ? item : item?.url || item?.imagem_url, { width: 760, height: 560, quality: 76 })).filter(Boolean).slice(0, max);
  if (!images.length) return "";
  return `<section class="${className}"><header><p class="event-kicker">${kicker}</p><h2>${esc(title)}.</h2></header><div>${images.map((image, index) => `<button type="button" data-gallery-image="${esc(image)}" aria-label="Ampliar foto ${index + 1}"><img src="${esc(image)}" alt="${esc(`${name}, registro ${index + 1}`)}" width="760" height="560" loading="lazy" decoding="async"></button>`).join("")}</div></section>`;
}
function renderTradition(event, editions) {
  const current = editions.find(item => ["anunciado", "confirmado", "acontecendo"].includes(item.status)) || editions[0];
  const image = safeImage(event.imagem_capa_url), summary = plain(event.descricao_curta || event.historia_html) || `Conheça a história de ${event.nome} em Urânia.`;
  const canonical = `${DOMAIN}/eventos/${encodeURIComponent(event.slug)}`, history = richHtml(event.historia_html || `<p>${esc(summary)}</p>`), collapse = plain(event.historia_html || summary).length > 560;
  const body = `<article class="tradition-detail"><nav class="event-breadcrumb" aria-label="Navegação estrutural"><a href="/eventos/">Agenda</a><span>/</span><span aria-current="page">${esc(event.nome)}</span></nav><section class="event-detail-hero tradition-hero${image ? " has-image" : " no-image"}">${image ? `<div class="event-detail-media"><img src="${esc(image)}" alt="${esc(event.nome)}" width="1200" height="820" fetchpriority="high" decoding="async"></div>` : '<div class="event-detail-media event-detail-placeholder"><span>Tradição de Urânia</span></div>'}<div class="event-date-signature tradition-signature"><strong>Todo</strong><span>ano</span><small>${esc(event.periodo_aproximado || event.recorrencia || "Tradição")}</small></div><header class="event-detail-intro"><div class="event-detail-labels"><span>${esc(event.categoria || "Evento tradicional")}</span>${editions.length ? `<b>${editions.length} ${editions.length === 1 ? "edição" : "edições"}</b>` : ""}</div><h1>${esc(event.nome)}</h1><p>${esc(summary)}</p><div class="event-detail-actions">${current ? `<a class="event-action primary" href="/eventos/${encodeURIComponent(event.slug)}/${encodeURIComponent(current.ano)}"><span>Ver edição ${esc(current.ano)}</span></a>` : ""}<a class="event-action" href="#edicoes">${icons.calendar}<span>Ver edições</span></a><button class="event-icon-action" type="button" data-share-event aria-label="Compartilhar evento">${icons.share}</button></div></header></section>
    <section class="tradition-overview"><div><p class="event-kicker">Sobre o evento</p><h2>Uma tradição de Urânia.</h2><div id="tradition-story" class="tradition-story">${history}</div>${collapse ? '<button hidden style="display:none" class="tradition-read-more" type="button" aria-expanded="false" aria-controls="tradition-story"><span>Ver mais</span><b aria-hidden="true">↓</b></button>' : ""}</div><aside><p class="event-kicker">Informações</p><h2>De geração em geração.</h2>${[ ["Recorrência", event.recorrencia], ["Período", event.periodo_aproximado], ["Local tradicional", event.local_tradicional], ["Organização", event.organizador] ].filter(([, value]) => value).map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("")}</aside></section>
    <section id="edicoes" class="tradition-editions"><header><div><p class="event-kicker">Histórico</p><h2>Edições do evento.</h2></div><p>Programações, registros e informações de cada ano.</p></header>${editions.length ? `<div class="tradition-editions-grid">${editions.map(item => editionCard(event, item)).join("")}</div>` : '<p class="tradition-empty">As edições deste evento ainda serão cadastradas.</p>'}</section>${gallery(event.galeria_historica, "Galeria histórica", event.nome, 6, "tradition-gallery", "Memória da cidade")}</article>`;
  return { body, metadata: meta(event.seo_titulo || `${event.nome} | Eventos em Urânia`, event.seo_descricao || summary, image, event.nome, canonical,
    { "@context": "https://schema.org", "@type": "WebPage", name: event.nome, description: summary, url: canonical, image: image || undefined }) };
}
function contentSection(kicker, title, html, className = "") { return html ? `<section class="edition-content-section ${className}"><header><p class="event-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2></header><div class="edition-rich-copy">${richHtml(html)}</div></section>` : ""; }
function sponsorsMarkup(raw) {
  const items = parseList(raw);
  if (!items.length) return "";
  return `<section class="edition-sponsors"><header><p class="event-kicker">Apoio</p><h2>Patrocinadores e parceiros.</h2></header><div>${items.map(item => { const name = typeof item === "string" ? item : item?.nome || item?.titulo || "Parceiro", logo = safeImage(typeof item === "object" ? item.logo || item.imagem || item.url : ""); return `<article>${logo ? `<img src="${esc(logo)}" alt="${esc(name)}" width="160" height="90" loading="lazy">` : ""}<strong>${esc(name)}</strong></article>`; }).join("")}</div></section>`;
}
function renderEdition(event, edition) {
  const start = dateInfo(edition.data_inicio), end = dateInfo(edition.data_fim), image = safeImage(edition.banner_url || edition.cartaz_url || event.imagem_capa_url);
  const map = safeLink(edition.mapa_url) || ((edition.local || event.local_tradicional) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([edition.local || event.local_tradicional, "Urânia SP"].join(" "))}` : "");
  const summary = plain(edition.subtitulo || event.descricao_curta || edition.programacao_html) || `Confira as informações da edição ${edition.ano} de ${event.nome}.`;
  const canonical = `${DOMAIN}/eventos/${encodeURIComponent(event.slug)}/${encodeURIComponent(edition.ano)}`, program = richHtml(edition.programacao_html || `<p>${esc(summary)}</p>`), collapse = plain(edition.programacao_html || summary).length > 560;
  const body = `<article class="edition-detail"><nav class="event-breadcrumb" aria-label="Navegação estrutural"><a href="/eventos/">Agenda</a><span>/</span><a href="/eventos/${encodeURIComponent(event.slug)}">${esc(event.nome)}</a><span>/</span><span aria-current="page">${esc(edition.ano)}</span></nav><section class="event-detail-hero edition-hero${image ? " has-image" : " no-image"}">${image ? `<div class="event-detail-media"><img src="${esc(image)}" alt="${esc(edition.titulo || event.nome)}" width="1200" height="820" fetchpriority="high" decoding="async"></div>` : '<div class="event-detail-media event-detail-placeholder"><span>Edição do evento</span></div>'}<time class="event-date-signature" datetime="${esc(start.iso)}"><strong>${esc(start.day)}</strong><span>${esc(start.month)}</span><small>${esc(start.weekday)}</small></time><header class="event-detail-intro"><div class="event-detail-labels"><span>${esc(event.nome)}</span><b>${esc(statusLabel(edition.status))}</b></div><h1>${esc(edition.titulo || `${event.nome} ${edition.ano}`)}</h1><p>${esc(summary)}</p><div class="event-detail-actions">${map ? `<a class="event-action primary" href="${esc(map)}" target="_blank" rel="noopener">${icons.map}<span>Abrir mapa</span></a>` : ""}<button class="event-icon-action" type="button" data-share-event aria-label="Compartilhar edição">${icons.share}</button></div></header></section>
    <section class="edition-overview"><div><p class="event-kicker">Edição ${esc(edition.ano)}</p><h2>Informações da programação.</h2><div id="edition-program" class="edition-rich-copy edition-program">${program}</div>${collapse ? '<button hidden style="display:none" class="edition-read-more" type="button" aria-expanded="false" aria-controls="edition-program"><span>Ver mais</span><b aria-hidden="true">↓</b></button>' : ""}</div><aside class="event-info-panel"><p class="event-kicker">Quando e onde</p><h2>Planeje-se.</h2>${fact(icons.calendar, "Início", start.long, start.time ? `<span>${esc(start.time)}</span>` : "")}${fact(icons.clock, "Término", edition.data_fim ? end.long : "", edition.data_fim && end.time ? `<span>${esc(end.time)}</span>` : "")}${fact(icons.pin, "Local", edition.local || event.local_tradicional)}${fact(icons.people, "Público estimado", edition.publico_estimado ? Number(edition.publico_estimado).toLocaleString("pt-BR") : "")}${map ? `<a class="event-panel-map" href="${esc(map)}" target="_blank" rel="noopener">${icons.map}<span>Abrir no mapa</span><b aria-hidden="true">→</b></a>` : ""}</aside></section>
    ${contentSection("Atrações", "Destaques confirmados.", edition.atracoes_html, "edition-attractions")}${edition.cartaz_url ? `<section class="edition-poster"><div><p class="event-kicker">Cartaz oficial</p><h2>Divulgação da edição.</h2><p>Confira o material oficial publicado pela organização.</p></div><img src="${esc(safeImage(edition.cartaz_url, { width: 900, height: 1270, quality: 80 }))}" alt="Cartaz oficial de ${esc(edition.titulo || event.nome)}" width="900" height="1270" loading="lazy" decoding="async"></section>` : ""}${gallery(edition.galeria, "Galeria da edição", edition.titulo || event.nome, 8, "edition-gallery", "Registros")}${sponsorsMarkup(edition.patrocinadores)}${contentSection("Após o evento", "Resumo da edição.", edition.resumo_pos_evento_html, "edition-summary")}</article>`;
  return { body, metadata: meta(edition.seo_titulo || `${edition.titulo || `${event.nome} ${edition.ano}`} | Eu Amo Urânia`, edition.seo_descricao || summary, image, edition.titulo || event.nome, canonical,
    { "@context": "https://schema.org", "@type": "Event", name: edition.titulo || `${event.nome} ${edition.ano}`, description: summary, url: canonical, image: image || undefined, startDate: edition.data_inicio || undefined, endDate: edition.data_fim || undefined, eventStatus: edition.status === "cancelado" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", location: edition.local || event.local_tradicional ? { "@type": "Place", name: edition.local || event.local_tradicional } : undefined }, "article") };
}

async function eventPage(mode, year, slug, rows) {
  if (mode === "event-detail") {
    const events = await rows("eventos", { select: select.simple, slug: `eq.${slug}`, status: "eq.publicado", limit: "1" });
    if (!events[0]) return null;
    // Related events are progressive enhancement, never a prerequisite for
    // delivering the main event to people or crawlers.
    return renderSimple(events[0], []);
  }
  const [event] = await rows("eventos_principais", { select: select.tradition, slug: `eq.${slug}`, ativo: "eq.true", limit: "1" });
  if (!event) return null;
  const editions = await rows("eventos_edicoes", { select: select.edition, evento_id: `eq.${event.id}`, status: "in.(anunciado,confirmado,acontecendo,encerrado,cancelado)", ...(mode === "event-edition" ? { ano: `eq.${year}`, limit: "1" } : { order: "ano.desc,data_inicio.desc", limit: "50" }) });
  if (mode === "event-edition") return editions[0] ? renderEdition(event, editions[0]) : null;
  return renderTradition(event, editions);
}

module.exports = { eventPage, json, _test: { richHtml, currentOccurrence, dateInfo } };
