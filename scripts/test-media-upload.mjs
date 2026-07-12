import{readFile}from"node:fs/promises";
const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const[migration,libraryMigration,pickerMigration,service,ui,styles,admin,cms,communication]=await Promise.all([
 read("supabase/migrations/20260701_cms_media_upload.sql"),
 read("supabase/migrations/20260701_cms_media_library.sql"),
 read("supabase/migrations/20260701_cms_media_picker.sql"),
 read("assets/js/services/mediaService.js"),
 read("admin/media-upload.js"),
 read("admin/media-upload.css"),
 read("admin/admin.js"),
 read("admin/cms-v2.js"),
 read("admin/comunicacao.js")
]);
must(migration.includes("'cms-media','cms-media',true,8388608"),"Bucket público ou limite de 8 MB ausente");
for(const module of["noticias","guia","turismo","eventos","comunicacao"])must(migration.includes(`when '${module}'`),`Permissão de mídia ausente: ${module}`);
must(migration.includes("tem_permissao_admin")&&!migration.includes("service_role"),"Storage não usa RBAC seguro");
must(service.includes('storage.from(BUCKET).upload')&&service.includes("crypto.randomUUID()"),"Upload não usa Storage e nome seguro");
must(service.includes("MAX_SIZE")&&service.includes("EXTENSIONS"),"Validação de tamanho ou formato ausente");
must(service.includes('from("cms_midias").insert')&&service.includes("excluirMidia"),"Biblioteca ou limpeza de mídia ausente");
must(service.includes("listarMidiasDisponiveis"),"Seletor não consulta imagens disponíveis");
for(const folder of["noticias/principais","noticias/compartilhamento","noticias/conteudo","guia","turismo","eventos","comunicacao/newsletters"])must(ui.includes(`"${folder}"`),`Interface sem upload para ${folder}`);
must(ui.includes("insertEmbed")&&ui.includes("Prévia da imagem"),"Upload no editor ou prévia ausente");
for(const feature of["Ajustar enquadramento","data-crop-zoom","data-rotate","canvasBlob","Guardar o arquivo original por 7 dias"])must(ui.includes(feature),`Editor de imagem incompleto: ${feature}`);
must(ui.includes("Biblioteca de mídia")&&ui.includes("data-media-clean"),"Limpeza segura não aparece no painel");
for(const feature of["Escolher da biblioteca","Criar outro formato","Editar / outro formato","openLibraryPicker"])must(ui.includes(feature),`Reaproveitamento de mídia incompleto: ${feature}`);
for(const feature of['document.body.style.overflow="hidden"','event.key==="Escape"','event.target===modal','await onSelect(item.url)','data-library-count'])must(ui.includes(feature),`Seletor de mídia sem comportamento esperado: ${feature}`);
for(const feature of["grid-template-rows:auto auto minmax(0,1fr) auto","overflow-y:auto","display:flex!important","flex-wrap:wrap!important","flex:0 1 calc(25% - .75rem)!important",".cms-library-picker-card>img","height:150px!important",".cms-media-button{display:inline-flex;flex:1 1 0"])must(styles.includes(feature),`Layout da biblioteca incompleto: ${feature}`);
must(libraryMigration.includes("midia_cms_em_uso")&&libraryMigration.includes("elegivel_limpeza")&&libraryMigration.includes("interval '7 days'"),"Banco não protege mídias usadas ou originais recentes");
must(pickerMigration.includes('using(public.is_admin())'),"Biblioteca compartilhada não respeita autenticação administrativa");
must(admin.includes('import("./media-upload.js")')&&communication.includes('import "./media-upload.js"'),"Módulo de upload não carregado no CMS");
must(admin.includes('querySelectorAll(".admin-nav button")')&&cms.includes('querySelectorAll(".admin-nav button")'),"Menu administrativo pode manter duas seções ativas");
must(admin.includes('inputType=type==="url"?"text":type')&&admin.includes("validSiteReference(value)"),"Formulários do CMS não aceitam caminhos internos de assets");
must(ui.includes("/^(?:https?:\\/\\/|\\/?assets\\/)"),"Prévia do CMS não aceita imagens internas de assets");
for(const file of[await read("assets/js/pages/turismo-page.js"),await read("assets/js/pages/turismo-details-page.js")])must(file.includes("/^\\/?assets\\//"),"Turismo público não aceita /assets nas imagens");
console.log("Upload de imagens validado: Storage, RBAC, formatos, módulos, prévia e editor.");
