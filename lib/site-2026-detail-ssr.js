const { verifiedName } = require("./viva-verified.js");
// HTML inicial das páginas públicas de detalhe. A mesma árvore é enriquecida
// pelos scripts do preview; nenhum dado administrativo entra neste módulo.
const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));

const plain = value => String(value || "").replace(/<[^>]*>/g, " ")
  .replace(/&(?:nbsp|#160);/gi, " ")
  .replace(/&(?:amp|#38);/gi, "&")
  .replace(/&(?:lt|#60);/gi, "<")
  .replace(/&(?:gt|#62);/gi, ">")
  .replace(/&(?:quot|#34);/gi, '"')
  .replace(/&#(?:39|x27);/gi, "'")
  .replace(/\s+/g, " ").trim();
const decodeEntities = value => String(value || "")
  .replace(/&(?:nbsp|#160);/gi, " ")
  .replace(/&(?:amp|#38);/gi, "&")
  .replace(/&(?:lt|#60);/gi, "<")
  .replace(/&(?:gt|#62);/gi, ">")
  .replace(/&(?:quot|#34);/gi, '"')
  .replace(/&#(?:39|x27);/gi, "'");
const readAttr = (attrs, name) => {
  const match = String(attrs || "").match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'\`=<>]+))`, "i"));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "").trim() : "";
};
const safeHref = value => {
  const clean = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(clean) ? clean : "";
};
const imageTag = attrsOrHtml => {
  const source = readAttr(attrsOrHtml, "src");
  const src = safeImage(source, { width: 900, quality: 78, resize: "contain" });
  if (!src) return "";
  const alt = readAttr(attrsOrHtml, "alt");
  const rawWidth = readAttr(attrsOrHtml, "width");
  const rawHeight = readAttr(attrsOrHtml, "height");
  const width = /^\d+$/.test(rawWidth) ? rawWidth : "900";
  const height = /^\d+$/.test(rawHeight) ? rawHeight : "600";
  return `<img src="${src}" alt="${esc(alt)}" width="${width}" height="${height}" loading="lazy" decoding="async">`;
};
const ALLOWED_BODY_TAGS = new Set([
  "a", "b", "blockquote", "br", "em", "figcaption", "figure",
  "h2", "h3", "h4", "hr", "i", "img", "li", "ol", "p", "strong", "u", "ul"
]);
const VOID_BODY_TAGS = new Set(["br", "hr", "img"]);
const blocks = value => {
  const cleaned = String(value || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|object|embed|form|textarea|select|iframe|noscript|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(?:script|style|object|embed|form|input|button|textarea|select|link|meta|iframe|noscript|svg|math)\b[^>]*>/gi, "");
  const out = [];
  const stack = [];
  let hasBlock = false;
  const tagPattern = /<(\/?)([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  let lastIndex = 0;

  const pushText = rawText => {
    const safe = rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&nbsp;/gi, " ");
    if (safe) out.push(safe);
  };

  for (const match of cleaned.matchAll(tagPattern)) {
    if (match.index > lastIndex) pushText(cleaned.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
    const isClose = match[1] === "/";
    const tag = match[2].toLowerCase();
    const attrs = match[3] || "";
    if (!ALLOWED_BODY_TAGS.has(tag)) continue;

    if (isClose) {
      if (VOID_BODY_TAGS.has(tag)) continue;
      const idx = stack.lastIndexOf(tag);
      if (idx === -1) continue;
      while (stack.length > idx) out.push(`</${stack.pop()}>`);
      continue;
    }

    if (tag === "img") {
      const img = imageTag(attrs);
      if (img) {
        hasBlock = true;
        out.push(img);
      }
      continue;
    }
    if (tag === "br" || tag === "hr") {
      if (tag === "hr") hasBlock = true;
      out.push(`<${tag}>`);
      continue;
    }
    if (tag === "a") {
      const href = safeHref(readAttr(attrs, "href"));
      if (!href) continue;
      const target = readAttr(attrs, "target").toLowerCase() === "_blank" ? ' target="_blank" rel="noopener noreferrer"' : "";
      const title = readAttr(attrs, "title");
      const titleAttr = title ? ` title="${esc(title)}"` : "";
      stack.push("a");
      out.push(`<a href="${esc(href)}"${target}${titleAttr}>`);
      continue;
    }
    if (/^(?:p|h[2-4]|blockquote|ul|ol|figure)$/.test(tag)) hasBlock = true;
    stack.push(tag);
    out.push(`<${tag}>`);
  }
  if (lastIndex < cleaned.length) pushText(cleaned.slice(lastIndex));
  while (stack.length) out.push(`</${stack.pop()}>`);

  const result = out.join("").replace(/<(p|li|h[2-4]|blockquote)>\s*<\/\1>/gi, "").trim();
  if (!result) {
    const fallback = plain(cleaned);
    return fallback ? `<p>${esc(fallback)}</p>` : "";
  }
  return hasBlock ? result : `<p>${result}</p>`;
};
const short = (value, limit) => { const text = plain(value); return text.length > limit ? `${text.slice(0, limit).trim()}…` : text; };
const slugify = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");
const safeImage = (value, options = {}) => {
  const raw = String(value || "").trim();
  if (!/^(https?:\/\/|\/?assets\/|\/uploads\/|\/storage\/)/i.test(raw)) return "";
  let normalized = raw.startsWith("assets/") ? `/${raw}` : raw;
  if (/^https?:\/\//i.test(normalized) && normalized.includes("/storage/v1/object/public/")) {
    try {
      const url = new URL(normalized);
      url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
      if (options.width) url.searchParams.set("width", String(options.width));
      if (options.height) url.searchParams.set("height", String(options.height));
      if (options.quality) url.searchParams.set("quality", String(options.quality));
      if (options.width || options.height || options.resize) url.searchParams.set("resize", options.resize || "cover");
      normalized = url.href;
    } catch {}
  }
  return esc(normalized);
};
const safeHttp = value => /^https?:\/\//i.test(String(value || "")) ? esc(value) : "";
const imageList = (item, max, options = {}) => {
  let raw = item.galeria_urls;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = raw.split(/[\n,]/); } }
  return [item.imagem_url, ...(Array.isArray(raw) ? raw : [])]
    .map((value, index) => safeImage(typeof value === "string" ? value : value?.url || value?.imagem_url, index === 0 ? options : (options.gallery || options)))
    .filter((value, index, list) => value && list.indexOf(value) === index).slice(0, max);
};
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("pt-BR", { day:"numeric", month:"long", year:"numeric", timeZone:"America/Sao_Paulo" }).format(date);
};
const formatDateTime = value => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("pt-BR", { dateStyle:"long", timeStyle:"short", timeZone:"America/Sao_Paulo" }).format(date);
};
const DAYS = [["mon","Segunda"],["tue","Terça"],["wed","Quarta"],["thu","Quinta"],["fri","Sexta"],["sat","Sábado"],["sun","Domingo"]];
function parseHours(raw) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return []; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return DAYS.map(([key,label]) => {
    const day=raw[key];
    if (!day || typeof day !== "object") return null;
    if (day.closed === true || day.isClosed === true) return { key,label,closed:true,periods:[] };
    if (day.twenty_four_hours || day.open_24h || day.is_24h || day.all_day) return { key,label,allDay:true,periods:[["00:00","24:00"]] };
    const periods=(Array.isArray(day.periods) ? day.periods : Array.isArray(day.shifts) ? day.shifts : [day])
      .map(period => [String(period?.open || ""),String(period?.close || "")])
      .filter(([open,close]) => /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close));
    return periods.length ? { key,label,periods } : null;
  }).filter(Boolean);
}
function openingState(hours) {
  if (!hours.length) return null;
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());
  const key=parts.find(part => part.type==="weekday")?.value.toLowerCase().slice(0,3);
  const minutes=Number(parts.find(part => part.type==="hour")?.value || 0)*60+Number(parts.find(part => part.type==="minute")?.value || 0);
  const day=hours.find(entry => entry.key===key);
  if (!day || day.closed) return {open:false,label:"Fechado agora"};
  if (day.allDay) return {open:true,label:"Aberto agora",detail:"24 horas"};
  const active=day.periods.find(([open,close]) => {
    const [oh,om]=open.split(":").map(Number),[ch,cm]=close.split(":").map(Number);
    const start=oh*60+om,end=close==="24:00" ? 1440 : ch*60+cm;
    return end>=start ? minutes>=start && minutes<end : minutes>=start || minutes<end;
  });
  return active ? {open:true,label:"Aberto agora",detail:`Fecha às ${active[1].replace(":","h")}`} : {open:false,label:"Fechado agora"};
}
const guideHours = (item,hours) => hours.length ? `<div class="hours-list">${DAYS.map(([key,label]) => {
  const day=hours.find(entry => entry.key===key);
  const value=!day || day.closed ? "Fechado" : day.allDay ? "24 horas" : day.periods.map(([open,close]) => `${open}–${close}`).join(" / ");
  return `<div><span>${label}</span><strong>${esc(value)}</strong></div>`;
}).join("")}${item.opening_hours_note ? `<p>${esc(item.opening_hours_note)}</p>` : ""}</div>` : item.horario ? `<p class="hours-simple">${esc(item.horario)}</p>${item.opening_hours_note ? `<p class="hours-note">${esc(item.opening_hours_note)}</p>` : ""}` : "";
const tourismHours = (item,hours) => hours.length ? `<details class="hours-details"><summary>Ver todos os horários</summary><div>${DAYS.map(([key,label]) => {
  const day=hours.find(entry => entry.key===key);
  const value=!day || day.closed ? "Fechado" : day.allDay ? "24 horas" : day.periods.map(([open,close]) => `${open}–${close}`).join(" / ");
  return `<p><span>${label}</span><strong>${esc(value)}</strong></p>`;
}).join("")}${item.opening_hours_note ? `<em>${esc(item.opening_hours_note)}</em>` : ""}</div></details>` : item.horario ? `<p class="plain-hours">${esc(item.horario)}</p>${item.opening_hours_note ? `<p class="hours-note">${esc(item.opening_hours_note)}</p>` : ""}` : "";
const icons = {
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1 5-2 1c1 3 3 5 6 6l1-2 5 1v3c0 2-2 4-4 4C9 20 4 15 3 7c0-2 2-4 4-4Z"/></svg>',
  globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0-18"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.2"/><path d="M17.3 6.8h.01"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.6-4H14V7.3c0-1.2.4-2 2.1-2H18V2.2c-.8-.1-1.8-.2-3-.2-3 0-5 1.8-5 5.2V9H7v4h3v8"/></svg>',
  arrow:'<span aria-hidden="true">→</span>'
};
const instagram = value => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return safeHttp(value);
  const handle = String(value).replace(/^@/, "").replace(/[^a-z0-9._]/gi, "");
  return handle ? `https://instagram.com/${handle}` : "";
};
const mapUrl = item => safeHttp(item.mapa_url) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" "))}`;

function renderArticleRelated({ related = [], popular = [] } = {}) {
  const next = related[0];
  const more = related.slice(1, 4);
  if (!next && !more.length && !popular.length) {
    return '<div id="article-related" class="article-related" aria-live="polite"></div>';
  }
  const nextImage = next ? safeImage(next.imagem_url, { width: 420, height: 280, quality: 75 }) : "";
  const nextHtml = next
    ? `<section class="next-story" aria-labelledby="next-title"><p>Próxima leitura</p><a href="/noticias/${encodeURIComponent(next.slug)}">${nextImage ? `<img class="next-story-image" src="${nextImage}" alt="" width="420" height="280" loading="lazy" decoding="async">` : ""}<span><small>${esc(next.categoria_nome || "Notícias")} · ${esc(formatDateTime(next.publicado_em))}</small><strong id="next-title">${esc(next.titulo)}</strong></span><b aria-hidden="true">→</b></a></section>`
    : "";
  const moreHtml = more.length
    ? `<section class="continue-reading" aria-labelledby="continue-title"><header><p>Mais notícias</p><h2 id="continue-title">Continue lendo.</h2></header><div class="more-track">${more.map(item => {
        const image = safeImage(item.imagem_url, { width: 700, height: 440, quality: 75 });
        return `<a class="more-card${image ? "" : " no-image"}" href="/noticias/${encodeURIComponent(item.slug)}">${image ? `<img src="${image}" alt="${esc(item.titulo)}" width="700" height="440" loading="lazy" decoding="async">` : ""}<div><p>${esc(item.categoria_nome || "Notícias")}</p><h3>${esc(item.titulo)}</h3><span>${esc(formatDateTime(item.publicado_em))}</span></div></a>`;
      }).join("")}</div></section>`
    : "";
  const popularHtml = popular.length
    ? `<section class="article-trending" aria-labelledby="popular-title"><header><p>Mais lidas</p><h2 id="popular-title">Em alta.</h2></header><ol>${popular.map((item, index) => `<li><a href="/noticias/${encodeURIComponent(item.slug)}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(item.titulo)}</strong><b aria-hidden="true">↗</b></a></li>`).join("")}</ol></section>`
    : "";
  return `<div id="article-related" class="article-related" data-server-rendered="true" aria-live="polite">${nextHtml}${moreHtml}${popularHtml}</div>`;
}

function renderNewsBase(news, relatedData) {
  const category = news.categoria_nome || "Notícias";
  const text = plain(news.conteudo_html || news.resumo);
  const minutes = Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 220));
  const image = safeImage(news.imagem_url, { width: 1200, quality: 80, resize: "contain" });
  const url = `https://euamourania.com.br/noticias/${encodeURIComponent(news.slug)}`;
  const shareText = encodeURIComponent(`${news.titulo} — ${url}`);
  return `<article class="article-reading" data-server-rendered="true"><nav class="article-breadcrumb" aria-label="Navegação da notícia"><a href="/news/">Notícias</a><i>/</i><a href="/news/${encodeURIComponent(slugify(category))}/">${esc(category)}</a></nav><header class="article-header"><p class="article-category">${esc(category)}</p><h1>${esc(news.titulo)}</h1>${news.subtitulo ? `<p class="article-subtitle">${esc(news.subtitulo)}</p>` : ""}<div class="article-meta"><span>Por ${esc(news.autor || "Eu Amo Urânia")}</span><time datetime="${esc(news.publicado_em)}">${esc(formatDate(news.publicado_em))}</time><span>${minutes} min de leitura</span></div><div class="article-share" aria-label="Compartilhar notícia"><a href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" rel="noopener">WhatsApp</a><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a><button type="button" data-copy-link>Copiar link</button><button type="button" data-native-share>Compartilhar</button></div></header>${image ? `<figure class="article-hero"><img src="${image}" alt="${esc(news.legenda_imagem || news.titulo)}" width="1600" height="960" fetchpriority="high" decoding="async">${news.legenda_imagem ? `<figcaption>${esc(news.legenda_imagem)}</figcaption>` : ""}</figure>` : ""}<div class="article-copy" data-ad-eligible="${text.split(/\s+/).length >= 280}">${blocks(news.conteudo_html || news.resumo)}</div><footer class="article-correction"><a href="/news/correcoes-transparencia-contato/">Encontrou algum erro? Solicitar correção <span aria-hidden="true">→</span></a></footer></article><section class="editorial-contact"><div><p>Colabore com a redação</p><h2>Tem uma história relevante para Urânia?</h2><span>Envie pautas, fotos ou informações. A conversa continua depois da leitura.</span></div><a href="https://wa.me/5517976005583" target="_blank" rel="noopener">Falar com a redação <b aria-hidden="true">→</b></a></section>${renderArticleRelated(relatedData)}`;
}

function renderGuideBase(item, awards = []) {
  const images = imageList(item, 5, { width: 850, height: 700, quality: 80, gallery: { width: 850, height: 700, quality: 76 } });
  const thumbs = imageList(item, 5, { width: 160, height: 160, quality: 72 });
  const image = images[0] || "/assets/1505 - Urania - Logo Horizontal - 1.png";
  const whatsappDigits = String(item.whatsapp || "").replace(/\D/g, "");
  const phoneDigits = String(item.telefone || "").replace(/[^\d+]/g, "");
  const map = mapUrl(item), insta = instagram(item.instagram), site = safeHttp(item.site), facebook = safeHttp(item.facebook);
  const action = whatsappDigits ? `<a class="primary-action" href="https://wa.me/${whatsappDigits}" target="_blank" rel="noopener">${icons.whatsapp}<span>Chamar no WhatsApp</span>${icons.arrow}</a>` : phoneDigits ? `<a class="primary-action phone-primary" href="tel:${esc(phoneDigits)}">${icons.phone}<span>Ligar agora</span>${icons.arrow}</a>` : "";
  const categoryBadge = item.categoria_nome ? `<a href="/guia/categoria/${encodeURIComponent(slugify(item.categoria_nome))}">${esc(item.categoria_nome)}</a>` : "";
  const topAward = Array.isArray(awards) ? awards[0] : null;
  const awardBadge = topAward
    ? `<a class="business-award-link" href="${esc(topAward.winnerHref || topAward.categoryHref)}">${topAward.isWinner ? "Vencedor" : "Indicado"} · ${esc(topAward.categoryName)} (${esc(topAward.year)})</a>`
    : "";
  const awardLinksHtml = Array.isArray(awards) && awards.length
    ? awards.map(award => `<a href="${esc(award.categoryHref)}"><span><strong>${esc(award.isWinner ? `Vencedor · ${award.editionName}` : `Indicado · ${award.editionName}`)}</strong><small>${esc(award.categoryName)} · Ver categoria</small></span></a><a href="${esc(award.editionHref)}"><span><strong>${esc(award.editionName)}</strong><small>Ver edição oficial</small></span></a>`).join("")
    : "";
  return `<article class="business-page" data-guide-id="${esc(item.id)}" data-server-rendered="true"><section class="business-hero detail-container"><div class="business-media"><img id="business-main-image" src="${image}" alt="${esc(item.nome)}" width="850" height="700" fetchpriority="high" decoding="async">${images.length > 1 ? `<div class="business-gallery" aria-label="Galeria de ${esc(item.nome)}">${images.map((src, index) => `<button type="button" class="gallery-thumb${index ? "" : " active"}" data-image="${src}" aria-label="Ver imagem ${index + 1}"><img src="${thumbs[index] || src}" alt="" width="72" height="72" loading="lazy"></button>`).join("")}</div>` : ""}</div><div class="business-intro"><div class="business-badges">${categoryBadge}${item.recomendado_editorial || item.recomendado ? "<strong>Recomendado</strong>" : ""}${awardBadge}</div><p class="business-kicker">Guia de Urânia</p><h1>${verifiedName(esc(item.nome), item.verificado)}</h1>${item.descricao ? `<p class="business-summary">${esc(item.descricao)}</p>` : ""}${item.horario ? `<div class="opening-quick">${icons.clock}<span>${esc(item.horario)}</span></div>` : ""}${item.endereco ? `<p class="business-address">${icons.pin}<span>${esc(item.endereco)}</span></p>` : ""}<div class="business-actions">${action}<div class="secondary-actions">${insta ? `<a href="${insta}" target="_blank" rel="noopener" aria-label="Instagram">${icons.instagram}</a>` : ""}${map ? `<a href="${map}" target="_blank" rel="noopener" aria-label="Abrir no mapa">${icons.map}</a>` : ""}${phoneDigits ? `<a href="tel:${esc(phoneDigits)}" aria-label="Ligar">${icons.phone}</a>` : ""}<button id="share-business" type="button" aria-label="Compartilhar">${icons.share}</button></div></div></div></section><section class="business-information detail-container"><div class="info-copy"><p class="section-kicker">Informações úteis</p><h2>Tudo para chegar e falar com facilidade.</h2>${item.endereco ? `<div class="info-block"><span>${icons.pin}</span><div><small>Endereço</small><strong>${esc(item.endereco)}</strong><a href="${map}" target="_blank" rel="noopener">Abrir no mapa ${icons.arrow}</a></div></div>` : ""}<div class="contact-links" aria-label="Canais da empresa">${phoneDigits ? `<a href="tel:${esc(phoneDigits)}">${icons.phone}<span><strong>Telefone</strong><small>${esc(item.telefone)}</small></span></a>` : ""}${site ? `<a href="${site}" target="_blank" rel="noopener">${icons.globe}<span><strong>Site</strong><small>Visitar</small></span></a>` : ""}${insta ? `<a href="${insta}" target="_blank" rel="noopener">${icons.instagram}<span><strong>Instagram</strong><small>Abrir perfil</small></span></a>` : ""}${facebook ? `<a href="${facebook}" target="_blank" rel="noopener">${icons.globe}<span><strong>Facebook</strong><small>Abrir página</small></span></a>` : ""}${awardLinksHtml}</div></div>${item.horario || item.opening_hours ? `<aside class="hours-panel"><div class="hours-title">${icons.clock}<div><p>Horários</p><h2>Quando encontrar aberto</h2></div></div>${item.horario ? `<p class="hours-simple">${esc(item.horario)}</p>` : ""}</aside>` : ""}</section><div id="guide-related-ssr"></div></article>`;
}

function renderTourismBase(item) {
  const images = imageList(item, 8, { width: 960, height: 760, quality: 80 });
  const thumbs = imageList(item, 8, { width: 620, height: 440, quality: 76 });
  if (!images.length) images.push("/assets/AD3A1763-min (1).jpg");
  const map = mapUrl(item), whatsappDigits = String(item.whatsapp || "").replace(/\D/g, ""), insta = instagram(item.instagram);
  const actions = `<a class="visit-action primary" href="${map}" target="_blank" rel="noopener">${icons.map}<span>Abrir no mapa</span>${icons.arrow}</a>${whatsappDigits ? `<a class="visit-action" href="https://wa.me/${whatsappDigits}" target="_blank" rel="noopener">${icons.whatsapp}<span>Falar no WhatsApp</span></a>` : ""}${insta ? `<a class="visit-icon" href="${insta}" target="_blank" rel="noopener" aria-label="Abrir Instagram">${icons.instagram}</a>` : ""}${safeHttp(item.site) ? `<a class="visit-icon" href="${safeHttp(item.site)}" target="_blank" rel="noopener" aria-label="Abrir site oficial">${icons.globe}</a>` : ""}`;
  const text = plain(item.conteudo_html || item.descricao);
  return `<article class="tourism-place" data-tourism-id="${esc(item.id)}" data-server-rendered="true"><nav class="place-breadcrumb" aria-label="Navegação estrutural"><a href="/turismo.html">Turismo</a><span>/</span><span aria-current="page">${esc(item.nome)}</span></nav><section class="place-hero"><div class="place-hero-media"><div class="place-gallery-track" tabindex="0" aria-label="Fotos de ${esc(item.nome)}">${images.map((src,index) => `<figure class="place-gallery-slide"><img src="${src}" alt="${esc(index ? `${item.nome}, foto ${index+1}` : item.nome)}" width="900" height="720" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`).join("")}</div>${images.length > 1 ? `<div class="place-gallery-controls"><button type="button" data-gallery-prev aria-label="Foto anterior">←</button><span><b data-gallery-current>1</b> / ${images.length}</span><button type="button" data-gallery-next aria-label="Próxima foto">→</button></div>` : ""}</div><header class="place-hero-copy"><div class="place-badges"><a href="/turismo.html?busca=${encodeURIComponent(item.categoria_nome || "Turismo local")}">${esc(item.categoria_nome || "Turismo local")}</a>${item.destaque ? "<strong>Destaque</strong>" : ""}</div><p class="place-kicker">Descubra Urânia</p><h1>${esc(item.nome)}</h1>${item.descricao ? `<p class="place-summary">${esc(short(item.descricao,220))}</p>` : ""}<div class="place-quick-info">${item.endereco ? `<p>${icons.pin}<span>${esc(plain(item.endereco).split(",")[0])}</span></p>` : ""}${item.horario ? `<p>${icons.clock}<span>${esc(short(item.horario,75))}</span></p>` : ""}</div><div class="hero-actions">${actions}<button class="visit-icon" type="button" data-share-place aria-label="Compartilhar lugar">${icons.share}</button></div></header></section><section class="place-main"><div class="place-story"><p class="section-kicker">Sobre a experiência</p><h2>Conheça este lugar.</h2><div id="place-article" class="place-article${text.length > 620 ? " is-collapsed" : ""}">${blocks(item.conteudo_html || item.descricao)}</div>${text.length > 620 ? '<button class="read-more" type="button" aria-expanded="false" aria-controls="place-article">Ver mais <span aria-hidden="true">↓</span></button>' : ""}</div><aside class="visit-panel"><p class="section-kicker">Informações úteis</p><h2>Planeje sua visita.</h2>${item.endereco ? `<div class="visit-fact">${icons.pin}<div><small>Endereço</small><strong>${esc(item.endereco)}</strong><a href="${map}" target="_blank" rel="noopener">Ver no mapa ${icons.arrow}</a></div></div>` : ""}${item.horario || item.opening_hours ? `<div class="visit-fact">${icons.clock}<div><small>Horários</small>${item.horario ? `<p class="plain-hours">${esc(item.horario)}</p>` : ""}</div></div>` : ""}<div class="visit-panel-actions">${actions}<button class="visit-icon" type="button" data-share-place aria-label="Compartilhar lugar">${icons.share}</button></div></aside></section>${images.length > 2 ? `<section class="place-photo-story"><header><p class="section-kicker">Galeria</p><h2>Registros do local.</h2></header><div class="place-photo-grid">${images.slice(1,5).map((src,index) => `<button type="button" data-gallery-jump="${index+1}" aria-label="Ver foto ${index+2} na galeria"><img src="${thumbs[index + 1] || src}" alt="${esc(`${item.nome}, registro ${index+1}`)}" width="620" height="440" loading="lazy" decoding="async"></button>`).join("")}</div></section>` : ""}<div class="place-relations"></div></article>`;
}

const shareIcons={
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.8 9.8 0 0 0-8.4 14.8L2 22l5.4-1.4A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3.2.9.9-3.1-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.8-1.8-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.3 0-.4.1-.5l.4-.5.2-.4c.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.5-.4-.7-.4H8c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.2l.8-4h-4V9c0-.7.3-1 1-1Z"/></svg>',
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="11" height="11" rx="2"></rect><path d="M9 8V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-3 2h-3"></path></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"></path></svg>'
};

function renderNews(news, relatedData) {
  const canonical=`https://euamourania.com.br/noticias/${encodeURIComponent(news.slug)}`;
  const shareText=encodeURIComponent(`${news.titulo} — ${canonical}`);
  const share=`<div class="article-share" aria-label="Compartilhar notícia"><a href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" rel="noopener" aria-label="Compartilhar no WhatsApp">${shareIcons.whatsapp}<span>WhatsApp</span></a><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}" target="_blank" rel="noopener" aria-label="Compartilhar no Facebook">${shareIcons.facebook}<span>Facebook</span></a><button type="button" data-copy-link aria-label="Copiar link">${shareIcons.copy}<span>Copiar link</span></button><button type="button" data-native-share aria-label="Compartilhar notícia">${shareIcons.share}<span>Compartilhar</span></button></div>`;
  return renderNewsBase(news, relatedData).replace(/<div class="article-share"[^>]*>[\s\S]*?<\/div>/,share);
}

function renderGuide(item, awards = []) {
  let html=renderGuideBase(item, awards);
  const hours=parseHours(item.opening_hours),state=openingState(hours);
  if(state){
    const status=`<div class="opening-state ${state.open ? "is-open" : "is-closed"}"><i></i><strong>${state.label}</strong>${state.detail ? `<span>${esc(state.detail)}</span>` : ""}</div>`;
    if(html.includes('<div class="opening-quick">'))html=html.replace(/<div class="opening-quick">[\s\S]*?<\/div>/,status);
    else html=html.replace('<div class="business-actions">',`${status}<div class="business-actions">`);
  }
  const panelStart=html.indexOf('<aside class="hours-panel">');
  if(panelStart>=0){
    const panelEnd=html.indexOf('</aside>',panelStart);
    if(panelEnd>=0)html=html.slice(0,panelStart)+html.slice(panelEnd+'</aside>'.length);
  }
  if(hours.length || item.horario){
    const panel=`<aside class="hours-panel"><div class="hours-title">${icons.clock}<div><p>Horários</p><h2>Quando encontrar aberto</h2></div></div>${guideHours(item,hours)}</aside>`;
    html=html.replace('</section><div id="guide-related-ssr">',`${panel}</section><div id="guide-related-ssr">`);
  }
  return html;
}

function renderTourism(item) {
  let html=renderTourismBase(item);
  const hours=parseHours(item.opening_hours),state=openingState(hours);
  if(state){
    const quick=`<div class="place-quick-info">${item.endereco ? `<p>${icons.pin}<span>${esc(plain(item.endereco).split(",")[0])}</span></p>` : ""}<p class="opening-state ${state.open ? "is-open" : "is-closed"}"><i></i><span><strong>${state.label}</strong>${state.detail ? `<small>${esc(state.detail)}</small>` : ""}</span></p></div>`;
    html=html.replace(/<div class="place-quick-info">[\s\S]*?<\/div>/,quick);
  }
  if(hours.length){
    const status=state ? `<strong class="${state.open ? "open" : "closed"}">${state.label}${state.detail ? ` · ${esc(state.detail)}` : ""}</strong>` : "";
    html=html.replace(/<small>Horários<\/small>(?:<p class="plain-hours">[\s\S]*?<\/p>)?/,`<small>Horários</small>${status}${tourismHours(item,hours)}`);
  }else if(!item.horario){
    html=html.replace(`<div class="visit-fact">${icons.clock}<div><small>Horários</small></div></div>`,"");
  }
  const facebook=safeHttp(item.facebook);
  if(facebook){
    const link=`<a class="visit-icon" href="${facebook}" target="_blank" rel="noopener" aria-label="Abrir Facebook" title="Facebook">${icons.facebook}</a>`;
    html=html.replaceAll('<button class="visit-icon" type="button" data-share-place',`${link}<button class="visit-icon" type="button" data-share-place`);
  }
  // Sem JavaScript o texto inteiro fica disponível e o controle inerte não aparece.
  // A hidratação aplica o recorte e ativa o botão assim que os dados iniciais são lidos.
  html=html.replace('class="place-article is-collapsed"','class="place-article"').replace('<button class="read-more"','<button hidden style="display:none" class="read-more"');
  return html;
}

const leakedAdminText = value => /Exibir na listagem|Salvar iniciativa|Formas de ajuda/i.test(value || "");

function initiativeHelpHref(entry) {
  if (!entry?.valor_publico) return "";
  if (entry.tipo === "telefone") return `tel:${String(entry.valor_publico).replace(/\D/g, "")}`;
  if (entry.tipo === "whatsapp") return `https://wa.me/${String(entry.valor_publico).replace(/\D/g, "")}`;
  return safeHref(entry.valor_publico);
}

function initiativeHelpLabel(entry) {
  if (entry.tipo === "pix") return "Copiar chave Pix";
  if (entry.tipo === "whatsapp") return "Conversar no WhatsApp";
  if (entry.tipo === "telefone") return "Ligar agora";
  return "Acessar canal";
}

function renderInitiative(data) {
  const item = data?.initiative || data;
  if (!item?.titulo) return "";
  const help = Array.isArray(data?.help) ? data.help : [];
  const actions = Array.isArray(data?.actions) ? data.actions : [];
  const fallback = "Conheça esta iniciativa e acompanhe o trabalho realizado em nossa comunidade.";
  const summary = leakedAdminText(item.resumo) ? fallback : plain(item.resumo) || fallback;
  const description = leakedAdminText(item.descricao) ? summary : plain(item.descricao) || summary;
  const image = safeImage(item.imagem_capa_url) || "/assets/compartilhamento-logo.png";
  const type = item.tipo === "projeto" ? "Projeto permanente" : "Ação da comunidade";
  const primaryHelp = help.find(entry => entry.tipo === "whatsapp" && initiativeHelpHref(entry));
  const helpCards = help.length
    ? `<div class="initiative-help-list">${help.map((entry, index) => {
        const href = initiativeHelpHref(entry);
        return `<article class="initiative-help-card"><span class="initiative-help-number">${String(index + 1).padStart(2, "0")}</span><div><h3>${esc(entry.titulo || "Como ajudar")}</h3>${entry.descricao ? `<p>${esc(entry.descricao)}</p>` : ""}</div>${entry.tipo === "pix" ? `<button type="button" data-pix="${esc(entry.valor_publico || "")}">${initiativeHelpLabel(entry)} <b>→</b></button>` : href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${initiativeHelpLabel(entry)} <b>→</b></a>` : ""}</article>`;
      }).join("")}</div>`
    : `<div class="initiative-help-empty"><span>♡</span><p>As formas de participação serão divulgadas aqui quando estiverem disponíveis.</p></div>`;
  const actionsHtml = actions.length
    ? `<div class="initiative-help-list">${actions.map((action, index) => `<article class="initiative-help-card"><span class="initiative-help-number">${String(index + 1).padStart(2, "0")}</span><div><h3>${esc(action.titulo)}</h3><p>${esc(plain(action.resumo) || "Conhecer ação vinculada")}</p></div><a href="/iniciativas/${encodeURIComponent(action.slug)}">Conhecer ação <b>→</b></a></article>`).join("")}</div>`
    : "";
  return `<div data-server-rendered="true" data-initiative-slug="${esc(item.slug || "")}"><div class="initiative-detail-breadcrumb initiative-shell"><a href="/iniciativas/">Iniciativas</a><span>/</span><span>${esc(item.titulo)}</span></div><section class="initiative-profile initiative-shell"><figure class="initiative-profile-media"><img src="${image}" alt="${esc(item.titulo)}" width="1400" height="1000" fetchpriority="high" decoding="async"><figcaption>Uma iniciativa de Urânia</figcaption></figure><div class="initiative-profile-copy"><span class="initiative-detail-type">${esc(type)}</span><h1>${esc(item.titulo)}</h1><p>${esc(summary)}</p><div class="initiative-profile-actions"><a class="initiative-primary" href="${primaryHelp ? esc(initiativeHelpHref(primaryHelp)) : "#historia"}"${primaryHelp ? ' target="_blank" rel="noopener"' : ""}>${primaryHelp ? "Quero participar" : "Conhecer a história"} <b>→</b></a><button type="button" data-share>Compartilhar <b>↗</b></button></div></div></section><section class="initiative-detail-body initiative-shell" id="historia"><article class="initiative-story"><p class="initiative-eyebrow">História e propósito</p><h2>Uma ideia que cuida do que está perto.</h2><div class="initiative-story-text"><p>${esc(description)}</p>${actionsHtml}</div></article><aside class="initiative-help" id="como-ajudar"><p class="initiative-eyebrow">Faça parte</p><h2>Como participar.</h2><p class="initiative-help-intro">Cada iniciativa tem seu próprio jeito de receber apoio. Confira os canais informados pelos responsáveis.</p>${helpCards}${help.length ? "<small>O Eu Amo Urânia apenas divulga a iniciativa e não processa transferências.</small>" : ""}</aside></section><section class="initiative-community-note"><div class="initiative-shell"><p>Quando a cidade se mobiliza, todo mundo fica mais perto.</p><a href="/iniciativas/">Ver todas as iniciativas <b>→</b></a></div></section></div>`;
}

module.exports = { renderNews, renderGuide, renderTourism, renderInitiative };
