const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const PRIZE_HOST = "melhores.euamourania.com.br";

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

function readStaticHtml(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function servePrizeHome(req, res) {
  let output = readStaticHtml("melhores-de-urania/index.html");
  const origin = `https://${PRIZE_HOST}`;
  output = output.replace(/https:\/\/euamourania\.com\.br\/melhores-de-urania\//g, `${origin}/`);
  output = output.replace(/<link[^>]+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${origin}/">`);
  output = meta(output, "og:url", `${origin}/`, true);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(output);
}

function requestHosts(req) {
  return [
    req.headers.host,
    req.headers["x-forwarded-host"],
    req.headers["x-vercel-forwarded-host"],
    req.headers["x-real-host"]
  ]
    .flatMap(value => String(value || "").split(","))
    .map(value => value.trim().split(":")[0].toLowerCase())
    .filter(Boolean);
}

module.exports = async (req, res) => {
  try {
    const hosts = requestHosts(req);
    if (hosts.includes(PRIZE_HOST)) return servePrizeHome(req, res);

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
    const image = absolute(config.imagem_compartilhamento || "/assets/AD3A1763-min (1).jpg", domain);

    let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(title)}</title>`);
    output = meta(output, "description", description);
    output = meta(output, "og:title", title, true);
    output = meta(output, "og:description", description, true);
    output = meta(output, "og:image", image, true);
    output = meta(output, "og:url", domain + "/", true);
    output = meta(output, "twitter:title", title);
    output = meta(output, "twitter:description", description);
    output = meta(output, "twitter:image", image);
    output = output.replace(/<link[^>]+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(domain)}/">`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(output);
  } catch (error) {
    console.error("home:", error);
    return res.status(500).send("Não foi possível carregar a página inicial");
  }
};
