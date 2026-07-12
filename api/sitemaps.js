const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DOMAIN = "https://euamourania.com.br";
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const xml = value => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

async function rows(table, select, order, filters = []) {
  const query = new URLSearchParams({
    select,
    status: "eq.publicado",
    order
  });
  filters.forEach(([key, value]) => query.append(key, value));
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY }
  });
  if (!response.ok) throw new Error(`Falha ao carregar ${table}`);
  return response.json();
}

async function melhoresRows() {
  const query = new URLSearchParams({
    select: "ano,atualizado_em,imagem_capa_url",
    status: "in.(indicacoes_abertas,votacao_aberta,votacao_encerrada,resultado_publicado,arquivada)",
    order: "ano.desc"
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/melhores_edicoes?${query}`, {
    headers: { apikey: SUPABASE_KEY }
  });
  if (!response.ok) return [];
  return response.json();
}

async function melhoresCategoriasRows() {
  const query = new URLSearchParams({
    select: "slug,atualizado_em,edicao_id,melhores_edicoes!inner(id,ano,status)",
    status: "eq.ativo",
    visibilidade_publica: "eq.true",
    order: "ordem.asc"
  });
  query.append("melhores_edicoes.status", "in.(indicacoes_abertas,votacao_aberta,votacao_encerrada,resultado_publicado,arquivada)");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/melhores_categorias?${query}`, {
    headers: { apikey: SUPABASE_KEY }
  });
  if (!response.ok) return [];
  return response.json();
}

module.exports = async (req, res) => {
  try {
    const type = req.query.type === "news" ? "news" : "standard";
    const now = new Date();
    const publicationFilters = [["publicado_em", `lte.${now.toISOString()}`]];
    const noticias = await rows(
      "noticias",
      "slug,titulo,publicado_em,imagem_url,seo_imagem",
      "publicado_em.desc",
      type === "news"
        ? [...publicationFilters, ["publicado_em", `gte.${new Date(now.getTime() - TWO_DAYS_MS).toISOString()}`]]
        : publicationFilters
    );

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");

    if (type === "news") {
      const urls = noticias.slice(0, 1000).map(noticia =>
        `<url><loc>${DOMAIN}/noticias/${xml(noticia.slug)}</loc><news:news><news:publication><news:name>Eu Amo Urânia</news:name><news:language>pt</news:language></news:publication><news:publication_date>${xml(noticia.publicado_em)}</news:publication_date><news:title>${xml(noticia.titulo)}</news:title></news:news></url>`
      ).join("");
      return res.status(200).send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls}</urlset>`
      );
    }

    const [turismo, eventos, melhores, melhoresCategorias] = await Promise.all([
      rows("turismo", "slug,atualizado_em", "atualizado_em.desc"),
      rows("eventos", "slug,atualizado_em", "atualizado_em.desc"),
      melhoresRows(),
      melhoresCategoriasRows()
    ]);
    const statics = ["/", "/news/", "/guia.html", "/turismo.html", "/eventos/", "/melhores-de-urania/", "/links/", "/quem-somos.html"];
    const imageTag = item => {
      const image = item.seo_imagem || item.imagem_url;
      return image ? `<image:image><image:loc>${xml(new URL(image, `${DOMAIN}/`).href)}</image:loc></image:image>` : "";
    };
    const melhoresUrls = melhores.flatMap(item => {
      const base = [{
        loc: `${DOMAIN}/melhores-de-urania/${item.ano}/`,
        lastmod: item.atualizado_em,
        image: item.imagem_capa_url ? `<image:image><image:loc>${xml(new URL(item.imagem_capa_url, `${DOMAIN}/`).href)}</image:loc></image:image>` : ""
      }, {
        loc: `${DOMAIN}/melhores-de-urania/${item.ano}/regulamento/`,
        lastmod: item.atualizado_em
      }, {
        loc: `${DOMAIN}/melhores-de-urania/${item.ano}/metodologia/`,
        lastmod: item.atualizado_em
      }];
      if (item.status === "resultado_publicado") {
        base.push({
          loc: `${DOMAIN}/melhores-de-urania/${item.ano}/resultados/`,
          lastmod: item.atualizado_em,
          image: item.imagem_capa_url ? `<image:image><image:loc>${xml(new URL(item.imagem_capa_url, `${DOMAIN}/`).href)}</image:loc></image:image>` : ""
        });
      }
      return base;
    });
    const all = [
      ...statics.map(path => ({ loc: DOMAIN + path })),
      ...noticias.map(noticia => ({
        loc: `${DOMAIN}/noticias/${noticia.slug}`,
        lastmod: noticia.publicado_em,
        image: imageTag(noticia)
      })),
      ...turismo.map(item => ({
        loc: `${DOMAIN}/turismo-details.html?slug=${item.slug}`,
        lastmod: item.atualizado_em
      })),
      ...eventos.map(item => ({
        loc: `${DOMAIN}/eventos/detalhes.html?slug=${item.slug}`,
        lastmod: item.atualizado_em
      })),
      ...melhoresCategorias.map(item => ({
        loc: `${DOMAIN}/melhores-de-urania/${item.melhores_edicoes?.ano}/categorias/${item.slug}/`,
        lastmod: item.atualizado_em
      })),
      ...melhoresUrls
    ];
    const urls = all.map(item =>
      `<url><loc>${xml(item.loc)}</loc>${item.lastmod ? `<lastmod>${xml(String(item.lastmod).slice(0, 10))}</lastmod>` : ""}${item.image || ""}</url>`
    ).join("");
    return res.status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}</urlset>`
    );
  } catch (error) {
    console.error("sitemaps:", error);
    return res.status(500).send("Sitemap indisponível");
  }
};
