const fs = require("node:fs");
const path = require("node:path");
const { eventPage, json } = require("./event-ssr.js");
const { renderAwardsSsr, injectAwardsSsr, buildAwardStructuredData, votingDescription } = require("./melhores-ssr.js");

const DOMAIN = "https://euamourania.com.br";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const FALLBACK_IMAGE = `${DOMAIN}/assets/compartilhamento-logo.png`;
const AWARDS_IMAGE = "https://omhcpbphvtihqwdkbsbf.supabase.co/storage/v1/object/public/cms-media/melhores/edicoes/2026/07/96801aaa-666d-42ad-90fe-993f329d3bcb.jpg";

const awardRoutes = import("../assets/js/melhoresRoutes.mjs");
const eventTemplates = {
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

const SSR_AWARD_MODES = new Set([
  "award-home", "award-edition", "award-category", "award-permanent-category",
  "award-voting", "award-results", "award-hall", "award-winner", "award-rules", "award-method"
]);

async function resolveAwardsContext(mode, year, slug) {
  const allEditions = ["award-home", "award-hall"].includes(mode);
  const editions = await rows("melhores_edicoes", {
    select: "id,nome,ano,slug,descricao,imagem_capa_url,status,indicacoes_inicio,indicacoes_fim,votacao_inicio,votacao_inicio_site,votacao_fim,divulgacao_em,resultado_publicado_em,peso_site,peso_instagram,mostrar_votos_publicamente,regulamento,metodologia",
    ...(["award-home", "award-permanent-category", "award-hall"].includes(mode) ? {} : { ano: `eq.${year}` }),
    status: "in.(indicacoes_abertas,indicacoes_encerradas,votacao_aberta,votacao_encerrada,apuracao,resultado_publicado,arquivada)",
    order: "ano.desc",
    ...(allEditions ? {} : { limit: "1" })
  });
  const edition = editions[0];
  let category;
  if ((mode === "award-category" || mode === "award-voting") && edition?.id && slug) {
    [category] = await rows("melhores_categorias", {
      select: "id,nome,slug,descricao,imagem_url,permite_indicacao_publica,max_escolhas", edicao_id: `eq.${edition.id}`,
      slug: `eq.${slug}`, limit: "1"
    });
  } else if (mode === "award-permanent-category" && slug) {
    [category] = await rows("melhores_categorias", {
      select: "id,nome,slug,descricao,imagem_url,melhores_edicoes!inner(status)", "melhores_edicoes.status": "in.(indicacoes_abertas,indicacoes_encerradas,votacao_aberta,votacao_encerrada,apuracao,resultado_publicado,arquivada)", slug: `eq.${slug}`,
      order: "atualizado_em.desc", limit: "1"
    });
  }
  return { editions, edition, category };
}

async function metadata(mode, year, slug, resolved = null) {
  if (mode.startsWith("award-")) {
    const context = resolved || await resolveAwardsContext(mode, year, slug);
    const { edition, category } = context;
    const awardName = edition?.nome || (year ? `Melhores de Urânia ${year}` : "Melhores de Urânia");
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
      : mode === "award-home" ? "Prêmio Melhores de Urânia | Eu Amo Urânia"
      : mode === "award-hall" ? "Hall dos Vencedores | Melhores de Urânia"
      : mode === "award-rules" ? `Regulamento | ${awardName}`
      : mode === "award-method" ? `Metodologia | ${awardName}`
      : mode === "award-voting" ? (category ? `Votação — ${category.nome} | ${awardName}` : `Votação | ${awardName}`)
      : mode === "award-permanent-category" && category ? `Histórico de ${category.nome} | Melhores de Urânia`
      : category ? `Indicados de ${category.nome} | ${awardName}`
      : mode === "award-results" ? `Resultados ${edition?.ano || year} | ${awardName}`
      : `${awardName} | Eu Amo Urânia`;
    const description = winnerName
      ? text(`${winnerName} venceu ${winner?.melhores_categorias?.nome || "uma categoria"} no ${awardName}. ${winner?.melhores_indicados?.descricao_curta || ""}`).slice(0, 200)
      : mode === "award-hall" ? "Conheça os vencedores oficiais das edições do prêmio Melhores de Urânia."
      : mode === "award-rules" ? `Confira o regulamento oficial, os critérios de participação e as regras do ${awardName}.`.slice(0, 200)
      : mode === "award-method" ? `Entenda a metodologia, as etapas de indicação, votação popular e apuração do ${awardName}.`.slice(0, 200)
      : mode === "award-voting" ? votingDescription(edition, category)
      : mode === "award-category" && category ? `Conheça os indicados de ${category.nome} na edição ${year} do Prêmio Melhores de Urânia.`
      : mode === "award-permanent-category" && category ? `Explore as edições de ${category.nome} e consulte os participantes dessa categoria ao longo dos anos no Melhores de Urânia.`
      : mode === "award-edition" ? `Conheça as categorias, os indicados e as etapas da edição ${year} do Prêmio Melhores de Urânia.`
      : mode === "award-results" ? `Acompanhe a divulgação dos resultados de ${year} do Melhores de Urânia e consulte os vencedores por categoria.`
      : text(category?.descricao || edition?.descricao || "Conheça o prêmio Melhores de Urânia e participe da edição oficial.").slice(0, 200);
    const fallback = Number(edition?.ano || year) === 2026 || mode === "award-home" ? AWARDS_IMAGE : FALLBACK_IMAGE;
    const image = imageUrl(winner?.melhores_indicados?.imagem_url || category?.imagem_url || edition?.imagem_capa_url, fallback);
    const { awardPath, awardSocialPages } = await awardRoutes;
    const url = awardPath(awardSocialPages[mode], { year, slug, id: slug });
    const pageUrl = `${DOMAIN}${url}`;
    const pageDescription = mode === "award-home"
      ? "Conheça o Melhores de Urânia, premiação anual que celebra empresas, iniciativas e profissionais da cidade."
      : description;
    return {
      title, description: pageDescription, image, alt: winnerName || category?.nome || awardName,
      url: pageUrl,
      missingWinner: mode === "award-winner" && !winner,
      noindex: (mode === "award-winner" && !winner) || (["award-hall", "award-results"].includes(mode) && !hasPublishedWinner),
      structured: buildAwardStructuredData({
        mode,
        year,
        slug,
        editions: context.editions,
        edition,
        category,
        winner,
        title,
        description: pageDescription,
        url: pageUrl,
        image
      })
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
  const { awardSocialPages, awardTemplate } = await awardRoutes;
  const awardPage = Object.hasOwn(awardSocialPages, mode) ? awardSocialPages[mode] : null;
  const template = awardPage ? awardTemplate(awardPage).slice(1) : Object.hasOwn(eventTemplates, mode) ? eventTemplates[mode] : null;
  if (!template || (!["award-home", "award-permanent-category", "award-hall"].includes(mode) && !/^\d{4}$/.test(year) && mode.startsWith("award-")) ||
      ((mode === "event-edition") && !/^\d{4}$/.test(year)) ||
      ((mode.startsWith("event-") || mode.includes("category") || mode === "award-winner") && !/^[a-z0-9-]+$/.test(slug))) {
    return res.status(400).send("Página inválida");
  }
  try {
    const html = fs.readFileSync(path.join(process.cwd(), template), "utf8");
    const event = mode.startsWith("event-") ? await eventPage(mode, year, slug, rows) : null;
    if (mode.startsWith("event-") && !event) return res.status(404).send("Evento não encontrado");
    const awardContext = mode.startsWith("award-") ? await resolveAwardsContext(mode, year, slug) : null;
    if (awardContext) {
      const needsEdition = !["award-home", "award-hall", "award-permanent-category"].includes(mode);
      const needsCategory = mode.includes("category") || (mode === "award-voting" && slug);
      if ((needsEdition && !awardContext.edition) || (needsCategory && !awardContext.category)) {
        res.setHeader("X-Robots-Tag", "noindex");
        return res.status(404).send("Página do prêmio não encontrada.");
      }
    }
    const ssr = SSR_AWARD_MODES.has(mode) ? await renderAwardsSsr({ mode, year, slug, ...awardContext, rows }) : null;
    const meta = event?.metadata || await metadata(mode, year, slug, awardContext);
    if (ssr?.structuredContext && mode.startsWith("award-")) {
      meta.structured = buildAwardStructuredData({
        mode,
        year,
        slug,
        ...awardContext,
        ...ssr.structuredContext,
        title: meta.title,
        description: meta.description,
        url: meta.url,
        image: meta.image
      });
    }
    if (awardPage && req.query.demo === "1") meta.noindex = true;
    let document = inject(html, meta);
    if (event) {
      const placeholder = /<div id="(agenda-(?:event|tradition|edition)-details)" aria-live="polite"><p class="event-detail-status">[^<]*<\/p><\/div>/;
      if (!placeholder.test(document)) throw new Error(`Placeholder de evento não encontrado em ${template}`);
      document = document.replace(placeholder, (_, id) => `<div id="${id}" aria-live="polite" data-server-rendered="true">${event.body}</div>`);
    } else if (ssr) {
      document = injectAwardsSsr(document, ssr);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=60");
    return res.status(meta.missingWinner ? 404 : 200).send(document);
  } catch (error) {
    console.error("social-page:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).send("Página temporariamente indisponível");
  }
};

module.exports._test = { metadata, inject };
