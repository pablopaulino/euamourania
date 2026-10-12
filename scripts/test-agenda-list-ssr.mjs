import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { renderAgendaList, nextOccurrence, renderAgendaHtml } = require("../lib/agenda-list-ssr.js");
const picture = "https://omhcpbphvtihqwdkbsbf.supabase.co/storage/v1/object/public/cms-media/feira.jpg";
const start = new Date(Date.now() + 86400000).toISOString();
const end = new Date(Date.now() + 90000000).toISOString();
const event = { id: "e1", slug: "feira-livre-noturna", titulo: "Feira Livre Noturna", descricao: "Comércio, gastronomia e artesanato.", imagem_url: picture, data_inicio: start, data_fim: end, local: "Praça Matriz", recorrencia_tipo: "semanal", recorrencia_ate: null };
const tradition = { id: "t1", slug: "festa-do-peao-de-urania", nome: "Festa do Peão de Urânia", descricao_curta: "Uma tradição de Urânia.", imagem_capa_url: picture, categoria: "Cultura", recorrencia: "anual", periodo_aproximado: "Agosto" };
const edition = { id: "x1", evento_id: "t1", ano: 2026, status: "confirmado", data_inicio: start };

const originalFetch = globalThis.fetch;
const queries = [];
globalThis.fetch = async input => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop();
  queries.push({ table, params: url.searchParams });
  assert(!url.searchParams.get("select")?.includes("*"), `public select must be projected: ${table}`);
  if (table === "eventos") {
    assert.equal(url.searchParams.get("status"), "eq.publicado");
    return new Response(JSON.stringify([event]), { status: 200 });
  }
  if (table === "eventos_principais") {
    assert.equal(url.searchParams.get("ativo"), "eq.true");
    return new Response(JSON.stringify([tradition]), { status: 200 });
  }
  if (table === "eventos_edicoes") {
    assert.match(url.searchParams.get("status"), /confirmado/);
    return new Response(JSON.stringify([edition]), { status: 200 });
  }
  throw new Error(`Unexpected query: ${url}`);
};

function response() {
  return {
    statusCode: 200, headers: {}, body: "",
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    send(value) { this.body = String(value); return this; }
  };
}

try {
  const res = response();
  await renderAgendaList({}, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"], /text\/html/);
  assert.match(res.headers["cache-control"], /s-maxage=60/);
  assert.match(res.body, /data-server-rendered="true"/);
  assert.match(res.body, /Feira Livre Noturna/);
  assert.match(res.body, /Comércio, gastronomia e artesanato/);
  assert.match(res.body, /Festa do Peão de Urânia/);
  assert.match(res.body, /\/eventos\/agenda\/feira-livre-noturna/);
  assert.match(res.body, /\/eventos\/festa-do-peao-de-urania\/2026/);
  assert.match(res.body, /storage\/v1\/render\/image\/public/);
  assert(!res.body.includes("Organizando a programação…"));
  assert.equal((res.body.match(/id="agenda-structured-data"/g) || []).length, 1);
  assert.equal(queries.filter(query => query.table === "eventos").length, 2);
  console.log("✓ agenda SSR: eventos e tradições reais no HTML inicial, links públicos e JSON-LD");

  const oldWeekly = { ...event, data_inicio: "1999-01-01T21:00:00Z", data_fim: "1999-01-02T00:00:00Z" };
  const today = new Date("2026-10-12T17:00:00Z");
  const occurrence = nextOccurrence(oldWeekly, today);
  assert(occurrence && new Date(occurrence.data_inicio) >= new Date("2026-10-01T00:00:00Z"));
  console.log("✓ recorrência semanal antiga continua a gerar ocorrência atual");

  const escaped = renderAgendaHtml([{ ...event, titulo: "<script>alert(1)</script>" }], [], []);
  assert(!escaped.includes("<script>alert(1)</script>"));
  assert(escaped.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  console.log("✓ texto de CMS escapado no HTML e JSON bootstrap");

  globalThis.fetch = async () => new Response("temporarily unavailable", { status: 503 });
  const failed = response();
  await renderAgendaList({}, failed);
  assert.equal(failed.statusCode, 503);
  assert.equal(failed.headers["cache-control"], "no-store");
  assert(!failed.body.includes('data-server-rendered="true"'));
  console.log("✓ falha pública não é cacheada e permite tentativa pelo cliente");
} finally {
  globalThis.fetch = originalFetch;
}
