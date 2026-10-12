const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { handlePublicSubmission } = require("../lib/public-submission-handler.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";

const esc = (v = "") => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const absolute = (v, domain) => {
  try {
    return new URL(v, domain + "/").href;
  } catch {
    return v;
  }
};
const safeImage = value => {
  const raw = String(value || "").trim();
  return /^https:\/\//i.test(raw) || /^\/?assets\//i.test(raw)
    ? (raw.startsWith("assets/") ? `/${raw}` : raw) : "";
};
const plain = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const shorten = (value, length) => {
  const result = plain(value);
  return result.length > length ? `${result.slice(0, length).trim()}…` : result;
};
const route = value => encodeURIComponent(value?.slug || value?.id || "");

async function fetchPublicRows(table, params, timeout = 6000) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(params)}`, {
    headers: { apikey: KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error(`${table}: resposta inválida`);
  return rows;
}

function replaceHomeSection(html, id, markup, state = "true") {
  const pattern = new RegExp(`(<div\\b[^>]*\\bid="${id}"[^>]*)(>)[\\s\\S]*?(<\\/div>)`, "i");
  if (!pattern.test(html)) throw new Error(`Bloco ${id} não encontrado`);
  return html.replace(pattern, (_, start, end, close) => `${start} data-server-rendered="${state}"${end}${markup}${close}`);
}

function newsMarkup(rows) {
  const items = rows.filter(item => safeImage(item.imagem_url)).slice(0, 3);
  if (!items.length) return '<p class="loading">As notícias da cidade aparecerão aqui.</p>';
  return items.map((item, index) => `<a class="news-card" href="/noticias/${route(item)}"><img src="${esc(safeImage(item.imagem_url))}" alt="" width="760" height="560" ${index ? 'loading="lazy"' : 'fetchpriority="high"'}><div class="news-copy"><small>${esc(item.categoria_nome || "Notícia")}</small><h3>${esc(item.titulo)}</h3></div></a>`).join("");
}

function businessMarkup(rows) {
  if (!rows.length) return '<p class="loading">Os estabelecimentos do Guia aparecerão aqui.</p>';
  return rows.map(item => `<a class="business-card${item.recomendado ? " is-featured" : ""}" href="${item.slug ? `/guia/${encodeURIComponent(item.slug)}` : `/guia-details.html?slug=${encodeURIComponent(item.id || "")}`}">${safeImage(item.imagem_url) ? `<img src="${esc(safeImage(item.imagem_url))}" alt="" width="82" height="82" loading="lazy">` : '<span class="business-placeholder" aria-hidden="true"></span>'}${item.recomendado ? '<span class="recommended">Recomendado</span>' : ""}<small>${esc(item.categoria_nome || "Guia da cidade")}</small><h3>${esc(item.nome)}</h3><p>${esc(shorten(item.descricao, 92) || "Conheça este lugar no Guia de Urânia.")}</p></a>`).join("");
}

function tourismMarkup(rows) {
  if (!rows.length) return '<span>Os lugares de Urânia aparecerão aqui.</span>';
  return rows.map(item => `<a href="/turismo/${route(item)}"><span>${esc(item.nome)}</span><small>${esc(item.categoria_nome || "Conhecer")}</small></a>`).join("");
}

function endOfCityDay(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo"
  }).formatToParts(date).map(part => [part.type, part.value]));
  const localEnd = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 23, 59, 59, 999);
  const offsetAt = timestamp => {
    const label = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo", timeZoneName: "shortOffset"
    }).formatToParts(new Date(timestamp)).find(part => part.type === "timeZoneName")?.value || "";
    const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(label);
    if (!match) throw new Error("Fuso horário de Urânia indisponível");
    return (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] || 0)) * 60000;
  };
  const provisional = localEnd - offsetAt(localEnd);
  return new Date(localEnd - offsetAt(provisional));
}

function occurrence(event, now) {
  const date = event.data_inicio ? new Date(event.data_inicio) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  let end = event.data_fim ? new Date(event.data_fim) : endOfCityDay(date);
  if (Number.isNaN(end.getTime())) end = new Date(date);
  const type = event.recorrencia_tipo;
  if (["semanal", "mensal", "anual"].includes(type) && end < now) {
    // Skip old occurrences arithmetically, instead of stopping after a fixed
    // number of iterations (old weekly events may still be current).
    if (type === "semanal") {
      const weeks = Math.max(0, Math.floor((now - end) / (7 * 86400000)));
      date.setDate(date.getDate() + weeks * 7);
      end.setDate(end.getDate() + weeks * 7);
    } else if (type === "mensal") {
      const months = Math.max(0, (now.getFullYear() - end.getFullYear()) * 12 + now.getMonth() - end.getMonth() - 1);
      date.setMonth(date.getMonth() + months);
      end.setMonth(end.getMonth() + months);
    } else {
      const years = Math.max(0, now.getFullYear() - end.getFullYear() - 1);
      date.setFullYear(date.getFullYear() + years);
      end.setFullYear(end.getFullYear() + years);
    }
    let guard = 0;
    while (end < now && guard++ < 14) {
      if (type === "semanal") { date.setDate(date.getDate() + 7); end.setDate(end.getDate() + 7); }
      else if (type === "mensal") { date.setMonth(date.getMonth() + 1); end.setMonth(end.getMonth() + 1); }
      else { date.setFullYear(date.getFullYear() + 1); end.setFullYear(end.getFullYear() + 1); }
    }
  }
  const until = event.recorrencia_ate ? new Date(event.recorrencia_ate) : null;
  if ((until && date > until) || end < now) return null;
  return { ...event, nextDate: date, isOngoing: date <= now && end >= now };
}

function agendaMarkup(simpleRows, recurringRows, editionRows) {
  const now = new Date();
  const uniqueEvents = new Map([...simpleRows, ...recurringRows].map(item => [item.id, item]));
  const simple = [...uniqueEvents.values()].map(item => occurrence(item, now)).filter(Boolean);
  const editions = editionRows.map(item => {
    const parent = item.eventos_principais;
    return occurrence({ ...item, titulo: item.titulo || parent?.nome || "Evento",
      eventHref: parent?.slug ? `/eventos/${encodeURIComponent(parent.slug)}/${encodeURIComponent(item.ano || item.slug || "")}` : "/eventos/" }, now);
  }).filter(Boolean);
  const items = [...simple, ...editions].sort((a, b) => Number(b.isOngoing) - Number(a.isOngoing) || a.nextDate - b.nextDate).slice(0, 3);
  if (!items.length) return '<p class="loading">Nenhum evento futuro publicado no momento.</p>';
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "America/Sao_Paulo" });
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" });
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return items.map(item => `<a class="agenda-item" href="${item.eventHref || `/eventos/agenda/${route(item)}`}"><time class="agenda-date" datetime="${esc(item.nextDate.toISOString())}"><strong>${day.format(item.nextDate)}</strong><span>${esc(month.format(item.nextDate).replace(".", ""))}</span></time><div><h3>${esc(item.titulo)}</h3><p>${esc(item.local || "Urânia")} · ${item.isOngoing ? "Em andamento" : esc(time.format(item.nextDate))}</p></div><b aria-hidden="true">→</b></a>`).join("");
}

async function renderPrimaryContent(html) {
  const now = new Date().toISOString();
  const requests = {
    news: fetchPublicRows("noticias", { select: "id,titulo,slug,imagem_url,categoria_nome", status: "eq.publicado", publicado_em: `lte.${now}`, order: "destaque.desc,publicado_em.desc", limit: "8" }),
    businesses: fetchPublicRows("guia_comercial", { select: "id,nome,slug,categoria_nome,descricao,imagem_url,recomendado", status: "eq.publicado", order: "recomendado.desc,nome.asc", limit: "6" }),
    tourism: fetchPublicRows("turismo", { select: "id,nome,slug,imagem_url,destaque,categoria_nome", status: "eq.publicado", order: "destaque.desc,nome.asc", limit: "5" }),
    simpleEvents: fetchPublicRows("eventos", { select: "id,titulo,slug,local,data_inicio,data_fim,recorrencia_tipo,recorrencia_ate", status: "eq.publicado", order: "data_inicio.desc", limit: "80" })
      .catch(() => fetchPublicRows("eventos", { select: "id,titulo,slug,local,data_inicio,data_fim", status: "eq.publicado", order: "data_inicio.desc", limit: "80" })),
    recurringEvents: fetchPublicRows("eventos", { select: "id,titulo,slug,local,data_inicio,data_fim,recorrencia_tipo,recorrencia_ate", status: "eq.publicado", recorrencia_tipo: "in.(semanal,mensal,anual)", order: "data_inicio.desc", limit: "40" }, 1500),
    editions: fetchPublicRows("eventos_edicoes", { select: "id,titulo,slug,ano,data_inicio,data_fim,local,status,eventos_principais!inner(nome,slug,ativo)", status: "in.(anunciado,confirmado,acontecendo)", "eventos_principais.ativo": "eq.true", order: "data_inicio.desc", limit: "40" }, 1500)
  };
  const entries = await Promise.all(Object.entries(requests).map(async ([key, request]) => {
    try { return [key, await request]; }
    catch (error) { console.error(`home SSR ${key}:`, error); return [key, null]; }
  }));
  const data = Object.fromEntries(entries);
  let rendered = 0;
  if (data.news) { html = replaceHomeSection(html, "home-news", newsMarkup(data.news)); rendered++; }
  if (data.businesses) { html = replaceHomeSection(html, "home-businesses", businessMarkup(data.businesses)); rendered++; }
  if (data.tourism) {
    html = replaceHomeSection(html, "home-tourism", tourismMarkup(data.tourism));
    const visual = data.tourism.find(item => safeImage(item.imagem_url));
    if (visual) html = html.replace(/(<img id="tourism-image" src=")[^"]*(" alt=")[^"]*(")/, (_, open, middle, close) => `${open}${esc(safeImage(visual.imagem_url))}${middle}${esc(visual.nome || "Lugar para conhecer em Urânia")}${close}`);
    rendered++;
  }
  if (data.simpleEvents) {
    const agendaState = data.recurringEvents && data.editions ? "true" : "partial";
    html = replaceHomeSection(html, "home-agenda", agendaMarkup(data.simpleEvents, data.recurringEvents || [], data.editions || []), agendaState);
    rendered++;
  }
  return { html, complete: rendered === 4, cacheable: rendered === 4 && !!data.recurringEvents && !!data.editions, rendered };
}

function meta(html, key, value, property = false) {
  if (!value) return html;
  const attr = property ? "property" : "name";
  const pattern = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${esc(value)}">`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `${tag}</head>`);
}

function replaceStructuredData(html, graph) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  const script = `<script type="application/ld+json">${json}</script>`;
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i;
  return pattern.test(html) ? html.replace(pattern, script) : html.replace("</head>", `${script}</head>`);
}

module.exports = async (req, res) => {
  try {
    if (req.method === "POST" && req.query?.acao === "public-submission") {
      const result = await handlePublicSubmission(req);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(result.status).send(JSON.stringify(result.body));
    }
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).send("Método não permitido");
    }

    const html = await readFile(path.join(process.cwd(), "index.html"), "utf8");
    // Main content and optional SEO configuration are fetched concurrently.
    // A slow configuration read cannot delay the public records.
    const contentPromise = renderPrimaryContent(html);
    const configPromise = fetchPublicRows("configuracoes_site", {
      select: "chave,valor",
      chave: "in.(seo_titulo_padrao,seo_descricao_padrao,imagem_compartilhamento,dominio_principal,nome_site)"
    }, 1500).catch(error => { console.warn("home SSR config:", error); return []; });
    const content = await contentPromise;
    const rows = await Promise.race([configPromise, new Promise(resolve => setTimeout(() => resolve([]), 150))]);
    const config = Object.fromEntries(rows.map(item => [item.chave, item.valor || ""]));
    const domain = /^https:\/\//.test(config.dominio_principal || "")
      ? config.dominio_principal.replace(/\/$/, "")
      : "https://euamourania.com.br";
    const title = config.seo_titulo_padrao || "Urânia SP: notícias, guia comercial e turismo | Eu Amo Urânia";
    const description = config.seo_descricao_padrao || "Portal local de Urânia SP com notícias, guia comercial, turismo, eventos, história da cidade e informações úteis para moradores e visitantes.";
    const image = absolute("/assets/AD3A1763-min%20(1).jpg", domain);
    const logo = absolute("/assets/1505 - Urania - Logo Horizontal - 1.png", domain);
    const graph = [
      {
        "@type": "Organization",
        "@id": `${domain}/#organization`,
        "name": "Eu Amo Urânia",
        "alternateName": ["Portal Eu Amo Urânia", "Eu Amo Urania"],
        "url": `${domain}/`,
        "logo": {
          "@type": "ImageObject",
          "url": logo,
          "contentUrl": logo
        },
        "sameAs": [
          "https://www.instagram.com/euamourania/",
          "https://www.facebook.com/euamourania"
        ],
        "knowsAbout": [
          "Urânia SP",
          "notícias de Urânia",
          "guia comercial de Urânia",
          "turismo em Urânia",
          "eventos em Urânia",
          "história de Urânia"
        ],
        "areaServed": { "@id": `${domain}/urania/#place` }
      },
      {
        "@type": "WebSite",
        "@id": `${domain}/#website`,
        "name": "Eu Amo Urânia",
        "alternateName": ["Portal de Urânia", "Notícias de Urânia", "Urânia SP", "Eu Amo Urania"],
        "url": `${domain}/`,
        "publisher": { "@id": `${domain}/#organization` },
        "about": { "@id": `${domain}/urania/#place` },
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${domain}/buscar.html?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        },
        "inLanguage": "pt-BR"
      },
      {
        "@type": "WebPage",
        "@id": `${domain}/#webpage`,
        "url": `${domain}/`,
        "name": title,
        "description": description,
        "isPartOf": { "@id": `${domain}/#website` },
        "about": { "@id": `${domain}/urania/#place` },
        "primaryImageOfPage": {
          "@type": "ImageObject",
          "url": image
        },
        "inLanguage": "pt-BR"
      },
      {
        "@type": "ItemList",
        "@id": `${domain}/#main-sections`,
        "name": "Principais áreas do Eu Amo Urânia",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Urânia SP", "url": `${domain}/urania/` },
          { "@type": "ListItem", "position": 2, "name": "Notícias de Urânia", "url": `${domain}/news/` },
          { "@type": "ListItem", "position": 3, "name": "Guia Comercial de Urânia", "url": `${domain}/guia.html` },
          { "@type": "ListItem", "position": 4, "name": "Turismo em Urânia", "url": `${domain}/turismo.html` },
          { "@type": "ListItem", "position": 5, "name": "Eventos em Urânia", "url": `${domain}/eventos/` },
          { "@type": "ListItem", "position": 6, "name": "Melhores de Urânia", "url": `${domain}/melhores-de-urania/` },
          { "@type": "ListItem", "position": 7, "name": "Iniciativas da Comunidade", "url": `${domain}/iniciativas/` },
          { "@type": "ListItem", "position": 8, "name": "Aplicativo Viva Urânia", "url": `${domain}/app` }
        ]
      },
      {
        "@type": "City",
        "@id": `${domain}/urania/#place`,
        "name": "Urânia",
        "alternateName": ["Urânia SP", "Urania", "Cidade de Urânia", "Município de Urânia"],
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Urânia",
          "addressRegion": "SP",
          "addressCountry": "BR"
        },
        "url": `${domain}/urania/`
      }
    ];

    let output = content.html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
    output = meta(output, "description", description);
    output = meta(output, "keywords", "Urânia, Urânia SP, Urania, Eu Amo Urânia, notícias de Urânia, guia comercial de Urânia, turismo em Urânia, eventos em Urânia, história de Urânia");
    output = meta(output, "og:site_name", "Eu Amo Urânia", true);
    output = meta(output, "og:title", title, true);
    output = meta(output, "og:description", description, true);
    output = meta(output, "og:image", image, true);
    output = meta(output, "og:url", domain + "/", true);
    output = meta(output, "twitter:title", title);
    output = meta(output, "twitter:description", description);
    output = meta(output, "twitter:image", image);
    const canonical = `<link rel="canonical" href="${esc(domain)}/">`;
    const existingCanonical = /<link[^>]+rel=["']canonical["'][^>]*>/i;
    output = existingCanonical.test(output)
      ? output.replace(existingCanonical, canonical)
      : output.replace("</head>", `${canonical}</head>`);
    output = replaceStructuredData(output, graph);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", content.cacheable ? "public, s-maxage=60, stale-while-revalidate=60" : "no-store");
    return res.status(content.complete ? 200 : 503).send(output);
  } catch (error) {
    console.error("home:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).send("Não foi possível carregar a página inicial");
  }
};
