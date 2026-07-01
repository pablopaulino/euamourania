import{readFile}from"node:fs/promises";
const root=new URL("../",import.meta.url),read=path=>readFile(new URL(path,root),"utf8");
const must=(condition,message)=>{if(!condition)throw new Error(message)};
const[template,importer]=await Promise.all([
 read("modelos/guia-comercial-modelo.json"),
 read("admin/migrar.js")
]);
const parsed=JSON.parse(template);
must(parsed.tipo==="guia_comercial"&&Array.isArray(parsed.itens),"Modelo JSON inválido");
for(const field of["nome","categoria","descricao","imagem_url","whatsapp","telefone","instagram","facebook","site","endereco","horario","mapa_url","recomendado","status","seo_titulo","seo_descricao"])must(field in parsed.itens[0],`Campo ausente no modelo: ${field}`);
for(const feature of["guide-json-file","renderGuidePreview","ensureGuideCategories","upsert(payload.slice","onConflict:\"slug\"","Baixar modelo JSON"])must(importer.includes(feature),`Importador incompleto: ${feature}`);
must(importer.includes("rows.length>1000")&&importer.includes("file.size>2*1024*1024"),"Importador sem limites de segurança");
console.log("Importação do Guia validada: modelo, prévia, categorias, lotes e atualização por slug.");
