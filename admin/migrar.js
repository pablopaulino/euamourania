import { exigirAdministrador } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { gerarSlug } from "../assets/js/utils.js";

const status = document.getElementById("migration-status");
const button = document.getElementById("run-migration");
const linksIniciais = [["Nosso site","https://euamourania.com.br/","🌐"],["Canal WhatsApp","https://whatsapp.com/channel/0029VapPdlLGpLHTXQELk210","💬"],["WhatsApp","https://wa.me/5517976005583","📱"],["YouTube","https://www.youtube.com/@EuAmoUr%C3%A2nia","▶️"],["Instagram","https://instagram.com/euamourania","📷"],["Facebook","https://facebook.com/euamourania","👥"],["X (Twitter)","https://x.com/euamourania","𝕏"],["TikTok","https://tiktok.com/@euamourania","🎵"]].map(([titulo,url,icone],ordem)=>({titulo,url,icone,ordem,status:"ativo"}));
const textoPuro = (html = "") => { const el=document.createElement("div"); el.innerHTML=html; return (el.textContent||"").replace(/\s+/g," ").trim(); };

async function lerJson(caminho) {
  const response = await fetch(caminho, { cache: "no-store" });
  if (!response.ok) throw new Error(`Não foi possível ler ${caminho}.`);
  const texto = await response.text();
  try { return JSON.parse(texto); }
  catch { return JSON.parse(texto.replace(/,\s*]/g, "]")); }
}

async function migrar() {
  button.disabled=true; status.textContent="Lendo os dados e preparando a importação…"; const supabase=getSupabase();
  try {
    const [noticiasAntigas,guiaAntigo]=await Promise.all([lerJson("../news-data.json"),lerJson("../guia-data.json")]);
    const noticias=noticiasAntigas.map(item=>{const resumo=textoPuro(item.content).slice(0,240);return{titulo:item.title,slug:gerarSlug(item.title),resumo,conteudo_html:item.content||"",imagem_url:item.image||null,categoria_nome:"Notícias",autor:(item.author||"Equipe Eu Amo Urânia").replace(/^\s*Por\s+/i,""),status:"publicado",destaque:item.id===1,publicado_em:item.date?`${item.date}T12:00:00-03:00`:new Date().toISOString(),seo_titulo:item.title,seo_descricao:resumo.slice(0,160)}});
    const guia=guiaAntigo.map(item=>({nome:item.nome,slug:gerarSlug(item.nome),categoria_nome:item.categoria||"outros",descricao:item.descricao||"",imagem_url:item.imagem||null,whatsapp:item.whatsapp||null,instagram:item.instagram||null,endereco:item.endereco||null,recomendado:Boolean(item.destaque),status:"publicado",seo_titulo:item.nome,seo_descricao:textoPuro(item.descricao||"").slice(0,160)}));
    const turismo=guiaAntigo.filter(item=>item.categoria==="turismo").map(item=>({nome:item.nome,slug:gerarSlug(item.nome),descricao:item.descricao||"",conteudo_html:item.descricao?`<p>${item.descricao}</p>`:"",imagem_url:item.imagem||null,endereco:item.endereco||null,whatsapp:item.whatsapp||null,status:"publicado",destaque:Boolean(item.destaque),seo_titulo:`${item.nome} | Turismo em Urânia`,seo_descricao:textoPuro(item.descricao||"").slice(0,160)}));
    const categorias=[{nome:"Notícias",slug:"noticias",tipo:"noticias",ordem:0,status:"ativo"},...[...new Set(guiaAntigo.map(item=>item.categoria).filter(Boolean))].map((nome,ordem)=>({nome,slug:gerarSlug(nome),tipo:"guia",ordem,status:"ativo"})),{nome:"Pontos turísticos",slug:"pontos-turisticos",tipo:"turismo",ordem:0,status:"ativo"}];
    for(const [tabela,dados] of [["noticias",noticias],["guia_comercial",guia],["turismo",turismo],["categorias",categorias]]){const{error}=await supabase.from(tabela).upsert(dados,{onConflict:"slug"});if(error)throw new Error(`${tabela}: ${error.message}`)}
    const{data:linksAtuais,error:linksError}=await supabase.from("links").select("url");if(linksError)throw linksError;const urlsAtuais=new Set((linksAtuais||[]).map(item=>item.url));const linksNovos=linksIniciais.filter(item=>!urlsAtuais.has(item.url));if(linksNovos.length){const{error}=await supabase.from("links").insert(linksNovos);if(error)throw error}
    status.innerHTML=`<strong>Migração concluída.</strong><br>${noticias.length} notícias, ${guia.length} itens do guia, ${turismo.length} ponto turístico e ${linksIniciais.length} links conferidos.`;button.textContent="Executar novamente";
  } catch(error){console.error(error);status.textContent=`Falha na migração: ${error.message}`}
  finally{button.disabled=false}
}

const acesso=await exigirAdministrador();
if(acesso?.configurado){document.getElementById("admin-name").textContent=acesso.admin.nome||acesso.user.email;button.addEventListener("click",migrar);status.textContent="Pronto para importar os arquivos antigos. A operação é segura para repetir."}

const importState={itens:[],arquivo:null};
const esc=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const onlyUrl=value=>{
  const text=String(value||"").trim();if(!text)return null;
  try{const url=new URL(text);return["http:","https:"].includes(url.protocol)?url.href:null}catch{return null}
};
const optional=value=>{const text=String(value??"").trim();return text||null};
const allowedStatus=new Set(["rascunho","publicado","arquivado"]);

function ensureImportStyles(){
  if(document.getElementById("guide-json-styles"))return;
  const style=document.createElement("style");style.id="guide-json-styles";
  style.textContent='.guide-import-panel{margin-bottom:1.5rem}.guide-import-grid{display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:end}.guide-file-box{padding:1.2rem;border:2px dashed #bdd0d7;border-radius:14px;background:#f8fbfc}.guide-file-box input{margin-top:.7rem}.guide-import-actions{display:flex;gap:.65rem;flex-wrap:wrap}.guide-import-note{margin:.8rem 0;padding:.8rem 1rem;border-radius:9px;background:#eaf4f6;color:#234b58}.guide-import-note.error{background:#fde8e5;color:#8e271c}.guide-preview{margin-top:1rem}.guide-preview table{min-width:760px}.guide-preview small{display:block;color:#657780}.guide-import-stats{display:flex;gap:.75rem;flex-wrap:wrap;margin-top:1rem}.guide-import-stats span{padding:.4rem .65rem;border-radius:999px;background:#e6f0f3;color:#0b4f6c;font-size:.75rem;font-weight:750}@media(max-width:760px){.guide-import-grid{grid-template-columns:1fr}.guide-import-actions{flex-direction:column}.guide-import-actions .admin-button{width:100%}}';
  document.head.append(style);
}

function normalizeItem(item,index){
  const errors=[],nome=String(item?.nome||"").trim();
  const categoria=String(item?.categoria_nome||item?.categoria||"").trim();
  if(!nome)errors.push(`Item ${index+1}: informe o nome.`);
  if(!categoria)errors.push(`Item ${index+1}: informe a categoria.`);
  const slug=gerarSlug(String(item?.slug||nome));
  if(!slug)errors.push(`Item ${index+1}: não foi possível gerar o slug.`);
  const statusItem=String(item?.status||"publicado").toLowerCase();
  if(!allowedStatus.has(statusItem))errors.push(`Item ${index+1}: status inválido.`);
  const urlFields=["imagem_url","instagram","facebook","site","mapa_url"];
  for(const field of urlFields)if(item?.[field]&&!onlyUrl(item[field]))errors.push(`Item ${index+1}: ${field} precisa ser uma URL válida.`);
  const galeria=Array.isArray(item?.galeria_urls)?item.galeria_urls.filter(Boolean):[];
  if(galeria.some(url=>!onlyUrl(url)))errors.push(`Item ${index+1}: galeria_urls contém uma URL inválida.`);
  return{errors,data:{
    nome,slug,categoria_nome:categoria,descricao:optional(item?.descricao),
    imagem_url:onlyUrl(item?.imagem_url||item?.imagem),galeria_urls:galeria.map(onlyUrl),
    whatsapp:optional(item?.whatsapp),telefone:optional(item?.telefone),
    instagram:onlyUrl(item?.instagram),facebook:onlyUrl(item?.facebook),site:onlyUrl(item?.site),
    endereco:optional(item?.endereco),horario:optional(item?.horario),mapa_url:onlyUrl(item?.mapa_url),
    recomendado:Boolean(item?.recomendado??item?.destaque),status:statusItem,
    seo_titulo:optional(item?.seo_titulo)||nome,
    seo_descricao:(optional(item?.seo_descricao)||optional(item?.descricao)||"").slice(0,160)||null
  }};
}

function renderGuidePreview(errors=[]){
  const preview=document.getElementById("guide-json-preview"),run=document.getElementById("import-guide-json");
  if(errors.length){
    preview.innerHTML=`<div class="guide-import-note error"><strong>Corrija o arquivo:</strong><br>${errors.map(esc).join("<br>")}</div>`;
    run.disabled=true;return;
  }
  const categories=new Set(importState.itens.map(item=>item.categoria_nome));
  preview.innerHTML=`<div class="guide-import-stats"><span>${importState.itens.length} empresa(s)</span><span>${categories.size} categoria(s)</span><span>Duplicados serão atualizados pelo slug</span></div><div class="table-wrap guide-preview"><table><thead><tr><th>Empresa</th><th>Categoria</th><th>Status</th><th>Contato</th></tr></thead><tbody>${importState.itens.map(item=>`<tr><td><strong>${esc(item.nome)}</strong><small>${esc(item.slug)}</small></td><td>${esc(item.categoria_nome)}</td><td><span class="status-pill ${esc(item.status)}">${esc(item.status)}</span></td><td>${esc(item.whatsapp||item.telefone||"—")}</td></tr>`).join("")}</tbody></table></div>`;
  run.disabled=!importState.itens.length;
  run.textContent=`Importar ${importState.itens.length} empresa(s)`;
}

async function readGuideFile(file){
  if(!file)return;
  if(file.size>2*1024*1024)throw new Error("O arquivo JSON deve ter no máximo 2 MB.");
  const parsed=JSON.parse(await file.text());
  const rows=Array.isArray(parsed)?parsed:parsed?.itens;
  if(!Array.isArray(rows))throw new Error('Use uma lista JSON ou um objeto contendo o campo "itens".');
  if(!rows.length)throw new Error("O arquivo não possui empresas para importar.");
  if(rows.length>1000)throw new Error("Importe no máximo 1.000 empresas por arquivo.");
  const normalized=rows.map(normalizeItem),errors=normalized.flatMap(item=>item.errors);
  const slugs=normalized.map(item=>item.data.slug).filter(Boolean);
  const duplicates=slugs.filter((slug,index)=>slugs.indexOf(slug)!==index);
  if(duplicates.length)errors.push(`Slugs repetidos no arquivo: ${[...new Set(duplicates)].join(", ")}.`);
  importState.arquivo=file;importState.itens=normalized.map(item=>item.data);
  renderGuidePreview(errors);
}

async function ensureGuideCategories(items){
  const db=getSupabase();
  const {data:all,error}=await db.from("categorias").select("id,nome,slug,tipo,ordem");
  if(error)throw error;
  const guide=(all||[]).filter(item=>item.tipo==="guia"),byName=new Map(guide.map(item=>[item.nome.trim().toLowerCase(),item]));
  const usedSlugs=new Set((all||[]).map(item=>item.slug)),missing=[...new Set(items.map(item=>item.categoria_nome))].filter(name=>!byName.has(name.trim().toLowerCase()));
  let order=Math.max(0,...guide.map(item=>Number(item.ordem)||0));
  const rows=missing.map(nome=>{
    let slug=gerarSlug(nome),candidate=slug,count=2;
    if(usedSlugs.has(candidate)){candidate=`guia-${slug}`;while(usedSlugs.has(candidate))candidate=`guia-${slug}-${count++}`}
    usedSlugs.add(candidate);order+=10;
    return{nome,slug:candidate,tipo:"guia",ordem:order,status:"ativo"};
  });
  if(rows.length){const{error:insertError}=await db.from("categorias").insert(rows);if(insertError)throw insertError}
  const {data:updated,error:updatedError}=await db.from("categorias").select("id,nome").eq("tipo","guia");
  if(updatedError)throw updatedError;
  return new Map((updated||[]).map(item=>[item.nome.trim().toLowerCase(),item]));
}

async function importGuideJson(){
  const run=document.getElementById("import-guide-json"),message=document.getElementById("guide-json-message");
  if(!importState.itens.length)return;
  if(!confirm(`Importar ${importState.itens.length} empresa(s) para o Guia Comercial?`))return;
  run.disabled=true;run.textContent="Preparando categorias…";message.className="guide-import-note";message.textContent="Validando categorias e empresas…";
  try{
    const categories=await ensureGuideCategories(importState.itens),payload=importState.itens.map(item=>({
      ...item,categoria_id:categories.get(item.categoria_nome.trim().toLowerCase())?.id||null
    }));
    for(let index=0;index<payload.length;index+=100){
      run.textContent=`Importando ${Math.min(index+100,payload.length)} de ${payload.length}…`;
      const{error}=await getSupabase().from("guia_comercial").upsert(payload.slice(index,index+100),{onConflict:"slug"});
      if(error)throw error;
    }
    message.className="guide-import-note";message.innerHTML=`<strong>Importação concluída.</strong> ${payload.length} empresa(s) foram criadas ou atualizadas.`;
    run.textContent="Importação concluída";
  }catch(error){
    message.className="guide-import-note error";message.textContent=`Falha na importação: ${error.message}`;
    run.disabled=false;run.textContent=`Importar ${importState.itens.length} empresa(s)`;
  }
}

function setupGuideJsonImport(){
  ensureImportStyles();
  const oldPanel=document.querySelector("main .panel"),section=document.createElement("section");
  section.className="panel guide-import-panel";
  section.innerHTML=`<div class="panel-header"><div><h2>Importar Guia Comercial por arquivo</h2><p>Cadastre ou atualize várias empresas de uma vez, com validação e prévia.</p></div></div><div class="guide-import-grid"><div class="guide-file-box"><strong>1. Preencha o modelo JSON</strong><p>Nome e categoria são obrigatórios. Os outros campos podem ficar vazios.</p><input id="guide-json-file" type="file" accept=".json,application/json"></div><div class="guide-import-actions"><a class="admin-button secondary" href="../modelos/guia-comercial-modelo.json" download>Baixar modelo JSON</a><button id="import-guide-json" class="admin-button" type="button" disabled>Importar empresas</button></div></div><div id="guide-json-preview"></div><p id="guide-json-message" class="guide-import-note">Selecione o arquivo preenchido para conferir os dados antes de importar.</p>`;
  oldPanel.before(section);
  document.getElementById("guide-json-file").addEventListener("change",async event=>{
    const message=document.getElementById("guide-json-message");
    try{message.className="guide-import-note";message.textContent="Lendo e validando arquivo…";await readGuideFile(event.target.files?.[0]);message.textContent=`Arquivo ${event.target.files?.[0]?.name||""} validado.`}
    catch(error){importState.itens=[];renderGuidePreview([error.message]);message.className="guide-import-note error";message.textContent=error.message}
  });
  document.getElementById("import-guide-json").addEventListener("click",importGuideJson);
}

if(acesso?.configurado)setupGuideJsonImport();
