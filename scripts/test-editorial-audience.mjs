import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [
  migration,
  directMigration,
  auditMigration,
  admin,
  cms,
  analytics,
  index,
  categoryFields,
  guide,
  docs,
  auditDocs
] = await Promise.all([
  read("supabase/migrations/20260630_fluxo_editorial_audiencia.sql"),
  read("supabase/migrations/20260701_super_admin_publicacao_direta.sql"),
  read("supabase/migrations/20260630_auditoria_categorias_metricas.sql"),
  read("admin/editorial-audience.js"),
  read("admin/cms-v2.js"),
  read("assets/js/pages/analytics-page.js"),
  read("admin/admin.js"),
  read("admin/category-fields.js"),
  read("assets/js/pages/guia-page.js"),
  read("DOCS/FLUXO-EDITORIAL-E-AUDIENCIA.md"),
  read("DOCS/AUDITORIA-PAINEL-METRICAS.md")
]);

for (const status of ["rascunho", "em_revisao", "ajustes_solicitados", "aprovado"]) {
  must(migration.includes(`'${status}'`), `Status editorial ausente: ${status}`);
}
for (const fn of ["enviar_noticia_revisao", "revisar_noticia", "obter_audiencia_avancada"]) {
  must(migration.includes(`function public.${fn}`), `RPC ausente: ${fn}`);
}

must(migration.includes("noticias_publicacao_aprovada_check"), "Publicacao nao exige aprovacao");
must(migration.includes("current_user in('anon','authenticated')"), "Estado editorial pode ser alterado diretamente");
must(migration.includes("criado_por is distinct from (select auth.uid())"), "Redator sem protecao de propriedade");
must(directMigration.includes("publicar_noticia_super_admin") && directMigration.includes("funcao_admin_atual()<>'super_admin'"), "Publicacao direta nao esta restrita ao Super Admin");
must(directMigration.includes("before insert or update") && directMigration.includes("status_editorial<>'rascunho'"), "Insert pode contornar o fluxo editorial");
must(directMigration.includes("impedir_autorrevisao_noticia") && directMigration.includes("old.enviado_por=(select auth.uid())"), "Editor pode aprovar a propria materia");

must(admin.includes('funcao==="super_admin"') && admin.includes("Publicar agora") && admin.includes("Aguardando outro revisor"), "Interface nao diferencia Super Admin e revisores");
must(cms.includes('import { obterAcessoAtual }') && cms.includes('rpc("publicar_noticia_super_admin"') && cms.includes("Notícia publicada diretamente."), "Editor nao usa a publicacao direta segura");
must(admin.includes('news?.criado_por===access()?.user?.id&&state==="em_revisao"'), "Autor nao fica bloqueado durante a revisao");
must(admin.includes("Fila de aprovação") && admin.includes("Aprovar e publicar"), "Fila editorial incompleta");

must(admin.includes("Exportar CSV") && admin.includes("Central de audiência"), "Dashboard de audiencia incompleto");
must(admin.includes("completeDailySeries") && admin.includes("audience-bar-value") && admin.includes("data-chart-bar"), "Grafico diario sem valores visiveis ou interacao movel");
must(analytics.includes("sessionStorage") && !analytics.includes("ip:"), "Rastreamento nao preserva privacidade");
must(analytics.includes("noticiaView();") && analytics.includes('window.addEventListener("noticia:renderizada",noticiaView'), "Visualizacao de noticia depende apenas do evento tardio");
must(analytics.includes("observePublicCards") && analytics.includes('observeCards("[data-guide-id]"') && analytics.includes('observeCards("[data-tourism-id]"'), "Cards publicos nao sao observados quando a audiencia carrega depois");
must(!cms.includes("obterMaisAcessados") && cms.includes("rankingPorEventos") && cms.includes('tipo==="page_view"'), "Estatisticas antigas ainda misturam contador acumulado com eventos por periodo");
must(!cms.includes("Ver audiência") && !cms.includes("Acessos 30d") && cms.includes("news-editorial-list"), "Lista de noticias deve manter foco editorial, sem bloco de audiencia");
must(admin.includes("mergeNewsPageViews") && admin.includes('match(/^\\/noticias\\/'), "Conteudos mais acessados nao conciliam page_view de noticias por URL");

for (const event of ["guia_click", "turismo_click", "link_click"]) {
  must(auditMigration.includes(`'${event}'`) && analytics.includes(`"${event}"`), `Metrica ausente: ${event}`);
}
must(auditMigration.includes("update public.turismo set visualizacoes=visualizacoes+1"), "Turismo sem contador de visualizacoes");
must(categoryFields.includes("cms_categoria_id") && guide.includes('fetchPublicRows("categorias"') && guide.includes('tipo:"eq.guia"'), "Categorias nao estao integradas aos conteudos e filtros publicos");
must(index.includes('import("./editorial-audience.js")'), "Modulo administrativo nao carregado");
must(index.includes('import("./category-fields.js")'), "Campos de categoria nao carregados no CMS");
must(docs.includes("não grava IP"), "Documentacao de privacidade ausente");
must(auditDocs.includes("Origem oficial dos dados") && auditDocs.includes("noticia_view") && auditDocs.includes("Google Analytics 4"), "Documentacao da auditoria de metricas ausente ou incompleta");

console.log("Fluxo editorial e audiencia validados: banco, RLS, painel, privacidade, metricas e documentacao.");
