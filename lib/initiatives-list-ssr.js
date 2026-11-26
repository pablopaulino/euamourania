const { readFileSync } = require("node:fs");
const path = require("node:path");

const DOMAIN = "https://euamourania.com.br";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const FIELDS = "id,titulo,slug,tipo,resumo,imagem_capa_url,destaque,atualizado_em";
const TEMPLATE_PATH = path.resolve(__dirname, "../iniciativas/index.html");
let cachedTemplate = null;

function getTemplate() {
  if (!cachedTemplate) cachedTemplate = readFileSync(TEMPLATE_PATH, "utf8");
  return cachedTemplate;
}

function fallbackHtml() {
  return getTemplate().replace('action="/preview/busca/"', 'action="/buscar.html"');
}

const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const clean = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const safeImage = value => /^(https?:\/\/|\/?assets\/)/i.test(String(value || "").trim())
  ? esc(String(value).trim().startsWith("assets/") ? `/${String(value).trim()}` : String(value).trim())
  : "/assets/compartilhamento-logo.png";

function summary(item) {
  const text = clean(item.resumo);
  return /Exibir na listagem|Salvar iniciativa|Formas de ajuda/i.test(text)
    ? "Conheça a história, o propósito e as formas de participar desta iniciativa."
    : text || "Conheça esta iniciativa divulgada pelo Eu Amo Urânia.";
}

function initiativeCard(item) {
  const href = `/iniciativas/${encodeURIComponent(item.slug)}`;
  const typeLabel = item.tipo === "projeto" ? "Projeto permanente" : "Ação da comunidade";
  return `<a class="initiative-card" href="${href}"><span class="initiative-card-media"><img src="${safeImage(item.imagem_capa_url)}" alt="${esc(item.titulo || "Iniciativa da comunidade")}" width="760" height="540" loading="lazy" decoding="async"><span class="initiative-card-type">${esc(typeLabel)}</span></span><span class="initiative-card-copy"><h3>${esc(item.titulo || "Iniciativa")}</h3><p>${esc(summary(item))}</p><span class="initiative-card-footer"><span>Conhecer iniciativa</span>${item.destaque ? "<em>Destaque</em>" : "<b>→</b>"}</span></span></a>`;
}

function composeInitiativesHtml(items) {
  const sorted = [...items].sort((a, b) => Number(Boolean(b.destaque)) - Number(Boolean(a.destaque))
    || String(b.atualizado_em || "").localeCompare(String(a.atualizado_em || "")));
  const lead = sorted[0] || null;
  let html = fallbackHtml();
  if (lead) {
    html = html
      .replace('href="#iniciativas-lista" aria-label="Conhecer iniciativas da comunidade"', `href="/iniciativas/${encodeURIComponent(lead.slug)}" aria-label="Conhecer iniciativas da comunidade"`)
      .replace('<img id="initiative-hero-image" src="/assets/compartilhamento-logo.png" alt="Iniciativas da comunidade"', `<img id="initiative-hero-image" src="${safeImage(lead.imagem_capa_url)}" alt="${esc(lead.titulo || "Iniciativa da comunidade")}"`)
      .replace('<strong id="initiative-hero-title">Comunidade que transforma</strong>', `<strong id="initiative-hero-title">${esc(lead.titulo || "Iniciativa da comunidade")}</strong>`);
  }
  const statusText = sorted.length
    ? `${sorted.length} ${sorted.length === 1 ? "iniciativa encontrada" : "iniciativas encontradas"}.`
    : "Nenhuma iniciativa encontrada.";
  const gridHtml = sorted.length ? sorted.map(initiativeCard).join("") : '<p class="initiative-empty">Nenhuma iniciativa encontrada.</p>';
  const canonical = `${DOMAIN}/iniciativas/`;
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: "Iniciativas | Eu Amo Urânia",
        description: "Projetos, campanhas e ações que mobilizam Urânia.",
        isPartOf: { "@id": `${DOMAIN}/#website` },
        mainEntity: { "@id": `${canonical}#itemlist` },
        inLanguage: "pt-BR"
      },
      {
        "@type": "ItemList",
        "@id": `${canonical}#itemlist`,
        name: "Iniciativas da comunidade em Urânia",
        numberOfItems: sorted.length,
        itemListElement: sorted.slice(0, 30).map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${DOMAIN}/iniciativas/${encodeURIComponent(item.slug)}`,
          name: item.titulo || "Iniciativa da comunidade"
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${DOMAIN}/` },
          { "@type": "ListItem", position: 2, name: "Iniciativas", item: canonical }
        ]
      }
    ]
  };
  const ldScript = `<script type="application/ld+json">${safeJson(structured)}</script>`;
  html = html
    .replace('<p id="initiatives-status" role="status">Carregando iniciativas…</p>', `<p id="initiatives-status" role="status">${esc(statusText)}</p>`)
    .replace('<div id="initiatives-grid" class="initiative-grid"></div>', `<div id="initiatives-grid" class="initiative-grid" data-server-rendered="true">${gridHtml}</div>`);
  html = /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i.test(html)
    ? html.replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/i, ldScript)
    : html.replace("</head>", `${ldScript}</head>`);
  return html.replace("</head>", `<script id="initial-initiatives-list-data" type="application/json">${safeJson(sorted)}</script></head>`);
}

async function renderInitiativesList(_req, res) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/iniciativas_comunitarias?select=${FIELDS}&status=eq.publicado&exibir_na_listagem=eq.true&order=destaque.desc,atualizado_em.desc`, {
      headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error("Resposta inválida de iniciativas_comunitarias");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(200).send(composeInitiativesHtml(items));
  } catch (error) {
    console.error("[initiatives-list-ssr]:", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(fallbackHtml());
  }
}

module.exports = { renderInitiativesList, composeInitiativesHtml };
