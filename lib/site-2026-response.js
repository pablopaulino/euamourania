const { readFileSync } = require("node:fs");
const path = require("node:path");

const definitions = {
  news: ["preview/noticias/materia/index.html", "/preview/noticias/materia/"],
  guia: ["preview/guia/empresa/index.html", "/preview/guia/empresa/"],
  turismo: ["preview/turismo/local/index.html", "/preview/turismo/local/"],
  iniciativa: ["preview/iniciativas/detalhe/index.html", "/preview/iniciativas/detalhe/"]
};

const templates = Object.fromEntries(Object.entries(definitions).map(([type, [file, base]]) => {
  let html = readFileSync(path.join(process.cwd(), file), "utf8")
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
  if (!html.includes("/assets/js/pages/production-links.js")) {
    html = html.replace("</body>", '<script type="module" src="/assets/js/pages/production-links.js"></script></body>');
  }
  return [type, html];
}));

function extractHead(html) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  const patterns = [
    /<title>[\s\S]*?<\/title>/i,
    /<meta[^>]+name=["']description["'][^>]*>/i,
    /<link[^>]+rel=["']canonical["'][^>]*>/i,
    /<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi,
    /<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi,
    /<script[^>]+id=["']initial-(?:guide|tourism)-data["'][^>]*>[\s\S]*?<\/script>/gi,
    /<link[^>]+rel=["']preload["'][^>]+as=["']image["'][^>]*>/gi
  ];
  return patterns.flatMap(pattern => head.match(pattern) || []).join("");
}

function compose(type, legacyHtml) {
  let template = templates[type];
  if (!template) return legacyHtml;
  template = template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta[^>]+name=["']description["'][^>]*>/i, "")
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "")
    .replace("</head>", `${extractHead(legacyHtml)}</head>`);
  return template;
}

function useSite2026Response(res, type) {
  const send = res.send.bind(res);
  res.send = body => {
    if (res.statusCode < 400 && typeof body === "string" && /<html/i.test(body)) return send(compose(type, body));
    return send(body);
  };
}

module.exports = { useSite2026Response };
