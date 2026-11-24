import { fetchPublicRows } from "./publicDataService.js";

export async function currentGuideRecognitions() {
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date());
  const rows = await fetchPublicRows("rpc/melhores_listar_resultados_publicos", {
    p_somente_vencedores: true,
    "melhores_edicoes->>ano": `eq.${year}`,
    select: "id,edicao_id,categoria_id,indicado_id,vencedor,publicado,melhores_indicados,melhores_categorias,melhores_edicoes"
  });
  const winners = rows.filter(row => row.vencedor === true && row.publicado === true && String(row.melhores_edicoes?.ano) === year);
  const missing = winners.filter(row => !row.melhores_indicados?.guia_comercial_id);
  // The campaign can carry a manually assigned guide ID missing from the nominee.
  // It may complete a public result, but can never introduce a result of its own.
  const links = missing.length ? await fetchPublicRows("app_melhores_vencedores", {
    select: "resultado_id,indicado_id,categoria_id,guia_comercial_id,app_melhores_campanhas!inner(edicao_id)",
    resultado_id: `in.(${missing.map(row => row.id).join(",")})`,
    guia_comercial_id: "not.is.null",
    status: "eq.ativo"
  }).catch(() => []) : [];
  const byGuide = new Map();
  for (const row of winners) {
    const ids = row.melhores_indicados?.guia_comercial_id ? [row.melhores_indicados.guia_comercial_id] :
      links.filter(link => link.resultado_id === row.id && link.indicado_id === row.indicado_id &&
        link.categoria_id === row.categoria_id && link.app_melhores_campanhas?.edicao_id === row.edicao_id)
        .map(link => link.guia_comercial_id);
    const category = row.melhores_categorias?.nome;
    if (!category || !ids.length || new Set(ids).size !== 1) continue;
    const guideId = ids[0];
    if (!byGuide.has(guideId)) byGuide.set(guideId, { year, categories: [] });
    const { categories } = byGuide.get(guideId);
    if (!categories.includes(category)) categories.push(category);
  }
  return byGuide;
}
