import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { compose, useSite2026Response } = require("../lib/site-2026-response.js");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

const legacy = `<!doctype html><html><head>
  <title>Conteúdo real</title>
  <meta name="description" content="Descrição real">
  <link rel="canonical" href="https://euamourania.com.br/teste">
  <script id="initial-guide-data" type="application/json">{}</script>
  <script id="initial-tourism-data" type="application/json">{}</script>
</head><body>LEGADO</body></html>`;

for (const type of ["news", "guia", "turismo", "iniciativa"]) {
  const html = compose(type, legacy);
  must(html !== legacy, `Template novo não foi aplicado: ${type}.`);
  must(html.includes("<title>Conteúdo real</title>"), `Metadados reais foram perdidos: ${type}.`);
  must(html.includes("/assets/js/pages/production-links.js"), `Links de produção ausentes: ${type}.`);
}

must(compose("desconhecido", legacy) === legacy, "Fallback não preserva a página anterior.");

const sent = [];
const res = {
  statusCode: 200,
  send(body) {
    sent.push(body);
    return body;
  }
};
useSite2026Response(res, "news");
res.send(legacy);
must(sent[0]?.includes("<title>Conteúdo real</title>"), "Interceptador de resposta falhou.");

console.log("Templates dinâmicos, metadados e fallback validados.");
