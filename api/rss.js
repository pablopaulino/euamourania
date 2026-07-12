const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DOMAIN = "https://euamourania.com.br";

const xml = value => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const plain = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const absolute = value => {
  try {
    return new URL(value || "/assets/Design%20sem%20nome%20(9).png", `${DOMAIN}/`).href;
  } catch {
    return `${DOMAIN}/assets/Design%20sem%20nome%20(9).png`;
  }
};

module.exports = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const query = new URLSearchParams({
      select: "titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,autor,publicado_em,atualizado_em",
      status: "eq.publicado",
      publicado_em: `lte.${now}`,
      order: "publicado_em.desc",
      limit: "50"
    });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/noticias?${query}`, {
      headers: { apikey: SUPABASE_KEY }
    });
    if (!response.ok) throw new Error("Falha ao carregar notícias");
    const noticias = await response.json();
    const items = noticias.map(item => {
      const link = `${DOMAIN}/noticias/${encodeURIComponent(item.slug)}`;
      const description = item.resumo || plain(item.conteudo_html).slice(0, 220);
      const image = absolute(item.imagem_url);
      return `<item><title>${xml(item.titulo)}</title><link>${xml(link)}</link><guid isPermaLink="true">${xml(link)}</guid><description>${xml(description)}</description><pubDate>${new Date(item.publicado_em).toUTCString()}</pubDate>${item.autor ? `<author>euamourania@gmail.com (${xml(item.autor)})</author>` : ""}${item.categoria_nome ? `<category>${xml(item.categoria_nome)}</category>` : ""}<enclosure url="${xml(image)}" type="image/jpeg" /></item>`;
    }).join("");
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Notícias do Eu Amo Urânia</title><link>${DOMAIN}/news/</link><description>Últimas notícias publicadas pelo Eu Amo Urânia.</description><language>pt-BR</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}</channel></rss>`);
  } catch (error) {
    console.error("rss:", error);
    return res.status(500).send("RSS indisponível");
  }
};
