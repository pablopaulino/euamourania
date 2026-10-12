import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const { renderNewsList } = require("../lib/news-list-ssr.js");
const must = (condition, message) => { if (!condition) throw new Error(message); };
const originalFetch = globalThis.fetch;
const news = Array.from({ length: 11 }, (_, index) => ({
  id: `news-${index}`, slug: `materia-${index}`, titulo: `Matéria real ${index} de Urânia`,
  resumo: `Resumo local da matéria ${index}.`, categoria_nome: index % 2 ? "Cidade" : "Eventos",
  imagem_url: `https://example.com/news-${index}.jpg`, publicado_em: `2026-10-${String(11 - index).padStart(2, "0")}T12:00:00Z`,
  destaque: false, visualizacoes: 100 - index, nota_interna: "SEGREDO_ADMIN"
}));
const highlight = { ...news[10], id: "featured-old", slug: "destaque-antigo", titulo: "Destaque editorial real", destaque: true };
const requests = [];
globalThis.fetch = async input => {
  const url = new URL(String(input));
  requests.push(url);
  if (url.pathname.endsWith("/categorias")) return new Response(JSON.stringify([{ nome: "Cidade" }, { nome: "Eventos" }]));
  const query = url.searchParams;
  must(query.get("select") === "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque,visualizacoes", "Consulta de notícias inclui campos fora da projeção pública");
  must(query.get("status") === "eq.publicado" && query.get("publicado_em")?.startsWith("lte."), "Consulta pode mostrar rascunhos ou publicações futuras");
  if (query.get("destaque")) return new Response(JSON.stringify([highlight]));
  if (query.get("order")?.startsWith("visualizacoes")) return new Response(JSON.stringify(news.slice(0, 5)));
  must(query.get("limit") === "10", "A consulta inicial carregou mais do que a primeira página");
  return new Response(JSON.stringify(news.slice(0, 10)));
};

const response = { statusCode: 200, headers: {}, setHeader(name, value) { this.headers[name] = value; return this; },
  status(code) { this.statusCode = code; return this; }, send(body) { this.body = String(body); return this; } };
try {
  await renderNewsList({ query: {} }, response);
  must(response.statusCode === 200, `Listagem SSR respondeu ${response.statusCode}`);
  must(response.headers["Cache-Control"] === "public, s-maxage=60, stale-while-revalidate=60", "Cache da listagem de notícias deve ser curto");
  const body = response.body;
  must(body.includes('data-server-rendered="true"'), "Marcador de hidratação SSR ausente");
  must(body.includes("Destaque editorial real") && body.includes("Matéria real 0 de Urânia"), "Destaque ou matérias reais ausentes do HTML inicial");
  must((body.match(/class="news-item archive-card"/g) || []).length === 6, "Primeiro lote do feed não contém seis cartões");
  must((body.match(/property="og:image"/g) || []).length === 1, "Metadados da lista foram duplicados");
  must(body.includes('<script id="initial-news-list-data" type="application/json">'), "Dados de hidratação ausentes");
  must(!body.includes("SEGREDO_ADMIN") && !body.includes("Organizando as notícias mais recentes") && !body.includes("Carregando notícias…"), "HTML inicial contém dados privados ou placeholder");
  const data = JSON.parse(body.match(/<script id="initial-news-list-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1] || "null");
  must(data.items.length === 10 && data.hasMore && data.nextOffset === 10, "Estado inicial de paginação incorreto");
  must(data.popular.length === 5 && data.highlight.slug === "destaque-antigo", "Destaque ou mais lidas não preservados");
  must(requests.filter(url => url.pathname.endsWith("/noticias")).length === 3, "Consultas extras ou corpus completo na primeira renderização");
  const client = await readFile(new URL("../preview/noticias/news-preview.js", import.meta.url), "utf8");
  must(client.includes("if (canHydrate)") && client.includes("prepareFeed();") && client.includes("ensureFullCorpus"), "Hidratação ou busca diferida ausente");
  console.log("Listagem de notícias SSR validada: HTML real, primeira página limitada, mais lidas globais, metadados e hidratação.");
} finally {
  globalThis.fetch = originalFetch;
}
