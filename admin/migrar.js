import { exigirAdministrador } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { gerarSlug } from "../assets/js/utils.js";

const status = document.getElementById("migration-status");
const button = document.getElementById("run-migration");
const linksIniciais = [["Nosso site","https://www.euamourania.site/","🌐"],["Canal WhatsApp","https://whatsapp.com/channel/0029VapPdlLGpLHTXQELk210","💬"],["WhatsApp","https://wa.me/5517981344558","📱"],["YouTube","https://www.youtube.com/@EuAmoUr%C3%A2nia","▶️"],["Instagram","https://instagram.com/euamourania","📷"],["Facebook","https://facebook.com/euamourania","👥"],["X (Twitter)","https://x.com/euamourania","𝕏"],["TikTok","https://tiktok.com/@euamourania","🎵"]].map(([titulo,url,icone],ordem)=>({titulo,url,icone,ordem,status:"ativo"}));
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
