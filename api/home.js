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

    const response = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?select=chave,valor&chave=in.(seo_titulo_padrao,seo_descricao_padrao,imagem_compartilhamento,dominio_principal,nome_site)`, {
      headers: { apikey: KEY }
    });
    const rows = response.ok ? await response.json() : [];
    const config = Object.fromEntries(rows.map(item => [item.chave, item.valor || ""]));
    const domain = /^https:\/\//.test(config.dominio_principal || "")
      ? config.dominio_principal.replace(/\/$/, "")
      : "https://euamourania.com.br";
    const title = config.seo_titulo_padrao || "Urânia SP: notícias, guia comercial e turismo | Eu Amo Urânia";
    const description = config.seo_descricao_padrao || "Portal local de Urânia SP com notícias, guia comercial, turismo, eventos, história da cidade e informações úteis para moradores e visitantes.";
    const image = absolute(config.imagem_compartilhamento || "/assets/compartilhamento-logo.png", domain);
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

    let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
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
    output = output.replace(/<link[^>]+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(domain)}/">`);
    output = replaceStructuredData(output, graph);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(output);
  } catch (error) {
    console.error("home:", error);
    return res.status(500).send("Não foi possível carregar a página inicial");
  }
};
