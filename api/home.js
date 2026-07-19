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
    const origin = `https://${req.headers.host}`;
    const page = await fetch(`${origin}/index.html`, { headers: { "x-site-meta": "1" } });
    const html = await page.text();
    if (!page.ok) throw new Error("Home estática indisponível");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/configuracoes_site?select=chave,valor&chave=in.(seo_titulo_padrao,seo_descricao_padrao,imagem_compartilhamento,dominio_principal,nome_site)`, {
      headers: { apikey: KEY }
    });
    const rows = response.ok ? await response.json() : [];
    const config = Object.fromEntries(rows.map(item => [item.chave, item.valor || ""]));
    const domain = /^https:\/\//.test(config.dominio_principal || "")
      ? config.dominio_principal.replace(/\/$/, "")
      : "https://euamourania.com.br";
    const title = config.seo_titulo_padrao || "Eu Amo Urânia | Guia, notícias e turismo";
    const description = config.seo_descricao_padrao || "Informação local, turismo, Guia, eventos e histórias de Urânia.";
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
        "areaServed": { "@id": `${domain}/urania/#place` }
      },
      {
        "@type": "WebSite",
        "@id": `${domain}/#website`,
        "name": "Eu Amo Urânia",
        "alternateName": ["Portal de Urânia", "Notícias de Urânia", "Urânia SP"],
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
        "@type": "City",
        "@id": `${domain}/urania/#place`,
        "name": "Urânia",
        "alternateName": ["Urânia SP", "Cidade de Urânia", "Município de Urânia"],
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
    output = meta(output, "keywords", "Urânia, Urânia SP, Eu Amo Urânia, notícias de Urânia, guia de Urânia, turismo em Urânia");
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
