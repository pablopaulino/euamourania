import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderResults, resultsArePublished, winnerCard } from "../assets/js/pages/melhores-resultados-page.js";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20261010_melhores_integridade_historico.sql");
const publicService = read("assets/js/services/melhoresPublicService.js");
const adminService = read("assets/js/services/melhoresService.js");
const admin = read("admin/melhores.js");
const social = read("lib/social-page.js");
const sitemap = read("api/sitemaps.js");
const routes = read("vercel.json");
const preview = read("preview/melhores/awards-preview.js");
const demo = read("preview/melhores/awards-demo.js");
const { metadata, inject } = createRequire(import.meta.url)("../lib/social-page.js")._test;

for (const fragment of [
  "melhores_listar_resultados_publicos",
  "mostrar_votos_publicamente",
  "melhores_proteger_historico",
  "Resultado ja publicado: o historico nao pode ser republicado",
  "nao possui votos validos para publicar",
  "desempate_vencedor_id",
  "create table if not exists public.melhores_desempates",
  "revoke all on public.melhores_desempates from public, anon, authenticated",
  "melhores_consta_em_resultado_publicado",
  "before insert or update or delete on public.melhores_categorias",
  "before insert or update or delete on public.melhores_indicados",
  "'indicacoes_encerradas'",
  "'apuracao'"
]) assert.ok(migration.includes(fragment), `Migration sem proteção: ${fragment}`);

assert.ok(publicService.includes("rpc/melhores_listar_resultados_publicos"), "O site deve ler a RPC pública sanitizada.");
assert.ok(adminService.includes('.from("melhores_desempates")'), "A escolha de desempate deve ficar restrita ao painel.");
assert.ok(!migration.includes("add column if not exists desempate_vencedor_id"), "A escolha do vencedor não pode ser coluna pública da categoria.");
assert.ok(!migration.includes("c.desempate_vencedor_id"), "A publicação não pode depender de uma coluna pública de desempate.");
assert.ok(migration.includes("v_vinculo_id := old.categoria_id;") && migration.includes("v_vinculo_id := old.id;"), "O trigger deve resolver a chave conforme a tabela, sem acessar campos inexistentes.");
assert.ok(migration.includes("- 'votos_individuais_limpos_em'"), "A limpeza de votos deve continuar permitida após publicar a edição.");
assert.ok(admin.includes("Histórico preservado") && admin.includes("desempate_vencedor_id"), "Painel sem proteção/registro do desempate.");
assert.ok(social.includes('"award-hall"') && social.includes('"award-winner"'), "Metadados iniciais do Hall/perfil ausentes.");
assert.ok(sitemap.includes("melhoresVencedoresUrls"), "Perfis publicados ausentes do sitemap.");
assert.ok(routes.includes("mode=award-hall") && routes.includes("mode=award-winner"), "Rotas do Hall/perfil ausentes.");
assert.ok(preview.includes('"hall","winner"') && demo.includes('demoPage === "hall"') && demo.includes('demoPage === "winner"'), "Prévias isoladas do Hall/perfil ausentes.");

const nomineeId = "11111111-1111-4111-8111-111111111111";
const edition = { ano: 2026, status: "resultado_publicado", resultado_publicado_em: "2026-12-01T18:00:00Z", mostrar_votos_publicamente: false };
const result = {
  id: "22222222-2222-4222-8222-222222222222",
  edicao_id: "33333333-3333-4333-8333-333333333333",
  categoria_id: "44444444-4444-4444-8444-444444444444",
  indicado_id: nomineeId,
  colocacao: 1,
  vencedor: true,
  votos_site: 123,
  votos_instagram: 45,
  publicado_em: "2026-12-01T18:00:00Z",
  melhores_categorias: { nome: "Melhor comércio" },
  melhores_indicados: { nome: "Empresa exemplo", imagem_url: null, descricao_curta: "Descrição", guia_comercial_id: null }
};

assert.equal(resultsArePublished({ ...edition, status: "apuracao" }, [result]), false);
assert.equal(resultsArePublished(edition, []), false);
assert.equal(resultsArePublished(edition, [{ ...result, vencedor: false }]), false);
assert.equal(resultsArePublished(edition, [result]), true);
const privateHtml = renderResults([result], edition);
assert.ok(!privateHtml.includes("123 votos") && !privateHtml.includes('class="awards-ranking-score"'), "Votos privados vazaram no ranking.");
const publicHtml = renderResults([result], { ...edition, mostrar_votos_publicamente: true });
assert.ok(publicHtml.includes("168 votos"), "Votos públicos não aparecem quando autorizados.");
assert.ok(winnerCard(result, new Map(), edition).includes(`/vencedores/${nomineeId}/`), "Card não abre o perfil individual do vencedor.");

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async url => ({
    ok: true,
    json: async () => String(url).includes("/melhores_edicoes?")
      ? [{ ...edition, id: result.edicao_id, nome: "Melhores de Urânia 2026", status: "apuracao", imagem_capa_url: null }]
      : []
  });
  const unpublished = await metadata("award-results", "2026", "");
  assert.equal(unpublished.noindex, true, "Resultado em apuração não deve ser indexado.");
  assert.match(inject(read("melhores-de-urania/resultados.html"), unpublished), /name="robots" content="noindex,follow"/);

  globalThis.fetch = async url => ({
    ok: true,
    json: async () => String(url).includes("/melhores_edicoes?")
      ? [{ ...edition, id: result.edicao_id, nome: "Melhores de Urânia 2026", imagem_capa_url: null }]
      : String(url).includes("/rpc/melhores_listar_resultados_publicos?")
        ? [{ ...result, melhores_indicados: { ...result.melhores_indicados, imagem_url: "https://example.org/vencedor.jpg" } }]
        : []
  });
  const winner = await metadata("award-winner", "2026", nomineeId);
  const winnerHtml = inject(read("melhores-de-urania/vencedor.html"), winner);
  assert.equal(winner.noindex, false, "Perfil publicado deve ser indexável.");
  assert.equal(winner.image, "https://example.org/vencedor.jpg", "Prévia social deve usar a imagem do vencedor.");
  assert.equal((winnerHtml.match(/property="og:image"/g) || []).length, 1, "HTML inicial não pode duplicar og:image.");
  assert.match(winnerHtml, /melhores-de-urania\/2026\/vencedores\/11111111-1111-4111-8111-111111111111\//);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Melhores de Urânia: privacidade, integridade histórica, Hall e perfis validados estruturalmente.");
