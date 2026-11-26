const { readFileSync } = require("node:fs");
const path = require("node:path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DOMAIN = "https://euamourania.com.br";
const DEFAULT_IMAGE = `${DOMAIN}/assets/compartilhamento-logo.png`;
const FIELDS = "id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em";
const template = readFileSync(path.resolve(__dirname, "../categorias/index.html"), "utf8");

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  .replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const plain = (value = "") => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const slugify = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
const newsUrl = slug => `/noticias/${encodeURIComponent(slug)}`;
const categoryUrl = category => `/news/${encodeURIComponent(slugify(category || "urania"))}/`;
const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo"
  }).format(date);
};
const safeImage = (value, options = {}) => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) {
    if (raw.includes("/storage/v1/object/public/")) {
      try {
        const url = new URL(raw);
        url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
        if (options.width) url.searchParams.set("width", String(options.width));
        if (options.height) url.searchParams.set("height", String(options.height));
        if (options.quality) url.searchParams.set("quality", String(options.quality));
        if (options.width || options.height || options.resize) url.searchParams.set("resize", options.resize || "cover");
        return esc(url.href);
      } catch {}
    }
    return esc(raw);
  }
  if (/^\/?assets\//i.test(raw)) return esc(raw.startsWith("/") ? raw : `/${raw}`);
  return "";
};

function imageMarkup(item, className, priority = false) {
  const opts = priority ? { width: 920, height: 620, quality: 78 } : { width: 640, height: 430, quality: 76 };
  const image = safeImage(item.imagem_url, opts);
  if (!image) return `<a class="${className} category-card-placeholder" href="${newsUrl(item.slug)}"><span>Eu Amo Urânia</span></a>`;
  return `<a class="${className}" href="${newsUrl(item.slug)}"><img src="${image}" alt="${esc(item.titulo)}" width="${opts.width}" height="${opts.height}" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a>`;
}

function featuredCard(item, categoryName) {
  const text = (item.resumo || plain(item.conteudo_html || "")).trim();
  const date = formatDate(item.publicado_em);
  return `<article class="category-featured-card">${imageMarkup(item, "category-featured-media", true)}<div class="category-featured-copy"><p class="category-card-meta"><span>${esc(item.categoria_nome || categoryName)}</span><time datetime="${esc(item.publicado_em)}">${esc(date)}</time></p><h2><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h2>${text ? `<p>${esc(text)}</p>` : ""}<a class="category-read-link" href="${newsUrl(item.slug)}">Ler notícia <span>→</span></a></div></article>`;
}

function newsCard(item, categoryName) {
  const text = (item.resumo || plain(item.conteudo_html || "")).trim();
  const date = formatDate(item.publicado_em);
  return `<article class="category-card">${imageMarkup(item, "category-card-media")}<div class="category-card-body"><p class="category-card-meta"><span>${esc(item.categoria_nome || categoryName)}</span><time datetime="${esc(item.publicado_em)}">${esc(date)}</time></p><h3><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h3>${text ? `<p>${esc(text)}</p>` : ""}</div></article>`;
}

function replaceMeta(html, { title, description, canonical, image, structured }) {
  const tags = [
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="pt_BR">',
    '<meta property="og:site_name" content="Eu Amo Urânia">',
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:secure_url" content="${esc(image)}">`,
    `<meta property="og:image:alt" content="${esc(title)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    `<script id="category-structured-data" type="application/ld+json">${safeJson(structured)}</script>`
  ].join("");
  return html
    .replace(/<meta\s+(?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>${tags}`);
}

function composeCategoryHtml({ slug, categoryName, description, categoryNews, categoriesNav }) {
  const canonical = `${DOMAIN}/news/${encodeURIComponent(slug)}/`;
  const title = `${categoryName} — Notícias de Urânia | Eu Amo Urânia`;
  const featured = categoryNews[0] || null;
  const listItems = categoryNews.slice(1);
  const ogImage = featured?.imagem_url && /^https:\/\//i.test(featured.imagem_url) ? featured.imagem_url : DEFAULT_IMAGE;
  const structured = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        isPartOf: { "@id": `${DOMAIN}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: categoryNews.length,
          itemListElement: categoryNews.slice(0, 15).map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            url: `${DOMAIN}/noticias/${encodeURIComponent(item.slug)}`,
            name: item.titulo
          }))
        },
        inLanguage: "pt-BR"
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${DOMAIN}/` },
          { "@type": "ListItem", position: 2, name: "Notícias", item: `${DOMAIN}/news/` },
          { "@type": "ListItem", position: 3, name: categoryName, item: canonical }
        ]
      }
    ]
  };

  const navMarkup = [
    '<a href="/news/">Todas</a>',
    ...categoriesNav.map(category => {
      const catSlug = slugify(category);
      const active = catSlug === slug;
      return `<a class="${active ? "active" : ""}" href="${categoryUrl(category)}"${active ? ' aria-current="page"' : ""}>${esc(category)}</a>`;
    })
  ].join("");

  const updatedLabel = featured?.publicado_em ? formatDate(featured.publicado_em) : "—";
  const countLabel = categoryNews.length === 1 ? "1 publicação encontrada" : `${categoryNews.length} publicações encontradas`;
  const statusText = !categoryNews.length
    ? "Ainda não há notícias nesta editoria."
    : !listItems.length
      ? "Esta editoria ainda tem apenas uma publicação."
      : "";

  let html = replaceMeta(template, { title, description, canonical, image: ogImage, structured });
  html = html
    .replace('action="/preview/busca/"', 'action="/buscar.html"')
    .replace('<h1 id="category-title">Carregando…</h1>', `<h1 id="category-title">${esc(categoryName)} — Notícias de Urânia</h1>`)
    .replace('<p id="category-description">Notícias organizadas por assunto para facilitar sua leitura.</p>', `<p id="category-description">${esc(description)}</p>`)
    .replace('<strong id="category-total">—</strong>', `<strong id="category-total">${categoryNews.length}</strong>`)
    .replace('<strong id="category-updated">—</strong>', `<strong id="category-updated">${esc(updatedLabel)}</strong>`)
    .replace('<div class="category-shell" id="category-nav"></div>', `<div class="category-shell" id="category-nav" data-server-rendered="true">${navMarkup}</div>`)
    .replace('<div class="category-shell" id="category-featured"><p class="category-loading">Organizando esta editoria…</p></div>', `<div class="category-shell" id="category-featured" data-server-rendered="true">${featured ? featuredCard(featured, categoryName) : ""}</div>`)
    .replace('<h2 id="category-feed-title">Últimas notícias.</h2>', `<h2 id="category-feed-title">Mais sobre ${esc(categoryName)}.</h2>`)
    .replace('<p id="category-count">Carregando notícias…</p>', `<p id="category-count">${esc(countLabel)}</p>`)
    .replace('placeholder="Buscar nesta editoria…"', `placeholder="Buscar em ${esc(categoryName)}"`)
    .replace('<p id="category-status" role="status">Carregando notícias…</p>', `<p id="category-status" role="status"${statusText ? "" : " hidden"}>${esc(statusText)}</p>`)
    .replace('<div id="category-news"></div>', `<div id="category-news" data-server-rendered="true">${listItems.length ? `<div class="category-news-grid">${listItems.map(item => newsCard(item, categoryName)).join("")}</div>` : ""}</div>`);

  const bootstrap = {
    slug,
    categoryName,
    description,
    categoriesNav,
    items: categoryNews.map(item => ({
      id: item.id,
      titulo: item.titulo,
      slug: item.slug,
      resumo: item.resumo,
      imagem_url: item.imagem_url,
      categoria_nome: item.categoria_nome,
      publicado_em: item.publicado_em
    }))
  };
  return html.replace("</head>", `<script id="initial-category-data" type="application/json">${safeJson(bootstrap)}</script></head>`);
}

async function fetchJson(endpoint, timeout = 5000) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error(`Falha ao consultar ${endpoint}: HTTP ${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

async function renderNewsCategory(req, res) {
  const rawSlug = String(req.query.categoria || req.query.slug || "").trim().toLowerCase();
  const slug = rawSlug.replace(/[^a-z0-9-]/g, "");
  if (!slug) return res.status(404).send("Editoria não encontrada");

  try {
    const now = encodeURIComponent(new Date().toISOString());
    const [news, categories] = await Promise.all([
      fetchJson(`noticias?select=${FIELDS}&status=eq.publicado&publicado_em=lte.${now}&order=publicado_em.desc&limit=250`),
      fetchJson("categorias?select=nome,slug,descricao,tipo,status,ordem&status=eq.ativo&order=ordem.asc&limit=100").catch(() => [])
    ]);

    const meta = categories.find(item => slugify(item.slug || item.nome || "") === slug || slugify(item.nome || "") === slug);
    const matchingNewsItem = news.find(item => slugify(item.categoria_nome || "") === slug);
    const categoryName = meta?.nome || matchingNewsItem?.categoria_nome || "";
    if (!categoryName) return res.status(404).send("Editoria não encontrada");

    const fromTable = categories.filter(item => slugify(item.tipo || "") === "noticias").map(item => item.nome).filter(Boolean);
    const categoriesNav = [...new Set([...fromTable, ...news.map(item => item.categoria_nome).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    const categoryNews = news.filter(item => slugify(item.categoria_nome || "") === slugify(categoryName));
    const description = (meta?.descricao || `Notícias de ${categoryName} em Urânia, com informação local e atualização da redação.`).slice(0, 160);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(200).send(composeCategoryHtml({ slug, categoryName, description, categoryNews, categoriesNav }));
  } catch (error) {
    console.error("[news-category-ssr]:", error);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send(template.replace('action="/preview/busca/"', 'action="/buscar.html"'));
  }
}

module.exports = { renderNewsCategory, composeCategoryHtml };
