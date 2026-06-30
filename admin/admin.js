import { exigirAdministrador, sair } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { listarTabela, salvarRegistro, excluirRegistro } from "../assets/js/services/baseService.js";
import { gerarSlug } from "../assets/js/utils.js";

const app = document.getElementById("app-content");
const title = document.getElementById("page-title");
const sidebar = document.getElementById("sidebar");
let currentView = "dashboard";
let quill;

const resources = {
  noticias: { label:"Notícias", title:"titulo", order:"atualizado_em", fields:[
    ["titulo","Título","text",true],["slug","Slug","text",true],["subtitulo","Subtítulo","text"],["resumo","Resumo","textarea"],["categoria_nome","Categoria","text"],["autor","Autor","text"],["imagem_url","URL da imagem","url"],["legenda_imagem","Legenda da imagem","text"],["status","Status","status"],["destaque","Destaque","boolean"],["publicado_em","Publicação","datetime-local"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"],["seo_imagem","Imagem SEO","url"],["conteudo_html","Conteúdo","editor"]]},
  guia_comercial: { label:"Guia comercial", title:"nome", order:"atualizado_em", fields:[
    ["nome","Nome","text",true],["slug","Slug","text",true],["categoria_nome","Categoria","text"],["descricao","Descrição","textarea"],["imagem_url","URL da imagem","url"],["whatsapp","WhatsApp","text"],["telefone","Telefone","text"],["instagram","Instagram","url"],["facebook","Facebook","url"],["site","Site","url"],["endereco","Endereço","text"],["horario","Horário","text"],["mapa_url","Mapa","url"],["recomendado","Recomendado","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  turismo: { label:"Turismo", title:"nome", order:"atualizado_em", fields:[["nome","Nome","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["conteudo_html","Conteúdo","editor"],["imagem_url","Imagem","url"],["endereco","Endereço","text"],["horario","Horário","text"],["whatsapp","WhatsApp","text"],["mapa_url","Mapa","url"],["destaque","Destaque","boolean"],["status","Status","status"],["seo_titulo","Título SEO","text"],["seo_descricao","Descrição SEO","textarea"]]},
  links: { label:"Links", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text",true],["url","URL","url",true],["icone","Ícone/emoji","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  eventos: { label:"Eventos", title:"titulo", order:"atualizado_em", fields:[["titulo","Título","text",true],["slug","Slug","text",true],["descricao","Descrição","textarea"],["imagem_url","Imagem","url"],["data_inicio","Início","datetime-local"],["data_fim","Fim","datetime-local"],["local","Local","text"],["endereco","Endereço","text"],["organizador","Organizador","text"],["whatsapp","WhatsApp","text"],["destaque","Destaque","boolean"],["status","Status","status"]]},
  banners: { label:"Banners", title:"titulo", order:"ordem", ascending:true, fields:[["titulo","Título","text"],["subtitulo","Subtítulo","text"],["imagem_url","Imagem","url"],["link_url","Link","url"],["posicao","Posição","text"],["ordem","Ordem","number"],["status","Status","active-status"]]},
  categorias: { label:"Categorias", title:"nome", order:"ordem", ascending:true, fields:[["nome","Nome","text",true],["slug","Slug","text",true],["tipo","Tipo","category-type",true],["ordem","Ordem","number"],["status","Status","active-status"]]},
  configuracoes_site: { label:"Configurações", title:"chave", order:"chave", ascending:true, fields:[["chave","Chave","text",true],["valor","Valor","textarea"],["tipo","Tipo","text"]]}
};

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const inputValue = (value, type) => type === "datetime-local" && value ? new Date(value).toISOString().slice(0,16) : value ?? "";

async function dashboard() {
  title.textContent = "Visão geral";
  app.innerHTML = '<div class="loading">Carregando indicadores…</div>';
  const supabase = getSupabase();
  const count = async (table, filters={}) => { let q=supabase.from(table).select("*",{count:"exact",head:true}); Object.entries(filters).forEach(([k,v])=>q=q.eq(k,v)); const {count,error}=await q; if(error) throw error; return count||0; };
  try {
    const [noticias,publicadas,rascunhos,empresas,pontos,eventos,links] = await Promise.all([count("noticias"),count("noticias",{status:"publicado"}),count("noticias",{status:"rascunho"}),count("guia_comercial"),count("turismo"),count("eventos"),count("links",{status:"ativo"})]);
    const metrics=[["Total de notícias",noticias],["Notícias publicadas",publicadas],["Rascunhos",rascunhos],["Empresas cadastradas",empresas],["Pontos turísticos",pontos],["Eventos",eventos],["Links ativos",links]];
    app.innerHTML=`<div class="dashboard-grid">${metrics.map(([label,value])=>`<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join("")}</div>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

async function resourceList(table) {
  const config=resources[table]; title.textContent=config.label; app.innerHTML='<div class="loading">Carregando…</div>';
  try {
    const rows=await listarTabela(table,{ordem:config.order,crescente:config.ascending||false});
    app.innerHTML=`<section class="panel"><header class="panel-header"><h2>${config.label}</h2><button class="admin-button" data-new="${table}">Novo cadastro</button></header><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Status</th><th>Atualização</th><th>Ações</th></tr></thead><tbody>${rows.length?rows.map(row=>`<tr><td><strong>${escapeHtml(row[config.title]||"Sem título")}</strong></td><td><span class="status-pill ${escapeHtml(row.status||"")}">${escapeHtml(row.status||"—")}</span></td><td>${row.atualizado_em?new Date(row.atualizado_em).toLocaleDateString("pt-BR"):"—"}</td><td><div class="row-actions"><button data-edit="${table}" data-id="${row.id}">Editar</button><button data-delete="${table}" data-id="${row.id}">Excluir</button></div></td></tr>`).join(""):'<tr><td colspan="4">Nenhum registro.</td></tr>'}</tbody></table></div></section>`;
  } catch(error) { app.innerHTML=`<p class="form-message">${escapeHtml(error.message)}</p>`; }
}

function fieldHtml([name,label,type,required], value) {
  const req=required?"required":"", full=["textarea","editor"].includes(type)?"full-row":"";
  if(type==="editor") return `<label class="${full}">${label}<div id="editor"></div><input type="hidden" name="${name}"></label>`;
  if(type==="textarea") return `<label class="${full}">${label}<textarea name="${name}" ${req}>${escapeHtml(inputValue(value,type))}</textarea></label>`;
  if(type==="boolean") return `<label>${label}<select name="${name}"><option value="false" ${!value?"selected":""}>Não</option><option value="true" ${value?"selected":""}>Sim</option></select></label>`;
  const options=type==="status"?["rascunho","publicado","arquivado"]:type==="active-status"?["ativo","inativo"]:type==="category-type"?["noticias","guia","turismo","eventos"]:null;
  if(options) return `<label>${label}<select name="${name}">${options.map(o=>`<option value="${o}" ${value===o?"selected":""}>${o}</option>`).join("")}</select></label>`;
  return `<label class="${full}">${label}<input type="${type}" name="${name}" value="${escapeHtml(inputValue(value,type))}" ${req}></label>`;
}

async function editForm(table,id) {
  const config=resources[table]; let row={};
  if(id){const {data,error}=await getSupabase().from(table).select("*").eq("id",id).single();if(error)throw error;row=data;}
  title.textContent=`${id?"Editar":"Novo"} · ${config.label}`;
  app.innerHTML=`<section class="panel"><form id="resource-form" class="resource-form">${config.fields.map(field=>fieldHtml(field,row[field[0]])).join("")}<div class="form-actions"><button type="button" class="admin-button secondary" data-cancel="${table}">Cancelar</button><button class="admin-button" type="submit">Salvar</button></div><p id="form-message" class="form-message full-row"></p></form></section>`;
  const editorField=config.fields.find(f=>f[2]==="editor");
  if(editorField){quill=new Quill("#editor",{theme:"snow",modules:{toolbar:[["bold","italic","blockquote"],[{header:[2,3,false]}],[{list:"ordered"},{list:"bullet"}],["link","image","video"],["clean"]]}});quill.root.innerHTML=row[editorField[0]]||"";}
  const sourceName=config.fields.some(f=>f[0]==="titulo")?"titulo":config.fields.some(f=>f[0]==="nome")?"nome":null;
  if(sourceName&&config.fields.some(f=>f[0]==="slug")){const source=app.querySelector(`[name="${sourceName}"]`),slugInput=app.querySelector('[name="slug"]');source.addEventListener("input",()=>{if(!id||!slugInput.dataset.edited)slugInput.value=gerarSlug(source.value)});slugInput.addEventListener("input",()=>slugInput.dataset.edited="true");}
  document.getElementById("resource-form").addEventListener("submit",async event=>{event.preventDefault();const message=document.getElementById("form-message");message.textContent="Salvando…";const form=new FormData(event.currentTarget),payload={id};for(const field of config.fields){const [name,,type]=field;if(type==="editor")payload[name]=quill.root.innerHTML;else if(type==="boolean")payload[name]=form.get(name)==="true";else if(type==="number")payload[name]=Number(form.get(name)||0);else payload[name]=form.get(name)||null;}if(table==="noticias"&&payload.status==="publicado"&&!payload.publicado_em)payload.publicado_em=new Date().toISOString();try{await salvarRegistro(table,payload);await resourceList(table)}catch(error){message.textContent=error.message;}});
}

async function handleClick(event) {
  const button=event.target.closest("button");if(!button)return;
  if(button.dataset.view){currentView=button.dataset.view;location.hash=currentView;document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b===button));sidebar.classList.remove("open");return currentView==="dashboard"?dashboard():resourceList(currentView);}
  if(button.dataset.new)return editForm(button.dataset.new);
  if(button.dataset.edit)return editForm(button.dataset.edit,button.dataset.id);
  if(button.dataset.cancel)return resourceList(button.dataset.cancel);
  if(button.dataset.delete&&confirm("Excluir este registro? Esta ação não pode ser desfeita.")){await excluirRegistro(button.dataset.delete,button.dataset.id);return resourceList(button.dataset.delete);}
}

async function init(){
  const access=await exigirAdministrador();if(!access)return;
  if(!access.configurado){app.innerHTML='<p class="form-message">Configure assets/js/supabase-config.js para ativar o painel.</p>';return;}
  document.getElementById("admin-user").textContent=access.admin.nome||access.user.email;
  document.getElementById("logout").addEventListener("click",sair);
  document.getElementById("mobile-menu").addEventListener("click",()=>sidebar.classList.toggle("open"));
  document.addEventListener("click",handleClick);
  currentView=location.hash.slice(1)||"dashboard";
  const nav=document.querySelector(`[data-view="${currentView}"]`);if(nav)nav.click();else dashboard();
}
init();
import("./editorial-audience.js").catch(error=>console.error("Módulos editorial/audiência:",error));
