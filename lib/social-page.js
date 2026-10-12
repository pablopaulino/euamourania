const fs = require("node:fs");
const path = require("node:path");
const { eventPage, json } = require("./event-ssr.js");

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
  "award-hall": "melhores-de-urania/hall.html",
  "award-winner": "melhores-de-urania/vencedor.html",
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

async function publicEventRows(table, params) {
  const query = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error(`Falha ao consultar ${table}: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error(`Resposta inválida de ${table}`);
  return data;
}

async function metadata(mode, year, slug) {
  if (mode.startsWith("award-")) {
    const editions = await rows("melhores_edicoes", {
      select: "id,nome,ano,descricao,imagem_capa_url,status",
      ...(["award-home", "award-permanent-category", "award-hall"].includes(mode) ? {} : { ano: `eq.${year}` }),
      status: "in.(indicacoes_abertas,indicacoes_encerradas,votacao_aberta,votacao_encerrada,apuracao,resultado_publicado,arquivada)",
      order: "ano.desc",
      limit: "1"
    });
    const edition = editions[0];
    const awardName = edition?.nome || (year ? `Melhores de Urânia ${year}` : "Melhores de Urânia");
    let category;
    if ((mode === "award-category" || mode === "award-voting") && edition?.id && slug) {
      [category] = await rows("melhores_categorias", {
        select: "nome,descricao,imagem_url", edicao_id: `eq.${edition.id}`,
        slug: `eq.${slug}`, limit: "1"
      });
    } else if (mode === "award-permanent-category" && slug) {
      [category] = await rows("melhores_categorias", {
        select: "nome,descricao,imagem_url", slug: `eq.${slug}`,
        order: "atualizado_em.desc", limit: "1"
      });
    }
    let winner;
    let hasPublishedWinner = false;
    if (["award-results", "award-winner", "award-hall"].includes(mode)) {
      const winners = await rows("rpc/melhores_listar_resultados_publicos", {
        ...(mode === "award-hall" ? {} : { p_edicao: edition?.id || "00000000-0000-0000-0000-000000000000" }),
        p_somente_vencedores: "true",
        ...(mode === "award-winner" ? {} : { limit: "1" })
      });
      hasPublishedWinner = winners.length > 0;
      if (mode === "award-winner") winner = winners.find(item => item.indicado_id === slug);
    }
    const winnerName = winner?.melhores_indicados?.nome;
    const title = winnerName ? `${winnerName} | Vencedor do ${awardName}`
      : mode === "award-winner" ? `Vencedor não disponível | ${awardName}`
      : mode === "award-hall" ? "Hall da Fama | Melhores de Urânia"
      : category ? `${category.nome} | ${awardName}`
      : mode === "award-results" ? `Resultados ${edition?.ano || year} | ${awardName}`
      : `${awardName} | Eu Amo Urânia`;
    const description = winnerName
      ? text(winner?.melhores_indicados?.descricao_curta || `${winnerName} venceu ${winner?.melhores_categorias?.nome || "uma categoria"} no ${awardName}.`).slice(0, 200)
      : mode === "award-hall" ? "Conheça os vencedores oficiais das edições do prêmio Melhores de Urânia."
      : text(category?.descricao || edition?.descricao || "Conheça o prêmio Melhores de Urânia e participe da edição oficial.").slice(0, 200);
    const fallback = Number(edition?.ano || year) === 2026 || mode === "award-home" ? AWARDS_IMAGE : FALLBACK_IMAGE;
    const image = imageUrl(winner?.melhores_indicados?.imagem_url || category?.imagem_url || edition?.imagem_capa_url, fallback);
    const url = mode === "award-home" ? "/melhores-de-urania/"
      : mode === "award-hall" ? "/melhores-de-urania/hall/"
      : mode === "award-winner" ? `/melhores-de-urania/${year}/vencedores/${slug}/`
      : mode === "award-permanent-category" ? `/melhores-de-urania/categorias/${slug}/`
      : mode === "award-category" ? `/melhores-de-urania/${year}/categorias/${slug}/`
      : mode === "award-voting" ? `/melhores-de-urania/${year}/votacao/${slug ? `${slug}/` : ""}`
      : mode === "award-results" ? `/melhores-de-urania/${year}/resultados/`
      : mode === "award-rules" ? `/melhores-de-urania/${year}/regulamento/`
      : mode === "award-method" ? `/melhores-de-urania/${year}/metodologia/`
      : `/melhores-de-urania/${year}/`;
    return {
      title, description, image, alt: winnerName || category?.nome || awardName,
      url: `${DOMAIN}${url}`,
      noindex: (mode === "award-winner" && !winner) || (["award-hall", "award-results"].includes(mode) && !hasPublishedWinner)
    };
  }

  throw new Error(`Modo de metadados desconhecido: ${mode}`);
}

function inject(html, meta) {
  const tags = [
    ["property", "og:type", meta.type || "website"], ["property", "og:locale", "pt_BR"],
    ["property", "og:site_name", "Eu Amo Urânia"], ["property", "og:title", meta.title],
    ["property", "og:description", meta.description], ["property", "og:url", meta.url],
    ["property", "og:image", meta.image], ["property", "og:image:secure_url", meta.image],
    ["property", "og:image:alt", meta.alt], ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", meta.title], ["name", "twitter:description", meta.description],
    ["name", "twitter:image", meta.image], ["name", "twitter:image:alt", meta.alt]
  ].map(([attribute, name, content]) => `<meta ${attribute}="${name}" content="${esc(content)}">`).join("");
  const imageDimensions = meta.image === AWARDS_IMAGE
    ? '<meta property="og:image:width" content="1600"><meta property="og:image:height" content="807">'
    : "";
  const robots = meta.noindex ? '<meta name="robots" content="noindex,follow">' : "";
  const structured = meta.structured ? `<script type="application/ld+json">${json(meta.structured)}</script>` : "";
  return html
    .replace(/<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>/gi, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(meta.title)}</title><meta name="description" content="${esc(meta.description)}">${tags}${imageDimensions}${robots}${structured}<link rel="canonical" href="${esc(meta.url)}">`);
}

module.exports = async function handler(req, res) {
  const mode = String(req.query.mode || "");
  const year = String(req.query.ano || "");
  const slug = String(req.query.slug || req.query.categoria || "");
  if (!templates[mode] || (!["award-home", "award-permanent-category", "award-hall"].includes(mode) && !/^\d{4}$/.test(year) && mode.startsWith("award-")) ||
      ((mode === "event-edition") && !/^\d{4}$/.test(year)) ||
      ((mode.startsWith("event-") || mode.includes("category") || mode === "award-winner") && !/^[a-z0-9-]+$/.test(slug))) {
    return res.status(400).send("Página inválida");
  }
  try {
    const html = fs.readFileSync(path.join(process.cwd(), templates[mode]), "utf8");
    const event = mode.startsWith("event-") ? await eventPage(mode, year, slug, publicEventRows) : null;
    if (mode.startsWith("event-") && !event) return res.status(404).send("Evento não encontrado");
    const meta = event?.metadata || await metadata(mode, year, slug);
    let document = inject(html, meta);
    if (event) {
      const placeholder = /<div id="(agenda-(?:event|tradition|edition)-details)" aria-live="polite"><p class="event-detail-status">[^<]*<\/p><\/div>/;
      if (!placeholder.test(document)) throw new Error(`Placeholder de evento não encontrado em ${templates[mode]}`);
      document = document.replace(placeholder, (_, id) => `<div id="${id}" aria-live="polite" data-server-rendered="true">${event.body}</div>`);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(200).send(document);
  } catch (error) {
    console.error("social-page:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).send("Página temporariamente indisponível");
  }
};

module.exports._test = { metadata, inject };
