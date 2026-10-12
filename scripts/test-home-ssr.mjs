import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const handleHome = require("../api/home.js");
const originalFetch = globalThis.fetch;
const routes = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).routes || [];
for (const [src, dest] of [
  ["^/$", "/api/home"],
  ["^/news/?$", "/api/noticia?tipo=news-list"],
  ["^/guia\\.html$", "/api/noticia?tipo=guide-list"],
  ["^/turismo\\.html$", "/api/noticia?tipo=tourism-list"],
  ["^/eventos/?$", "/api/noticia?tipo=agenda-list"]
]) {
  assert.ok(routes.some(route => route.src === src && route.dest === dest), `Rota SSR prioritária ausente: ${src}`);
}
const calls = [];
const now = Date.now();

const rows = {
  noticias: [{ id: 1, slug: "noticia-teste", titulo: "Notícia de Urânia <teste>", imagem_url: "https://example.com/noticia.jpg", categoria_nome: "Cidade" }],
  guia_comercial: [{ id: 2, slug: "comercio-teste", nome: "Comércio de Urânia", descricao: "Empresa local", imagem_url: "https://example.com/empresa.jpg", categoria_nome: "Comércio", recomendado: true }],
  turismo: [{ id: 3, slug: "lugar-teste", nome: "Lugar de Urânia", imagem_url: "https://example.com/lugar.jpg", categoria_nome: "Turismo" }],
  eventos: [{ id: 4, slug: "evento-teste", titulo: "Evento de Urânia", local: "Praça", data_inicio: new Date(now + 3600000).toISOString(), data_fim: null }],
  eventos_edicoes: [],
  configuracoes_site: []
};

function fakeResponse(body) {
  return { ok: true, json: async () => body };
}

function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    send(body) { this.body = body; return this; }
  };
}

try {
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url);
    const table = parsed.pathname.split("/").at(-1);
    calls.push({ table, query: parsed.searchParams, headers: options.headers });
    return fakeResponse(table === "eventos" && parsed.searchParams.has("recorrencia_tipo") ? [] : rows[table]);
  };

  const res = response();
  await handleHome({ method: "GET", query: {} }, res);
  assert.equal(res.code, 200);
  assert.match(res.headers["Cache-Control"], /s-maxage=60/);
  assert.match(res.body, /<link rel="canonical" href="https:\/\/euamourania\.com\.br\/">/);
  assert.equal((res.body.match(/rel="canonical"/g) || []).length, 1);
  for (const id of ["home-news", "home-businesses", "home-tourism", "home-agenda"]) {
    assert.match(res.body, new RegExp(`id="${id}" data-server-rendered="true"`));
  }
  for (const title of ["Notícia de Urânia &lt;teste&gt;", "Comércio de Urânia", "Lugar de Urânia", "Evento de Urânia"]) {
    assert.ok(res.body.includes(title), `Conteúdo inicial ausente: ${title}`);
  }
  assert.match(res.body, /id="tourism-image" src="https:\/\/example.com\/lugar.jpg"/);
  assert.ok(!res.body.includes("Carregando notícias…"));
  assert.ok(!res.body.includes("Carregando empresas…"));
  assert.ok(!res.body.includes("Consultando a agenda…"));
  assert.ok(calls.every(call => call.headers.Authorization === undefined));
  assert.equal(calls.find(call => call.table === "noticias")?.query.get("status"), "eq.publicado");
  assert.equal(calls.find(call => call.table === "guia_comercial")?.query.get("limit"), "6");
  assert.equal(calls.find(call => call.table === "turismo")?.query.get("limit"), "5");

  globalThis.fetch = async url => {
    const table = new URL(url).pathname.split("/").at(-1);
    if (table === "eventos_edicoes") throw new Error("Edições indisponíveis no teste");
    return fakeResponse(rows[table]);
  };
  const withOptionalFailure = response();
  const previousOptionalError = console.error;
  console.error = () => {};
  try {
    await handleHome({ method: "GET", query: {} }, withOptionalFailure);
  } finally {
    console.error = previousOptionalError;
  }
  assert.equal(withOptionalFailure.code, 200, "Edições opcionais não devem impedir o conteúdo principal da home");
  assert.equal(withOptionalFailure.headers["Cache-Control"], "no-store");
  assert.match(withOptionalFailure.body, /id="home-agenda" data-server-rendered="partial"/);
  assert.match(withOptionalFailure.body, /Evento de Urânia/);

  globalThis.fetch = async () => { throw new Error("Supabase indisponível no teste"); };
  const previousError = console.error;
  const previousWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    const unavailable = response();
    await handleHome({ method: "GET", query: {} }, unavailable);
    assert.equal(unavailable.code, 503);
    assert.equal(unavailable.headers["Cache-Control"], "no-store");
  } finally {
    console.error = previousError;
    console.warn = previousWarn;
  }

  console.log("Home SSR: HTML inicial com conteúdo público, links, imagens e cache curto — OK");
} finally {
  globalThis.fetch = originalFetch;
}
