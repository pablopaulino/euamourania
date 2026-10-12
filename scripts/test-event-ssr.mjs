import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../lib/social-page.js");
const { _test: eventHelpers } = require("../lib/event-ssr.js");
const image = "https://omhcpbphvtihqwdkbsbf.supabase.co/storage/v1/object/public/cms-media/eventos/teste.jpg";
const longText = "A programação reúne moradores e visitantes de Urânia. ".repeat(16);
const simple = {
  id: "simple-1", slug: "feira-livre-noturna", titulo: "Feira Livre Noturna",
  descricao: "Feirantes e gastronomia na Praça Matriz.", imagem_url: image,
  data_inicio: "2026-10-17T19:00:00Z", data_fim: "2026-10-17T22:00:00Z",
  recorrencia_tipo: "semanal", recorrencia_ate: "2027-01-01T00:00:00Z",
  local: "Praça Matriz de Urânia", endereco: "Centro, Urânia - SP",
  organizador: "Equipe da Feira", whatsapp: "5517999999999", destaque: true
};
const tradition = {
  id: "tradition-1", slug: "festa-do-peao-de-urania", nome: "Festa do Peão de Urânia",
  descricao_curta: "A tradição da cidade.", historia_html: `<p>Uma história da cidade. ${longText}</p><script>alert('x')</script>`,
  imagem_capa_url: image, galeria_historica: [], categoria: "Cultura",
  local_tradicional: "Recinto de exposições", recorrencia: "anual",
  periodo_aproximado: "Setembro", organizador: "Organização local",
  seo_titulo: "Festa do Peão | Eu Amo Urânia", seo_descricao: "Conheça a tradição."
};
const edition = {
  id: "edition-1", evento_id: tradition.id, ano: 2026,
  titulo: "Festa do Peão de Urânia 2026", subtitulo: "Programação de 2026",
  data_inicio: "2026-09-10T19:00:00Z", data_fim: "2026-09-13T22:00:00Z",
  programacao_html: `<p>Apresentações e shows em Urânia. ${longText}</p>`,
  atracoes_html: "<p>Atração principal da edição.</p>",
  cartaz_url: image, banner_url: image, galeria: [], local: "Recinto de exposições",
  mapa_url: "https://maps.google.com/?q=Urânia", patrocinadores: [], status: "encerrado",
  resumo_pos_evento_html: "<p>A edição reuniu moradores.</p>",
  publico_estimado: 5000, seo_titulo: "Edição 2026 | Eu Amo Urânia",
  seo_descricao: "Veja o histórico da edição."
};

const originalFetch = globalThis.fetch;
const queries = [];
globalThis.fetch = async input => {
  const url = new URL(String(input));
  const table = url.pathname.split("/").pop();
  queries.push({ table, params: url.searchParams });
  assert(!url.searchParams.get("select")?.includes("*"), `SSR deve selecionar só campos públicos (${table})`);
  if (table === "eventos") {
    assert(!url.searchParams.get("select")?.includes("mapa_url"), "não pedir coluna inexistente em eventos");
    assert.equal(url.searchParams.get("status"), "eq.publicado");
    return new Response(JSON.stringify(url.searchParams.get("slug") === "eq.oculto" ? [] : [simple]), { status: 200 });
  }
  if (table === "eventos_principais") {
    assert.equal(url.searchParams.get("ativo"), "eq.true");
    return new Response(JSON.stringify([tradition]), { status: 200 });
  }
  if (table === "eventos_edicoes") {
    assert.equal(url.searchParams.get("status"), "in.(anunciado,confirmado,acontecendo,encerrado,cancelado)");
    return new Response(JSON.stringify([edition]), { status: 200 });
  }
  throw new Error(`Consulta inesperada: ${url}`);
};

async function render(mode, slug, ano = "") {
  const res = {
    statusCode: 200, headers: {}, body: "",
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    send(value) { this.body = String(value); return this; }
  };
  await handler({ query: { tipo: "social", mode, slug, ano } }, res);
  return res;
}

try {
  const cases = [
    ["event-detail", "feira-livre-noturna", "", "Feira Livre Noturna", "Feirantes e gastronomia"],
    ["event-main", "festa-do-peao-de-urania", "", "Festa do Peão de Urânia", "Uma história da cidade"],
    ["event-edition", "festa-do-peao-de-urania", "2026", "Festa do Peão de Urânia 2026", "Apresentações e shows"]
  ];
  for (const [mode, slug, ano, title, body] of cases) {
    const result = await render(mode, slug, ano);
    assert.equal(result.statusCode, 200, `${mode} deve retornar 200`);
    assert.equal(result.headers["cache-control"], "public, s-maxage=60, stale-while-revalidate=60");
    assert.match(result.headers["content-type"], /text\/html/);
    assert.match(result.body, /<main id="conteudo">/);
    assert.match(result.body, /data-server-rendered="true"/);
    assert.match(result.body, new RegExp(`<h1>${title}<\\/h1>`));
    assert(result.body.includes(body), `${mode} deve ter texto real no HTML inicial`);
    assert(result.body.includes("/storage/v1/render/image/public/"), `${mode} deve ter imagem pública`);
    assert.equal((result.body.match(/<h1>/g) || []).length, 1, `${mode} não deve duplicar o título`);
    assert(!result.body.includes("Carregando evento…"), `${mode} não deve manter placeholder`);
    assert.equal((result.body.match(/property="og:image"/g) || []).length, 1);
    assert.equal((result.body.match(/property="og:title"/g) || []).length, 1);
    assert(result.body.includes(`https://euamourania.com.br/eventos/`));
    assert(!result.body.includes("<script>alert"), `${mode} não deve ecoar scripts do CMS`);
    if (mode === "event-main") {
      assert.match(result.body, /id="tradition-story" class="tradition-story">/);
      assert.match(result.body, /<button hidden style="display:none" class="tradition-read-more"/);
      assert(result.body.includes(longText.trim()), "história completa deve existir no HTML inicial");
    }
    if (mode === "event-edition") {
      assert.match(result.body, /id="edition-program" class="edition-rich-copy edition-program">/);
      assert.match(result.body, /<button hidden style="display:none" class="edition-read-more"/);
      assert(result.body.includes(longText.trim()), "programação completa deve existir no HTML inicial");
    }
    console.log(`✓ ${mode}: título, texto, imagem e metadados no HTML inicial`);
  }
  assert.equal(queries.filter(query => query.table === "eventos_edicoes").length, 2);
  assert.equal(queries.filter(query => query.table === "eventos").length, 1, "evento principal não deve aguardar relacionados no servidor");

  const invalid = await render("event-detail", "nao!valido");
  assert.equal(invalid.statusCode, 400);
  console.log("✓ slug inválido rejeitado");

  const hidden = await render("event-detail", "oculto");
  assert.equal(hidden.statusCode, 404);
  assert(!hidden.body.includes("Feira Livre Noturna"));
  console.log("✓ evento sem registro publicado retorna 404, sem conteúdo privado");

  const sameCityDay = { ...simple, data_inicio: "2026-10-12T03:30:00Z", data_fim: "2026-10-12T05:00:00Z" };
  assert.equal(new Date(eventHelpers.currentOccurrence(sameCityDay, new Date("2026-10-12T18:00:00Z")).data_inicio).getTime(), new Date(sameCityDay.data_inicio).getTime(),
    "recorrência semanal não deve avançar enquanto ainda for o mesmo dia em Urânia");
  assert.equal(eventHelpers.currentOccurrence(sameCityDay, new Date("2026-10-13T18:00:00Z")).data_inicio, "2026-10-19T03:30:00.000Z");
  console.log("✓ recorrência usa o dia local de Urânia, independentemente do fuso do servidor");

  const scripts = [
    "preview/agenda/evento/event-detail-preview.js",
    "preview/agenda/tradicao/tradition-preview.js",
    "preview/agenda/edicao/edition-preview.js"
  ];
  for (const file of scripts) {
    const source = readFileSync(file, "utf8");
    const renderStart = source.indexOf("async function render()");
    const branch = source.indexOf('dataset.serverRendered==="true"', renderStart);
    const clientFallback = source.indexOf("if(!publicSupabaseConfigured", branch);
    assert(renderStart > 0 && branch > renderStart && clientFallback > branch, `${file} deve priorizar conteúdo SSR`);
    assert(source.slice(branch, clientFallback).includes("return;"), `${file} deve sair antes de buscar o item principal`);
    assert(!source.slice(branch, clientFallback).includes("root.innerHTML="), `${file} não deve apagar o conteúdo SSR`);
  }
  for (const file of scripts.slice(1)) {
    const branch = readFileSync(file, "utf8").split('dataset.serverRendered==="true"')[1].split("if(!publicSupabaseConfigured")[0];
    assert(branch.includes('classList.add("is-collapsed")') && branch.includes("more.hidden=false") && branch.includes('more.style.removeProperty("display")'), `${file} deve ativar o recorte somente após a hidratação`);
  }
  console.log("✓ JavaScript público mantém o conteúdo SSR sem buscar o item principal novamente");

  const traditionTemplate = readFileSync("eventos/evento.html", "utf8");
  const editionTemplate = readFileSync("eventos/edicao.html", "utf8");
  assert(traditionTemplate.includes("<noscript><style>.tradition-story.is-collapsed{max-height:none!important"));
  assert(editionTemplate.includes("<noscript><style>.edition-program.is-collapsed{max-height:none!important"));
  console.log("✓ textos extensos permanecem integralmente visíveis sem JavaScript");
} finally {
  globalThis.fetch = originalFetch;
}
