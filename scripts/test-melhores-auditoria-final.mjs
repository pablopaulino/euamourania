import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const must = (condition, message) => {
  if (!condition) {
    console.error(`Falhou: ${message}`);
    process.exit(1);
  }
};

const migration = read("supabase/migrations/20260712_melhores_urania_auditoria_final.sql");
const rollback = read("supabase/rollbacks/20260712_melhores_urania_auditoria_final_rollback.sql");
const service = read("assets/js/services/melhoresService.js");
const publicService = read("assets/js/services/melhoresPublicService.js");
const adminHtml = read("admin/melhores.html");
const adminJs = read("admin/melhores.js");
const voteApi = read("api/melhores-votar.js");
const indicationApi = read("api/melhores-indicar.js");
const sitemap = read("api/sitemaps.js");
const editionJs = read("assets/js/pages/melhores-edicao-page.js");
const analyticsJs = read("assets/js/services/melhoresAnalyticsService.js");
const pkg = JSON.parse(read("package.json"));

must(migration.includes("melhores_validar_limite_finalistas"), "Migração deve validar limite de finalistas no banco");
must(migration.includes("limite_indicados set default 4"), "Migração deve definir quatro finalistas como padrão");
must(migration.includes("resultado_publicado_em") && migration.includes("7 dias apos publicacao oficial"), "Retenção deve priorizar publicação oficial");
must(migration.includes("melhores_limpar_votos_edicao_manual") && migration.includes("public.is_super_admin()"), "Limpeza manual deve ser exclusiva para Super Admin");
must(migration.includes("drop index if exists public.melhores_votos_um_valido_por_categoria_uidx"), "Migração deve remover bloqueio antigo de voto único rígido");
must(migration.includes("melhores_votos_um_valido_por_indicado_uidx"), "Migração deve impedir voto duplicado no mesmo indicado");
must(rollback.includes("melhores_votos_um_valido_por_categoria_uidx") && rollback.includes("drop function if exists public.melhores_limpar_votos_edicao_manual"), "Rollback deve desfazer regras novas");

must(service.includes('update({ status: "arquivada" })'), "Edições devem usar soft delete/arquivamento");
must(service.includes('update({ status: "arquivado", visibilidade_publica: false })'), "Categorias devem arquivar sem apagar histórico");
must(service.includes('update({ status: "arquivado", aprovado: false })'), "Indicados devem arquivar sem apagar histórico");
must(service.includes("listarVotos") && service.includes("listarAuditoria") && service.includes("limparVotosManual"), "Serviço admin deve expor votos, auditoria e limpeza manual");

for (const tab of ['data-tab="votes"', 'data-tab="audit"', 'data-tab="settings"']) {
  must(adminHtml.includes(tab), `Painel deve ter aba ${tab}`);
}
must(adminJs.includes("loadVotes") && adminJs.includes("loadAudit") && adminJs.includes("loadSettings"), "Painel deve carregar abas novas com dados reais");
must(adminJs.includes("data-manual-cleanup-votes") && adminJs.includes("limparVotosManual"), "Painel deve acionar limpeza manual protegida");

must(voteApi.includes("permite_multiplos_votos") && voteApi.includes("max_escolhas"), "API de voto deve respeitar voto único/múltiplo");
must(voteApi.includes("previousVotes") && voteApi.includes("Você já atingiu o limite"), "API deve bloquear votos acima do limite");
must(editionJs.includes("votesFor") && editionJs.includes("data-max-choices"), "Frontend deve suportar múltiplas escolhas por categoria");

must(publicService.includes("obterCategoriaPublica") && publicService.includes("listarIndicadosPorCategoria"), "Serviço público deve carregar página de categoria");
for (const file of ["melhores-de-urania/categoria.html", "melhores-de-urania/regulamento.html", "melhores-de-urania/metodologia.html", "assets/js/pages/melhores-categoria-page.js", "assets/js/pages/melhores-regulamento-page.js", "assets/js/pages/melhores-metodologia-page.js"]) {
  must(fs.existsSync(path.join(root, file)), `Arquivo público ausente: ${file}`);
}
must(sitemap.includes("melhoresCategoriasRows") && sitemap.includes("/regulamento/") && sitemap.includes("/metodologia/"), "Sitemap deve incluir categorias, regulamento e metodologia");
must(read("vercel.json").includes("/melhores-de-urania/:ano/categorias/:categoria"), "Vercel deve ter rewrite para categoria pública");
must(pkg.scripts["test:melhores-auditoria-final"], "package.json deve expor test:melhores-auditoria-final");
must(pkg.scripts.test.includes("test-melhores-auditoria-final.mjs"), "npm test deve incluir auditoria final");

console.log("Auditoria final do Melhores de Urânia validada.");
