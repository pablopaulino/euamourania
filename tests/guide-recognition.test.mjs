import assert from "node:assert/strict";
import { test } from "node:test";
import { currentGuideRecognitions } from "../assets/js/services/guideRecognition.js";

test("O guia só reconhece resultados públicos do ano com vínculo explícito", async t => {
  const year = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(new Date()));
  const result = (id, guide, changes = {}) => ({
    id, edicao_id: "edition", indicado_id: "nominee-" + id, categoria_id: "category-" + id,
    publicado: true, vencedor: true, melhores_edicoes: { ano: year },
    melhores_categorias: { nome: "Categoria " + id },
    melhores_indicados: { nome: "Mesmo nome", guia_comercial_id: guide },
    ...changes
  });
  const snapshot = (id, guide) => ({
    resultado_id: id, indicado_id: "nominee-" + id, categoria_id: "category-" + id,
    guia_comercial_id: guide, app_melhores_campanhas: { edicao_id: "edition" }
  });
  let rows = [];
  let snapshotCalls = 0;
  t.mock.method(globalThis, "fetch", async url => {
    const { pathname, searchParams } = new URL(url);
    if (pathname.endsWith("/rpc/melhores_listar_resultados_publicos")) {
      assert.equal(searchParams.get("p_somente_vencedores"), "true");
      return Response.json(rows);
    }
    assert.ok(pathname.endsWith("/app_melhores_vencedores"));
    assert.equal(searchParams.get("resultado_id"), "in.(3,4,5,6)");
    snapshotCalls++;
    return Response.json([
      snapshot(3, "b"), snapshot(3, "b"), snapshot(4, "c"), snapshot(4, "d"),
      { ...snapshot(5, "e"), indicado_id: "outro" },
      snapshot(8, "pendente"), snapshot(9, "apenas-campanha")
    ]);
  });
  assert.equal((await currentGuideRecognitions()).size, 0);
  assert.equal(snapshotCalls, 0);
  rows = [
    result(1, "a"), result(2, "a"), result(3, null), result(4, null), result(5, null), result(6, null),
    result(7, "anterior", { melhores_edicoes: { ano: year - 1 } }),
    result(8, "pendente", { publicado: false }), result(10, "segundo", { vencedor: false })
  ];
  assert.deepEqual([...await currentGuideRecognitions()], [
    ["a", { year: String(year), categories: ["Categoria 1", "Categoria 2"] }],
    ["b", { year: String(year), categories: ["Categoria 3"] }]
  ]);
  assert.equal(snapshotCalls, 1);
});
