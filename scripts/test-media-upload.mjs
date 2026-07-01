import{readFile}from"node:fs/promises";
const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const[migration,service,ui,admin,communication]=await Promise.all([
 read("supabase/migrations/20260701_cms_media_upload.sql"),
 read("assets/js/services/mediaService.js"),
 read("admin/media-upload.js"),
 read("admin/admin.js"),
 read("admin/comunicacao.js")
]);
must(migration.includes("'cms-media','cms-media',true,8388608"),"Bucket público ou limite de 8 MB ausente");
for(const module of["noticias","guia","turismo","eventos","comunicacao"])must(migration.includes(`when '${module}'`),`Permissão de mídia ausente: ${module}`);
must(migration.includes("tem_permissao_admin")&&!migration.includes("service_role"),"Storage não usa RBAC seguro");
must(service.includes('storage.from(BUCKET).upload')&&service.includes("crypto.randomUUID()"),"Upload não usa Storage e nome seguro");
must(service.includes("MAX_SIZE")&&service.includes("EXTENSIONS"),"Validação de tamanho ou formato ausente");
for(const folder of["noticias/principais","noticias/compartilhamento","noticias/conteudo","guia","turismo","eventos","comunicacao/newsletters"])must(ui.includes(`"${folder}"`),`Interface sem upload para ${folder}`);
must(ui.includes("insertEmbed")&&ui.includes("Prévia da imagem"),"Upload no editor ou prévia ausente");
must(admin.includes('import("./media-upload.js")')&&communication.includes('import "./media-upload.js"'),"Módulo de upload não carregado no CMS");
console.log("Upload de imagens validado: Storage, RBAC, formatos, módulos, prévia e editor.");
