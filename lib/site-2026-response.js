const { readFileSync } = require("node:fs");
const path = require("node:path");
const { renderNews, renderGuide, renderTourism, renderInitiative } = require("./site-2026-detail-ssr.js");

const definitions = {
  news: ["preview/noticias/materia/index.html", "/preview/noticias/materia/"],
  guia: ["preview/guia/empresa/index.html", "/preview/guia/empresa/"],
  turismo: ["preview/turismo/local/index.html", "/preview/turismo/local/"],
  iniciativa: ["preview/iniciativas/detalhe/index.html", "/preview/iniciativas/detalhe/"]
};

const productionRoutes = {
  "/preview/home/": "/",
  "/preview/noticias/": "/news/",
  "/preview/guia/": "/guia.html",
  "/preview/turismo/": "/turismo.html",
  "/preview/agenda/": "/eventos/",
  "/preview/urania/": "/urania/",
  "/preview/melhores/": "/melhores-de-urania/",
  "/preview/iniciativas/": "/iniciativas/",
  "/preview/busca/": "/buscar.html",
  "/preview/quem-somos/": "/quem-somos.html",
  "/preview/colabore/": "/colabore/",
  "/preview/divulgue/": "/divulgue",
  "/preview/cadastrar-empresa/": "/cadastrar-empresa.html",
  "/preview/cadastrar-evento/": "/cadastrar-evento.html",
  "/preview/links/": "/links",
  "/preview/noticias/sobre-publicacoes/": "/news/sobre-publicacoes/",
  "/preview/noticias/politica-editorial/": "/news/politica-editorial/",
  "/preview/noticias/correcoes-transparencia-contato/": "/news/correcoes-transparencia-contato/",
  "/preview/termos/": "/termos-de-servico.html",
  "/preview/privacidade/": "/politica-de-privacidade.html",
  "/preview/descadastrar/": "/descadastrar.html"
};

function mapPreviewUrl(value) {
  if (!value || !value.startsWith("/preview/")) return value;
  const [, pathname = "", suffix = ""] = value.match(/^(\/preview\/[^?#]*)(.*)$/) || [];
  const mapped = productionRoutes[pathname];
  return mapped ? `${mapped}${suffix}` : value;
}

function stripPreviewNavigation(html) {
  return html.replace(/<(a|form)\b[^>]*>/gi, tag =>
    tag.replace(/\b(href|action)=(["'])(\/preview\/[^"']+)\2/gi, (full, attr, quote, url) =>
      `${attr}=${quote}${mapPreviewUrl(url)}${quote}`
    )
  );
}

const templates = new Map();

function loadTemplate(type) {
  if (templates.has(type)) return templates.get(type);
  const definition = definitions[type];
  if (!definition) return null;

  const [file, base] = definition;
  try {
    let html = readFileSync(path.resolve(__dirname, "..", file), "utf8")
      .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, "")
      .replace(/ — nova identidade(?=\s*\|?)/gi, "");
    html = html
      .replaceAll('href="./', `href="${base}`)
      .replaceAll('src="./', `src="${base}`);
    if (type === "iniciativa") {
      html = html
        .replace('href="../initiatives-preview.css"', 'href="/preview/iniciativas/initiatives-preview.css"')
        .replace('src="../initiative-detail-preview.js"', 'src="/preview/iniciativas/initiative-detail-preview.js"');
    }
    html = stripPreviewNavigation(html);
    if (!html.includes("/assets/js/pages/production-links.js")) {
      html = html.replace("</body>", '<script type="module" src="/assets/js/pages/production-links.js"></script></body>');
    }
    templates.set(type, html);
    return html;
  } catch (error) {
    console.error(`[site-2026] Falha ao carregar o template ${type}; usando o visual anterior.`, error);
    return null;
  }
}

function extractHead(html) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  const patterns = [
    /<title>[\s\S]*?<\/title>/i,
    /<meta[^>]+name=["']description["'][^>]*>/i,
    /<link[^>]+rel=["']canonical["'][^>]*>/i,
    /<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]+id=["']initial-(?:news|news-related|guide|guide-awards|tourism|initiative)-data["'][^>]*>[\s\S]*?<\/script>/gi,
    /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]*>/gi
  ];
  return patterns.flatMap(pattern => head.match(pattern) || []).join("");
}

function compose(type, legacyHtml) {
  let template = loadTemplate(type);
  if (!template) return legacyHtml;
  template = template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta[^>]+name=["']description["'][^>]*>/i, "")
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "")
    .replace("</head>", `${extractHead(legacyHtml)}</head>`);
  if (type === "iniciativa") {
    const placeholder = /<div id="initiative-detail-root"[^>]*>[\s\S]*?<\/div>/i;
    if (placeholder.test(template)) {
      const dataMatch = legacyHtml.match(/<script[^>]+id=["']initial-initiative-data["'][^>]*>([\s\S]*?)<\/script>/i);
      if (dataMatch) {
        const content = renderInitiative(JSON.parse(dataMatch[1]));
        if (content.includes('data-server-rendered="true"')) {
          template = template.replace(placeholder, `<div id="initiative-detail-root">${content}</div>`);
        }
      } else {
        const mainMatch = legacyHtml.match(/<main\b[^>]*id=["']conteudo["'][^>]*>([\s\S]*?)<\/main>/i);
        if (mainMatch && mainMatch[1].trim()) {
          template = template.replace(placeholder, `<div id="initiative-detail-root" data-server-rendered="true">${mainMatch[1]}</div>`);
        }
      }
    }
    return template;
  }
  const id = { news:"news", guia:"guide", turismo:"tourism" }[type];
  const renderer = { news:renderNews, guia:renderGuide, turismo:renderTourism }[type];
  if (id && renderer) {
    const match = legacyHtml.match(new RegExp(`<script[^>]+id=["']initial-${id}-data["'][^>]*>([\\s\\S]*?)<\\/script>`, "i"));
    // Sem os dados ou o alvo esperado, o HTML legado já contém a matéria/empresa/lugar.
    // Nunca responder 200 com o template novo ainda vazio por uma mudança de markup.
    if (!match) return legacyHtml;
    const item = JSON.parse(match[1]);
    const relatedMatch = type === "news"
      ? legacyHtml.match(/<script[^>]+id=["']initial-news-related-data["'][^>]*>([\s\S]*?)<\/script>/i)
      : type === "guia"
        ? legacyHtml.match(/<script[^>]+id=["']initial-guide-awards-data["'][^>]*>([\s\S]*?)<\/script>/i)
        : null;
    const relatedData = relatedMatch ? JSON.parse(relatedMatch[1]) : undefined;
    const target = { news:"newsDetails", guia:"guia-details", turismo:"turismo-details" }[type];
    const placeholder = new RegExp(`(<div id="${target}"[^>]*>)[\\s\\S]*?(<\\/div>)`, "i");
    if (!placeholder.test(template)) return legacyHtml;
    const content = renderer(item, relatedData);
    if (!content.includes('data-server-rendered="true"')) return legacyHtml;
    template = template.replace(placeholder, (_, open, close) => `${open}${content}${close}`);
  }
  return template;
}

function useSite2026Response(res, type) {
  const send = res.send.bind(res);
  res.send = body => {
    if (res.statusCode < 400 && typeof body === "string" && /<html/i.test(body)) {
      try {
        return send(compose(type, body));
      } catch (error) {
        console.error(`[site-2026] Falha ao aplicar o template ${type}; usando o visual anterior.`, error);
        return send(body);
      }
    }
    return send(body);
  };
}

module.exports = { compose, loadTemplate, useSite2026Response };
