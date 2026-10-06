const fs = require("node:fs");
const path = require("node:path");

const DOMAIN = "https://euamourania.com.br";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const FALLBACK_IMAGE = `${DOMAIN}/assets/compartilhamento-logo.png`;
const AWARDS_IMAGE = "https://omhcpbphvtihqwdkbsbf.supabase.co/storage/v1/object/public/cms-media/melhores/edicoes/2026/07/96801aaa-666d-42ad-90fe-993f329d3bcb.jpg";

const templates = {
  "award-home": "melhores-de-urania/index.html",
  "award-edition": "melhores-de-urania/edicao.html",
  "award-voting": "melhores-de-urania/votacao.html",
  "award-results": "melhores-de-urania/resultados.html",
  "award-rules": "melhores-de-urania/regulamento.html",
  "award-method": "melhores-de-urania/metodologia.html",
  "award-category": "melhores-de-urania/categoria.html",
  "award-permanent-category": "melhores-de-urania/categoria-permanente.html",
  "event-detail": "eventos/detalhes.html",
  "event-main": "eventos/evento.html",
  "event-edition": "eventos/edicao.html"
};

const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const text = value => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const imageUrl = (value, fallback) => {
  try {
    const url = new URL(value || fallback, DOMAIN);
    return url.protocol === "https:" ? url.href : fallback;
  } catch {
    return fallback;
  }
};

async function rows(table, params) {
  try {
    const query = new URLSearchParams(params);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
      signal: AbortSignal.timeout(5000)
    });
    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}

async function metadata(mode, year, slug) {
  if (mode.startsWith("award-")) {
    const editions = await rows("melhores_edicoes", {
      select: "id,nome,ano,descricao,imagem_capa_url",
      ...(mode === "award-home" || mode === "award-permanent-category" ? {} : { ano: `eq.${year}` }),
      status: "in.(indicacoes_abertas,votacao_aberta,votacao_encerrada,resultado_publicado)",
      order: "ano.desc",
      limit: "1"
    });
    const edition = editions[0];
    const awardName = edition?.nome || (year ? `Melhores de Urânia ${year}` : "Melhores de Urânia");
    let category;
    if ((mode === "award-category" || mode === "award-voting") && edition?.id && slug) {
      [category] = await rows("melhores_categorias", {
        select: "nome,descricao,imagem_url", edicao_id: `eq.${edition.id}`,
        slug: `eq.${slug}`, status: "eq.ativo", visibilidade_publica: "eq.true", limit: "1"
      });
    } else if (mode === "award-permanent-category" && slug) {
      [category] = await rows("melhores_categorias", {
        select: "nome,descricao,imagem_url", slug: `eq.${slug}`,
        status: "eq.ativo", visibilidade_publica: "eq.true", limit: "1"
      });
    }
    const title = category ? `${category.nome} | ${awardName}` : `${awardName} | Eu Amo Urânia`;
    const description = text(category?.descricao || edition?.descricao || "Conheça o prêmio Melhores de Urânia e participe da edição oficial.").slice(0, 200);
    const fallback = Number(edition?.ano || year) === 2026 || mode === "award-home" ? AWARDS_IMAGE : FALLBACK_IMAGE;
    const image = imageUrl(category?.imagem_url || edition?.imagem_capa_url, fallback);
    const url = mode === "award-home" ? "/melhores-de-urania/"
      : mode === "award-permanent-category" ? `/melhores-de-urania/categorias/${slug}/`
      : mode === "award-category" ? `/melhores-de-urania/${year}/categorias/${slug}/`
      : mode === "award-voting" ? `/melhores-de-urania/${year}/votacao/${slug ? `${slug}/` : ""}`
      : mode === "award-results" ? `/melhores-de-urania/${year}/resultados/`
      : mode === "award-rules" ? `/melhores-de-urania/${year}/regulamento/`
      : mode === "award-method" ? `/melhores-de-urania/${year}/metodologia/`
      : `/melhores-de-urania/${year}/`;
    return { title, description, image, alt: category?.nome || awardName, url: `${DOMAIN}${url}` };
  }

  if (mode === "event-detail") {
    const [event] = await rows("eventos", {
      select: "titulo,descricao,imagem_url,slug", slug: `eq.${slug}`,
      status: "eq.publicado", limit: "1"
    });
    return {
      title: `${event?.titulo || "Evento em Urânia"} | Eu Amo Urânia`,
      description: text(event?.descricao || "Confira os detalhes deste evento em Urânia.").slice(0, 200),
      image: imageUrl(event?.imagem_url, FALLBACK_IMAGE),
      alt: event?.titulo || "Evento em Urânia", url: `${DOMAIN}/eventos/agenda/${slug}`
    };
  }

  const [event] = await rows("eventos_principais", {
    select: "id,nome,descricao_curta,imagem_capa_url,slug", slug: `eq.${slug}`,
    ativo: "eq.true", limit: "1"
  });
  let edition;
  if (mode === "event-edition" && event?.id) {
    [edition] = await rows("eventos_edicoes", {
      select: "titulo,subtitulo,banner_url,cartaz_url,ano", evento_id: `eq.${event.id}`,
      ano: `eq.${year}`, limit: "1"
    });
  }
  const name = edition?.titulo || event?.nome || "Evento em Urânia";
  return {
    title: `${name} | Eu Amo Urânia`,
    description: text(edition?.subtitulo || event?.descricao_curta || "Conheça este evento em Urânia.").slice(0, 200),
    image: imageUrl(edition?.banner_url || edition?.cartaz_url || event?.imagem_capa_url, FALLBACK_IMAGE),
    alt: name,
    url: `${DOMAIN}/eventos/${slug}${mode === "event-edition" ? `/${year}` : ""}`
  };
}

function inject(html, meta) {
  const tags = [
    ["property", "og:type", "website"], ["property", "og:title", meta.title],
    ["property", "og:description", meta.description], ["property", "og:url", meta.url],
    ["property", "og:image", meta.image], ["property", "og:image:secure_url", meta.image],
    ["property", "og:image:alt", meta.alt], ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", meta.title], ["name", "twitter:description", meta.description],
    ["name", "twitter:image", meta.image], ["name", "twitter:image:alt", meta.alt]
  ].map(([attribute, name, content]) => `<meta ${attribute}="${name}" content="${esc(content)}">`).join("");
  const imageDimensions = meta.image === AWARDS_IMAGE
    ? '<meta property="og:image:width" content="1600"><meta property="og:image:height" content="807">'
    : "";
  return html
    .replace(/<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(meta.title)}</title>${tags}${imageDimensions}<link rel="canonical" href="${esc(meta.url)}">`);
}

module.exports = async function handler(req, res) {
  const mode = String(req.query.mode || "");
  const year = String(req.query.ano || "");
  const slug = String(req.query.slug || req.query.categoria || "");
  if (!templates[mode] || (mode !== "award-home" && mode !== "award-permanent-category" && !/^\d{4}$/.test(year) && mode.startsWith("award-")) ||
      ((mode === "event-edition") && !/^\d{4}$/.test(year)) ||
      ((mode.startsWith("event-") || mode.includes("category")) && !/^[a-z0-9-]+$/.test(slug))) {
    return res.status(400).send("Página inválida");
  }
  try {
    const html = fs.readFileSync(path.join(process.cwd(), templates[mode]), "utf8");
    const meta = await metadata(mode, year, slug);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(inject(html, meta));
  } catch (error) {
    console.error("social-page:", error);
    return res.status(500).send("Página temporariamente indisponível");
  }
};

module.exports._test = { metadata, inject };
