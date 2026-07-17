const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DEFAULT_DOMAIN = "https://euamourania.com.br";
const DEFAULT_LOGO = "/assets/1505%20-%20Urania%20-%20Logo%20Horizontal%20-%201.png";
const DEFAULT_FAVICON = "/favicon.ico";

const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

const plain = (value = "") => String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const validDomain = value => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.origin : DEFAULT_DOMAIN;
  } catch {
    return DEFAULT_DOMAIN;
  }
};

const absolute = (value, domain, fallback = DEFAULT_LOGO) => {
  try {
    return new URL(value || fallback, `${domain}/`).href;
  } catch {
    return new URL(fallback, `${domain}/`).href;
  }
};

const formatDate = value => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo"
    }).format(new Date(value));
  } catch {
    return "";
  }
};

async function getConfig() {
  const keys = "nome_site,seo_publicador,seo_logo,dominio_principal,imagem_compartilhamento,imagem_padrao_noticia,imagem_padrao_guia,imagem_padrao_turismo,logo_principal,favicon";
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/configuracoes_site?select=chave,valor&chave=in.(${keys})`,
      { headers: { apikey: SUPABASE_KEY } }
    );
    if (!response.ok) return {};
    return Object.fromEntries((await response.json()).map(item => [item.chave, item.valor]));
  } catch {
    return {};
  }
}

function renderHeader({ siteName, logo, current }) {
  const nav = [
    ["Início", "/index.html", "inicio"],
    ["Guia", "/guia.html", "guia"],
    ["Turismo", "/turismo.html", "turismo"],
    ["Notícias", "/news/", "noticias"],
    ["Quem somos", "/quem-somos.html", "quem-somos"]
  ].map(([label, href, key]) => `<li><a href="${href}"${current === key ? ' aria-current="page"' : ""}>${label}</a></li>`).join("");

  return `<header class="site-header"><div class="container header-content"><a class="brand" href="/index.html"><img src="${esc(logo)}" alt="${esc(siteName)}" width="190" height="56"></a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="menu-principal"><span class="menu-icon" aria-hidden="true"></span><span>Menu</span></button><nav class="main-nav" id="menu-principal" aria-label="Navegação principal"><ul>${nav}</ul></nav></div></header>`;
}

function renderFooter({ siteName, logo }) {
  return `<footer class="site-footer"><div class="container footer-grid"><div><img src="${esc(logo)}" alt="${esc(siteName)}" class="footer-logo" width="170" height="50"><p>Informação, turismo e comunidade.</p></div><nav><a href="mailto:euamourania@gmail.com">Contato</a><a href="/termos-de-servico.html">Termos</a><a href="/politica-de-privacidade.html">Privacidade</a></nav></div><div class="container footer-bottom"><p>&copy; <span id="year"></span> ${esc(siteName)}.</p></div></footer>`;
}

async function renderGuia(req, res, slug) {
  const [response, config] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/guia_comercial?slug=eq.${encodeURIComponent(slug)}&status=eq.publicado&select=*&limit=1`,
      { headers: { apikey: SUPABASE_KEY } }
    ),
    getConfig()
  ]);

  const rows = await response.json().catch(() => []);
  const item = rows?.[0];
  if (!response.ok || !item) return res.status(404).send("Empresa não encontrada");

  const domain = validDomain(config.dominio_principal || DEFAULT_DOMAIN);
  const siteName = config.nome_site || "Eu Amo Urânia";
  const logo = absolute(config.seo_logo || config.logo_principal, domain);
  const favicon = absolute(DEFAULT_FAVICON, domain);
  const canonical = `${domain}/guia/${encodeURIComponent(item.slug)}`;
  const description = (item.seo_descricao || item.descricao || `${item.nome} no Guia Eu Amo Urânia.`).slice(0, 160);
  const image = absolute(item.imagem_url || config.imagem_padrao_guia || config.imagem_compartilhamento, domain);
  const title = `${item.nome} | Guia Eu Amo Urânia`;
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${canonical}#localbusiness`,
        name: item.nome,
        description,
        image,
        url: canonical,
        telephone: item.whatsapp || item.telefone || undefined,
        address: item.endereco || undefined,
        sameAs: [item.instagram, item.facebook, item.site].filter(Boolean),
        areaServed: "Urânia, SP",
        inLanguage: "pt-BR"
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${domain}/` },
          { "@type": "ListItem", position: 2, name: "Guia", item: `${domain}/guia.html` },
          { "@type": "ListItem", position: 3, name: item.nome, item: canonical }
        ]
      }
    ]
  }).replace(/</g, "\\u003c");
  const initialGuide = JSON.stringify(item).replace(/</g, "\\u003c");
  const serverContent = `<article class="guide-business" data-guide-id="${esc(item.id)}"><a class="guide-business-back" href="/guia.html"><span aria-hidden="true">←</span> Voltar ao Guia</a><section class="guide-business-hero"><div class="guide-business-media"><img src="${esc(image)}" alt="${esc(item.nome)}" decoding="async" fetchpriority="high"></div><div class="guide-business-intro"><div class="guide-business-badges"><span>${esc(item.categoria_nome || "Comércio local")}</span>${item.recomendado ? "<strong>★ Recomendado</strong>" : ""}</div><p class="eyebrow">Guia comercial de Urânia</p><h1>${esc(item.nome)}</h1><p class="guide-business-summary">${esc(item.descricao || description)}</p></div></section></article>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="business.business"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="${esc(siteName)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta property="og:image:alt" content="${esc(item.nome)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(item.nome)}"><meta name="theme-color" content="#0b4f6c"><script id="guide-structured-data" type="application/ld+json">${structured}</script><script id="initial-guide-data" type="application/json">${initialGuide}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/inner-pages.css"><link rel="stylesheet" href="/assets/css/turismo-details-page.css"><link rel="stylesheet" href="/assets/css/guia-details-page.css"><link rel="icon" href="${esc(favicon)}" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><link rel="preload" as="image" href="${esc(image)}" fetchpriority="high"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></head><body class="inner-page tourism-detail-page guide-detail-page"><a class="skip-link" href="#guia-details">Pular para o conteúdo</a>${renderHeader({ siteName, logo, current: "guia" })}<main id="guia-details" class="tourism-detail-main" aria-live="polite">${serverContent}</main>${renderFooter({ siteName, logo })}<script src="/script.js"></script><script type="module" src="/assets/js/pages/guia-details-page.js"></script></body></html>`);
}

async function renderTurismo(req, res, slug) {
  const [response, config] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/turismo?slug=eq.${encodeURIComponent(slug)}&status=eq.publicado&select=*&limit=1`,
      { headers: { apikey: SUPABASE_KEY } }
    ),
    getConfig()
  ]);

  const rows = await response.json().catch(() => []);
  const item = rows?.[0];
  if (!response.ok || !item) return res.status(404).send("Ponto turístico não encontrado");

  const domain = validDomain(config.dominio_principal || DEFAULT_DOMAIN);
  const siteName = config.nome_site || "Eu Amo Urânia";
  const logo = absolute(config.seo_logo || config.logo_principal, domain);
  const favicon = absolute(DEFAULT_FAVICON, domain);
  const canonical = `${domain}/turismo/${encodeURIComponent(item.slug)}`;
  const articleText = plain(item.conteudo_html) || item.descricao || "";
  const description = (item.seo_descricao || item.descricao || articleText || `${item.nome} em Urânia.`).slice(0, 160);
  const image = absolute(item.imagem_url || config.imagem_padrao_turismo || config.imagem_compartilhamento, domain);
  const title = `${item.seo_titulo || item.nome} | Turismo em Urânia`;
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TouristAttraction",
        "@id": `${canonical}#touristattraction`,
        name: item.nome,
        description,
        image,
        url: canonical,
        address: item.endereco || undefined,
        openingHours: item.horario || undefined,
        telephone: item.whatsapp || undefined,
        touristType: "Visitantes de Urânia e região",
        isAccessibleForFree: true,
        inLanguage: "pt-BR"
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        name: item.nome,
        description,
        url: canonical,
        primaryImageOfPage: { "@type": "ImageObject", url: image },
        about: { "@id": `${canonical}#touristattraction` },
        publisher: {
          "@type": "Organization",
          name: siteName,
          url: domain,
          logo: { "@type": "ImageObject", url: logo }
        },
        inLanguage: "pt-BR"
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${domain}/` },
          { "@type": "ListItem", position: 2, name: "Turismo", item: `${domain}/turismo.html` },
          { "@type": "ListItem", position: 3, name: item.nome, item: canonical }
        ]
      }
    ]
  }).replace(/</g, "\\u003c");
  const initialTourism = JSON.stringify(item).replace(/</g, "\\u003c");
  const serverContent = `<article class="tourism-detail" data-tourism-id="${esc(item.id)}" data-server-rendered="true"><a class="tourism-detail-back" href="/turismo.html"><span aria-hidden="true">←</span> Voltar aos lugares</a><section class="tourism-detail-hero"><figure><img src="${esc(image)}" alt="${esc(item.nome)}" decoding="async" fetchpriority="high"></figure><header class="tourism-detail-header"><p class="eyebrow">Experiência em Urânia</p><h1>${esc(item.nome)}</h1>${description ? `<p class="tourism-detail-summary">${esc(description)}</p>` : ""}<span class="tourism-detail-label">Turismo local</span></header></section><div class="tourism-detail-layout"><section class="tourism-detail-copy" aria-labelledby="tourism-about-title"><p class="eyebrow">Sobre a experiência</p><h2 id="tourism-about-title">Conheça este lugar</h2><div class="article-copy">${articleText ? `<p>${esc(articleText)}</p>` : ""}</div></section><aside class="tourism-planner" aria-labelledby="tourism-planner-title"><p class="eyebrow">Informações úteis</p><h2 id="tourism-planner-title">Planeje sua visita</h2><div class="tourism-detail-facts">${item.endereco ? `<div><p><small>Endereço</small>${esc(item.endereco)}</p></div>` : ""}${item.horario ? `<div><p><small>Horário</small>${esc(item.horario)}</p></div>` : ""}</div></aside></div></article>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="place"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="${esc(siteName)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta property="og:image:alt" content="${esc(item.nome)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(item.nome)}"><meta name="theme-color" content="#0b4f6c"><script id="tourism-structured-data" type="application/ld+json">${structured}</script><script id="initial-tourism-data" type="application/json">${initialTourism}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/inner-pages.css"><link rel="stylesheet" href="/assets/css/turismo-details-page.css"><link rel="icon" href="${esc(favicon)}" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><link rel="preload" as="image" href="${esc(image)}" fetchpriority="high"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></head><body class="inner-page tourism-detail-page"><a class="skip-link" href="#turismo-details">Pular para o conteúdo</a>${renderHeader({ siteName, logo, current: "turismo" })}<main id="turismo-details" class="tourism-detail-main" aria-live="polite">${serverContent}</main>${renderFooter({ siteName, logo })}<script src="/script.js"></script><script type="module" src="/assets/js/pages/turismo-details-page.js"></script></body></html>`);
}

async function renderNoticia(req, res, slug) {
  const now = encodeURIComponent(new Date().toISOString());
  const [response, config] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/noticias?slug=eq.${encodeURIComponent(slug)}&status=eq.publicado&publicado_em=lte.${now}&select=*&limit=1`,
      { headers: { apikey: SUPABASE_KEY } }
    ),
    getConfig()
  ]);
  const rows = await response.json();
  const noticia = rows?.[0];
  if (!response.ok || !noticia) return res.status(404).send("Notícia não encontrada");

  const domain = validDomain(config.dominio_principal || DEFAULT_DOMAIN);
  const siteName = config.nome_site || "Eu Amo Urânia";
  const publisher = config.seo_publicador || siteName;
  const logo = absolute(config.seo_logo || config.logo_principal, domain);
  const favicon = absolute(DEFAULT_FAVICON, domain);
  const canonical = `${domain}/noticias/${encodeURIComponent(noticia.slug)}`;
  const articleText = plain(noticia.conteudo_html) || noticia.resumo || "";
  const description = (noticia.seo_descricao || noticia.resumo || articleText).slice(0, 160);
  const image = absolute(
    noticia.seo_imagem || noticia.imagem_url || config.imagem_padrao_noticia || config.imagem_compartilhamento,
    domain
  );
  const title = `${noticia.seo_titulo || noticia.titulo} | ${siteName}`;
  const authorName = noticia.autor || "Redação Eu Amo Urânia";
  const structured = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${canonical}#newsarticle`,
        headline: noticia.titulo,
        description,
        image: [image],
        datePublished: noticia.publicado_em,
        dateModified: noticia.atualizado_em || noticia.publicado_em,
        author: {
          "@type": "Organization",
          name: authorName,
          url: `${domain}/quem-somos.html`
        },
        publisher: {
          "@type": "Organization",
          name: publisher,
          url: domain,
          logo: { "@type": "ImageObject", url: logo }
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        url: canonical,
        articleSection: noticia.categoria_nome || "Notícias",
        articleBody: articleText || undefined,
        isAccessibleForFree: true,
        inLanguage: "pt-BR"
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${domain}/` },
          { "@type": "ListItem", position: 2, name: "Notícias", item: `${domain}/news/` },
          { "@type": "ListItem", position: 3, name: noticia.titulo, item: canonical }
        ]
      }
    ]
  }).replace(/</g, "\\u003c");
  const initialNews = JSON.stringify(noticia).replace(/</g, "\\u003c");
  const serverArticle = `<article class="news-detail-container" data-server-rendered="true"><header class="article-header"><p class="eyebrow">${esc(noticia.categoria_nome || "Notícias de Urânia")}</p><h1>${esc(noticia.titulo)}</h1>${noticia.subtitulo ? `<p class="article-subtitle">${esc(noticia.subtitulo)}</p>` : ""}<p class="meta"><span>Por ${esc(noticia.autor || siteName)}</span><time datetime="${esc(noticia.publicado_em)}">${esc(formatDate(noticia.publicado_em))}</time></p></header>${noticia.imagem_url ? `<figure class="article-figure"><img src="${esc(absolute(noticia.imagem_url, domain))}" alt="${esc(noticia.legenda_imagem || noticia.titulo)}" class="main-image" decoding="async" fetchpriority="high">${noticia.legenda_imagem ? `<figcaption>${esc(noticia.legenda_imagem)}</figcaption>` : ""}</figure>` : ""}<div class="article-copy"><p>${esc(articleText)}</p></div></article>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400");
  return res.status(200).send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:locale" content="pt_BR"><meta property="og:site_name" content="${esc(siteName)}"><meta property="og:title" content="${esc(noticia.titulo)}"><meta property="og:description" content="${esc(description)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(noticia.legenda_imagem || noticia.titulo)}"><meta property="og:url" content="${esc(canonical)}"><meta property="article:published_time" content="${esc(noticia.publicado_em)}"><meta property="article:modified_time" content="${esc(noticia.atualizado_em || noticia.publicado_em)}"><meta property="article:section" content="${esc(noticia.categoria_nome || "Notícias")}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(noticia.titulo)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(noticia.legenda_imagem || noticia.titulo)}"><meta name="theme-color" content="#0b4f6c"><script id="news-structured-data" type="application/ld+json">${structured}</script><script id="initial-news-data" type="application/json">${initialNews}</script><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/inner-pages.css"><link rel="stylesheet" href="/assets/css/public-polish.css"><link rel="icon" href="${esc(favicon)}" sizes="any"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><link rel="alternate" type="application/rss+xml" title="Notícias do Eu Amo Urânia" href="${domain}/rss.xml"><link rel="preload" as="image" href="${esc(image)}" fetchpriority="high"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"></head><body class="inner-page"><a class="skip-link" href="#newsDetails">Pular para a notícia</a>${renderHeader({ siteName, logo, current: "noticias" })}<main id="newsDetails" class="article-main" aria-live="polite">${serverArticle}</main>${renderFooter({ siteName, logo })}<script src="/script.js"></script><script type="module" src="/assets/js/pages/noticia-page.js"></script></body></html>`);
}

module.exports = async (req, res) => {
  const slug = String(req.query.slug || "").trim();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.status(404).send(req.query.tipo === "guia" ? "Empresa não encontrada" : "Notícia não encontrada");
  }

  try {
    if (req.query.tipo === "guia") return renderGuia(req, res, slug);
    if (req.query.tipo === "turismo") return renderTurismo(req, res, slug);
    return renderNoticia(req, res, slug);
  } catch (error) {
    console.error("noticia:", error);
    return res.status(500).send(req.query.tipo === "guia" ? "Não foi possível carregar a empresa" : "Não foi possível carregar a notícia");
  }
};
