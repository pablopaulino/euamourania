import{readFile}from"node:fs/promises";
const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const[migration,directMigration,auditMigration,admin,cms,analytics,index,categoryFields,guide,docs]=await Promise.all([
 read("supabase/migrations/20260630_fluxo_editorial_audiencia.sql"),
 read("supabase/migrations/20260701_super_admin_publicacao_direta.sql"),
 read("supabase/migrations/20260630_auditoria_categorias_metricas.sql"),
 read("admin/editorial-audience.js"),
 read("admin/cms-v2.js"),
 read("assets/js/pages/analytics-page.js"),
 read("admin/admin.js"),
 read("admin/category-fields.js"),
 read("assets/js/pages/guia-page.js"),
 read("DOCS/FLUXO-EDITORIAL-E-AUDIENCIA.md")
]);
for(const status of["rascunho","em_revisao","ajustes_solicitados","aprovado"])must(migration.includes(`'${status}'`),`Status editorial ausente: ${status}`);
for(const fn of["enviar_noticia_revisao","revisar_noticia","obter_audiencia_avancada"])must(migration.includes(`function public.${fn}`),`RPC ausente: ${fn}`);
must(migration.includes("noticias_publicacao_aprovada_check"),"Publicação não exige aprovação");
must(migration.includes("current_user in('anon','authenticated')"),"Estado editorial pode ser alterado diretamente");
must(migration.includes("criado_por is distinct from (select auth.uid())"),"Redator sem proteção de propriedade");
must(directMigration.includes("publicar_noticia_super_admin")&&directMigration.includes("funcao_admin_atual()<>'super_admin'"),"Publicação direta não está restrita ao Super Admin");
must(directMigration.includes("before insert or update")&&directMigration.includes("status_editorial<>'rascunho'"),"Insert pode contornar o fluxo editorial");
must(directMigration.includes("impedir_autorrevisao_noticia")&&directMigration.includes("old.enviado_por=(select auth.uid())"),"Editor pode aprovar a própria matéria");
must(admin.includes('funcao==="super_admin"')&&admin.includes("Publicar agora")&&admin.includes("Aguardando outro revisor"),"Interface não diferencia Super Admin e revisores");
must(cms.includes('import { obterAcessoAtual }')&&cms.includes('rpc("publicar_noticia_super_admin"')&&cms.includes("Notícia publicada diretamente."),"Editor não usa a publicação direta segura");
must(admin.includes('news?.criado_por===access()?.user?.id&&state==="em_revisao"'),"Autor não fica bloqueado durante a revisão");
must(admin.includes("Fila de aprovação")&&admin.includes("Aprovar e publicar"),"Fila editorial incompleta");
must(admin.includes("Exportar CSV")&&admin.includes("Central de audiência"),"Dashboard de audiência incompleto");
must(admin.includes("completeDailySeries")&&admin.includes("audience-bar-value")&&admin.includes("data-chart-bar"),"Gráfico diário sem valores visíveis ou interação móvel");
must(analytics.includes("sessionStorage")&&!analytics.includes("ip:"),"Rastreamento não preserva privacidade");
for(const event of["guia_click","turismo_click","link_click"])must(auditMigration.includes(`'${event}'`)&&analytics.includes(`"${event}"`),`Métrica ausente: ${event}`);
must(auditMigration.includes("update public.turismo set visualizacoes=visualizacoes+1"),"Turismo sem contador de visualizações");
must(categoryFields.includes("cms_categoria_id")&&guide.includes('fetchPublicRows("categorias"')&&guide.includes('tipo:"eq.guia"'),"Categorias não estão integradas aos conteúdos e filtros públicos");
must(index.includes('import("./editorial-audience.js")'),"Módulo administrativo não carregado");
must(index.includes('import("./category-fields.js")'),"Campos de categoria não carregados no CMS");
must(docs.includes("não grava IP"),"Documentação de privacidade ausente");
console.log("Fluxo editorial e audiência validados: banco, RLS, painel, privacidade e documentação.");
