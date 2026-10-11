import { readFileSync } from "node:fs";

const must = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260712_melhores_urania_fase3_apuracao.sql");
const service = read("assets/js/services/melhoresService.js");
const adminHtml = read("admin/melhores.html");
const adminJs = read("admin/melhores.js");
const publicService = read("assets/js/services/melhoresPublicService.js");
const resultsHtml = read("melhores-de-urania/resultados.html");
const publicRenderer = read("preview/melhores/awards-preview.js");
const demoRenderer = read("preview/melhores/awards-demo.js");
const resultsJs = read("assets/js/pages/melhores-resultados-page.js");
const indexJs = read("assets/js/pages/melhores-index-page.js");
const editionJs = read("assets/js/pages/melhores-edicao-page.js");
const vercel = read("vercel.json");
const sitemap = read("api/sitemaps.js");
const docs = read("DOCS/MELHORES-DE-URANIA.md");

for (const required of [
  "create table if not exists public.melhores_instagram_votos",
  "unique(edicao_id, categoria_id, indicado_id)",
  "melhores_instagram_indicado_mesma_categoria_fk",
  "alter table public.melhores_instagram_votos enable row level security",
  "create or replace view public.melhores_apuracao_previa",
  "percentual_site",
  "percentual_instagram",
  "pontuacao_final",
  "dense_rank()",
  "create or replace function public.melhores_obter_apuracao",
  "create or replace function public.melhores_publicar_resultado",
  "delete from public.melhores_resultados where edicao_id=p_edicao",
  "status='resultado_publicado'",
  "perform public.melhores_consolidar_edicao(p_edicao)"
]) {
  must(migration.includes(required), `Migração da Fase 3 sem requisito: ${required}`);
}

for (const fn of [
  "listarInstagramVotos",
  "salvarInstagramVoto",
  "excluirInstagramVoto",
  "obterApuracao",
  "publicarResultado",
  "listarResultados"
]) {
  must(service.includes(`export async function ${fn}`), `Serviço admin sem ${fn}`);
  must(adminJs.includes(fn), `Painel admin não usa ${fn}`);
}

for (const tab of ["instagram", "apuration", "results"]) {
  must(adminHtml.includes(`data-tab="${tab}"`) && adminHtml.includes(`${tab}-view`), `Aba admin ausente: ${tab}`);
}

must(adminJs.includes("Votos do Instagram") && adminJs.includes("Revisar e publicar resultado"), "Painel admin sem fluxo de Instagram/apuração");
must(publicService.includes("listarResultadosPublicos"), "Serviço público sem resultados oficiais");
must(resultsHtml.includes("awards-preview.js") && publicRenderer.includes('results:"melhores-resultados-page.js"'), "Página pública de resultados ausente");
must(resultsJs.includes("listarResultadosPublicos") && publicService.includes("rpc/melhores_listar_resultados_publicos"), "Página de resultados não consome a leitura pública sanitizada do snapshot oficial");
must(publicRenderer.includes('demoMode?"/preview/melhores/awards-demo.js"'), "Prévia demonstrativa não está isolada da página pública");
must(demoRenderer.includes("renderHub") && demoRenderer.includes("renderResults") && !demoRenderer.includes("enviarVotoMelhores"), "Prévia deve reutilizar a apresentação sem enviar votos");
must(publicService.includes('"resultado_publicado"') && publicService.includes('"arquivada"'), "Edições arquivadas precisam continuar no histórico público");
must(indexJs.includes('action: "Ver resultados"') && indexJs.includes("resultsUrl(edition)"), "Histórico anual precisa abrir os resultados da edição");
must(editionJs.includes('edition.status === "resultado_publicado" || (edition.status === "arquivada" && edition.resultado_publicado_em)'), "Edição arquivada com resultado precisa manter acesso aos resultados");
must(resultsJs.includes("awards-winner-initial") && resultsJs.includes('resultsList.addEventListener("error"'), "Card do vencedor precisa de fallback para imagem ausente ou quebrada");
must(vercel.includes("/melhores-de-urania/:ano/resultados"), "Rewrite de resultados ausente");
must(sitemap.includes("/resultados/"), "Sitemap não inclui resultados publicados");
must(docs.includes("Fase 3") && docs.includes("melhores_instagram_votos") && docs.includes("pontuação_final"), "Documentação da Fase 3 incompleta");

console.log("Melhores de Urânia Fase 3 validado: Instagram, apuração, resultado oficial e página pública.");
