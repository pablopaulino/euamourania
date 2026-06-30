import{readFile}from"node:fs/promises";
const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const[migration,admin,analytics,index,docs]=await Promise.all([
 read("supabase/migrations/20260630_fluxo_editorial_audiencia.sql"),
 read("admin/editorial-audience.js"),
 read("assets/js/pages/analytics-page.js"),
 read("admin/admin.js"),
 read("DOCS/FLUXO-EDITORIAL-E-AUDIENCIA.md")
]);
for(const status of["rascunho","em_revisao","ajustes_solicitados","aprovado"])must(migration.includes(`'${status}'`),`Status editorial ausente: ${status}`);
for(const fn of["enviar_noticia_revisao","revisar_noticia","obter_audiencia_avancada"])must(migration.includes(`function public.${fn}`),`RPC ausente: ${fn}`);
must(migration.includes("noticias_publicacao_aprovada_check"),"Publicação não exige aprovação");
must(migration.includes("current_user in('anon','authenticated')"),"Estado editorial pode ser alterado diretamente");
must(migration.includes("criado_por is distinct from (select auth.uid())"),"Redator sem proteção de propriedade");
must(admin.includes("Fila de aprovação")&&admin.includes("Aprovar e publicar"),"Fila editorial incompleta");
must(admin.includes("Exportar CSV")&&admin.includes("Central de audiência"),"Dashboard de audiência incompleto");
must(analytics.includes("sessionStorage")&&!analytics.includes("ip:"),"Rastreamento não preserva privacidade");
must(index.includes('import("./editorial-audience.js")'),"Módulo administrativo não carregado");
must(docs.includes("não grava IP"),"Documentação de privacidade ausente");
console.log("Fluxo editorial e audiência validados: banco, RLS, painel, privacidade e documentação.");
