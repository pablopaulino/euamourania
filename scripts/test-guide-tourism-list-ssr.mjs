import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { renderGuideList, renderTourismList, renderListHtml } = require("../lib/guide-tourism-list-ssr.js");
const companies = Array.from({ length:7 }, (_, index) => ({
  id: `company-${index}`, slug: `empresa-${index}`, nome: `Empresa ${index}`,
  descricao: index ? "Um serviço em Urânia." : '<script>alert("x")</script>',
  categoria_nome: "Serviços", imagem_url: "https://example.org/empresa.webp",
  whatsapp: "5517999999999", endereco: "Rua Exemplo", horario: "09h às 18h", recomendado: index === 0,
  internal_secret: "NÃO PUBLICAR"
}));
const places = Array.from({ length:7 }, (_, index) => ({
  id: `place-${index}`, slug: `lugar-${index}`, nome: `Lugar ${index}`,
  descricao: "Lugar para conhecer em Urânia.", categoria_id: "natureza", categoria_nome: "Natureza",
  imagem_url: "https://example.org/lugar.webp", endereco: "Praça Exemplo",
  horario: "Aberto", mapa_url: "https://maps.google.com/example", destaque: index === 0,
  internal_secret: "NÃO PUBLICAR"
}));

const guideHtml = renderListHtml("guide", companies.slice(0, 6), [{ nome:"Serviços" }], true);
assert.match(guideHtml, /id="guia-container"[^>]*data-server-rendered="true"/);
assert.match(guideHtml, /Empresa 0/);
assert.doesNotMatch(guideHtml, /Empresa 6|NÃO PUBLICAR|Carregando guia/);
assert.match(guideHtml, /&lt;script&gt;alert/);
assert.match(guideHtml, /href="\/guia\/empresa-0"/);
assert.equal((guideHtml.match(/class="card-guia"/g) || []).length, 6);
assert.match(guideHtml, /"hasMore":true/);
assert.doesNotMatch(guideHtml, /<script>alert/);

const tourismHtml = renderListHtml("tourism", places.slice(0, 6), [{ id:"natureza", nome:"Natureza" }], true);
assert.match(tourismHtml, /id="turismo-container"[^>]*data-server-rendered="true"/);
assert.match(tourismHtml, /Lugar 0/);
assert.doesNotMatch(tourismHtml, /Lugar 6|NÃO PUBLICAR|Carregando lugares/);
assert.match(tourismHtml, /href="\/turismo\/lugar-0"/);
assert.equal((tourismHtml.match(/class="tourism-card-preview card-guia"/g) || []).length, 6);
assert.match(tourismHtml, /"hasMore":true/);

const seen = [];
const originalFetch = global.fetch;
global.fetch = async url => {
  const parsed = new URL(url);
  seen.push(parsed);
  const data = parsed.pathname.endsWith("/guia_comercial") ? companies
    : parsed.pathname.endsWith("/turismo") ? places : [];
  return { ok:true, json: async () => data };
};
function response() {
  return {
    headers: {}, statusCode:200, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; }, send(html) { this.html = html; return this; }
  };
}
try {
  const guide = response();
  const tourism = response();
  await renderGuideList({}, guide);
  await renderTourismList({}, tourism);
  assert.equal(guide.statusCode, 200);
  assert.equal(tourism.statusCode, 200);
  assert.equal(guide.headers["Cache-Control"], "public, s-maxage=60, stale-while-revalidate=60");
  assert.equal(tourism.headers["Cache-Control"], "public, s-maxage=60, stale-while-revalidate=60");
  assert.match(guide.html, /Empresa 0/);
  assert.match(tourism.html, /Lugar 0/);
  for (const url of seen.filter(url => !url.pathname.endsWith("/categorias"))) {
    assert.equal(url.searchParams.get("limit"), "7");
    assert.equal(url.searchParams.get("status"), "eq.publicado");
    assert.ok(!url.searchParams.get("select").includes("*"));
  }
  global.fetch = async url => new URL(url).pathname.endsWith("/categorias")
    ? new Promise(() => {}) : { ok:true, json: async () => companies };
  const started = Date.now();
  const slowCategories = response();
  await renderGuideList({}, slowCategories);
  assert.equal(slowCategories.statusCode, 200);
  assert.ok(Date.now() - started < 500, "Categorias secundárias atrasaram os cards");
  assert.match(slowCategories.html, /Empresa 0/);

  global.fetch = async () => ({ ok:false, status:503 });
  const failed = response();
  const originalError = console.error;
  try {
    console.error = () => {};
    await renderGuideList({}, failed);
  } finally {
    console.error = originalError;
  }
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.headers["Cache-Control"], "no-store");
  assert.doesNotMatch(failed.html, /data-server-rendered="true"|initial-guide-list-data/);
} finally {
  global.fetch = originalFetch;
}
console.log("SSR das listagens do Guia e Turismo: OK");
