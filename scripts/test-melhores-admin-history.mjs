import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/services/melhoresService.js", import.meta.url), "utf8");
let result = { data: [], error: null };
let selection;
const context = vm.createContext({
  getSupabase: () => ({ from: () => ({ select(value) {
    selection = value;
    return { order: async () => result };
  } }) })
});
vm.runInContext(source.replace(/^import .*;\r?\n/, "").replace(/^export /gm, ""), context);
const historical = context.edicaoTemHistoricoOficial;
const edition = { status: "indicacoes_abertas", resultado_publicado_em: "2026-07-30T03:09:25Z" };
assert.equal(historical({ ...edition, tem_resultados_publicados: false }), false);
assert.equal(historical({ ...edition, tem_resultados_publicados: true }), true);
assert.equal(historical(edition), true, "Unknown results must retain the lock");
for (const status of ["resultado_publicado", "arquivada"]) {
  assert.equal(historical({ status, tem_resultados_publicados: false }), true);
}
result.data = [
  { ...edition, melhores_resultados: [] },
  { ...edition, melhores_resultados: [{ publicado: false }] },
  { ...edition, melhores_resultados: [{ publicado: true }] }
];
const editions = await context.listarEdicoes();
assert.equal(selection, "*, melhores_resultados(publicado)");
assert.deepEqual(Array.from(editions, historical), [false, false, true]);
assert.ok(editions.every(item => !('melhores_resultados' in item)));
result = { data: null, error: new Error("Permission denied") };
await assert.rejects(context.listarEdicoes(), /Permission denied/);
console.log("Admin do prêmio: data antiga não bloqueia edição sem resultados; histórico e falhas de consulta protegidos — OK");
