import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { obterAudienciaAvancada } from "../assets/js/services/analyticsService.js";
import { obterAcessoAtual, temPermissao } from "./auth.js";

const db=getSupabase();
const app=document.getElementById("app-content");
const pageTitle=document.getElementById("page-title");
const esc=(value="")=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const fmtDate=value=>value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value)):"—";
const isoDate=date=>date.toISOString().slice(0,10);
let currentNewsId=null;
let audienceData=null;
function safeArticleHtml(html=""){
 const template=document.createElement("template");template.innerHTML=html;
 template.content.querySelectorAll("script,style,object,embed,form").forEach(node=>node.remove());
 template.content.querySelectorAll("*").forEach(node=>[...node.attributes].forEach(attribute=>{
  if(attribute.name.startsWith("on")||/^\s*javascript:/i.test(attribute.value))node.removeAttribute(attribute.name);
 }));
 return template.innerHTML;
}

function ensureNavigation(){
 if(!document.querySelector('link[href="editorial-audience.css"]')){
  const link=document.createElement("link");link.rel="stylesheet";link.href="editorial-audience.css";document.head.append(link);
 }
 const nav=document.querySelector(".admin-nav"),news=document.querySelector('[data-view="noticias"]'),settings=document.querySelector('[data-view="configuracoes_site"]');
 if(nav&&news&&!document.getElementById("editorial-approvals-nav")){
  const button=document.createElement("button");button.id="editorial-approvals-nav";button.dataset.module="noticias";button.textContent="Aprovações";news.after(button);
 }
 if(nav&&settings&&!document.getElementById("audience-nav")){
  const button=document.createElement("button");button.id="audience-nav";button.dataset.module="insights";button.textContent="Audiência";settings.before(button);
  const legacy=document.querySelector('[data-view="insights"]');if(legacy)legacy.remove();
 }
}
ensureNavigation();

function toast(message,type="success"){
 const stack=document.getElementById("toasts"),item=document.createElement("div");
 item.className=`toast ${type}`;item.textContent=message;stack.append(item);
 setTimeout(()=>item.remove(),4000);
}
function loading(){
 app.innerHTML='<div class="ads-card"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>';
}
function access(){
 return obterAcessoAtual();
}
function canReview(){
 return temPermissao(access()?.admin,"noticias","publicar");
}
function setActive(id,title,hash){
 pageTitle.textContent=title;
 location.hash=hash;
 document.querySelectorAll(".admin-nav button").forEach(button=>button.classList.toggle("active",button.id===id));
 document.getElementById("sidebar")?.classList.remove("open");
}
function editorialLabel(status){
 return({rascunho:"Rascunho editorial",em_revisao:"Em revisão",ajustes_solicitados:"Ajustes solicitados",aprovado:"Aprovado"})[status]||status||"Rascunho editorial";
}
function requestLabel(status){
 return({pendente:"Aguardando revisão",ajustes_solicitados:"Ajustes solicitados",aprovado:"Aprovada",cancelado:"Cancelada"})[status]||status;
}

async function fetchApprovalRows(){
 const {data:requests,error}=await db.from("solicitacoes_aprovacao").select("*").order("enviado_em",{ascending:false}).limit(500);
 if(error)throw error;
 const ids=[...new Set((requests||[]).map(item=>item.noticia_id))];
 if(!ids.length)return[];
 const {data:news,error:newsError}=await db.from("noticias")
  .select("id,titulo,slug,autor,status,status_editorial,publicado_em,criado_por,conteudo_html,resumo,imagem_url,enviado_revisao_em")
  .in("id",ids);
 if(newsError)throw newsError;
 const byId=new Map((news||[]).map(item=>[item.id,item]));
 return(requests||[]).map(request=>({...request,noticia:byId.get(request.noticia_id)})).filter(item=>item.noticia);
}

async function renderApprovals(){
 if(!canReview()){toast("Seu perfil não possui permissão para revisar notícias.","error");return}
 setActive("editorial-approvals-nav","Aprovações","aprovacoes");
 loading();
 try{
  const rows=await fetchApprovalRows();
  const pending=rows.filter(item=>item.status==="pendente").length;
  const authors=[...new Set(rows.map(item=>item.noticia.autor||"Sem autor"))].sort();
  app.innerHTML=`<section class="panel editorial-panel">
   <div class="cms-section-head"><div><h2>Fila de aprovação</h2><p>Revise matérias, solicite ajustes ou aprove a publicação.</p></div><span class="approval-counter">${pending} aguardando</span></div>
   <div class="cms-toolbar-v2">
    <input id="approval-search" type="search" placeholder="Pesquisar matéria…">
    <select id="approval-status"><option value="">Todos os status</option><option value="pendente">Aguardando revisão</option><option value="ajustes_solicitados">Ajustes solicitados</option><option value="aprovado">Aprovadas</option><option value="cancelado">Canceladas</option></select>
    <select id="approval-author"><option value="">Todos os autores</option>${authors.map(author=>`<option>${esc(author)}</option>`).join("")}</select>
    <input id="approval-date" type="date" aria-label="Filtrar por data de envio">
   </div>
   <div class="table-wrap"><table class="cms-table"><thead><tr><th>Matéria</th><th>Autor</th><th>Status</th><th>Enviada em</th><th>Revisão</th></tr></thead>
   <tbody id="approval-rows">${rows.map(item=>`<tr data-search="${esc(item.noticia.titulo.toLowerCase())}" data-author="${esc(item.noticia.autor||"Sem autor")}" data-status="${item.status}" data-date="${item.enviado_em.slice(0,10)}">
    <td class="cms-title-cell"><strong>${esc(item.noticia.titulo)}</strong><small>${esc(item.noticia.slug)}</small></td>
    <td>${esc(item.noticia.autor||"Sem autor")}</td>
    <td><span class="editorial-status ${item.status}">${esc(requestLabel(item.status))}</span></td>
    <td>${fmtDate(item.enviado_em)}</td>
    <td><div class="cms-actions"><button data-approval-preview="${item.noticia.id}">Prévia</button>${item.status==="pendente"?`<button class="primary-action" data-approval-review="${item.noticia.id}">Revisar</button>`:""}${item.comentario?`<button data-approval-comment="${item.id}">Comentário</button>`:""}</div></td>
   </tr>`).join("")||'<tr><td colspan="5"><div class="empty-state">Nenhuma solicitação de aprovação.</div></td></tr>'}</tbody></table></div>
  </section><div id="editorial-dialog"></div>`;
  const filter=()=>{
   const term=document.getElementById("approval-search").value.toLowerCase(),status=document.getElementById("approval-status").value;
   const author=document.getElementById("approval-author").value,date=document.getElementById("approval-date").value;
   document.querySelectorAll("#approval-rows tr[data-search]").forEach(row=>{
    row.hidden=!(row.dataset.search.includes(term)&&(!status||row.dataset.status===status)&&(!author||row.dataset.author===author)&&(!date||row.dataset.date===date));
   });
  };
  ["approval-search","approval-status","approval-author","approval-date"].forEach(id=>document.getElementById(id).addEventListener("input",filter));
  app._approvalRows=rows;
 }catch(error){
  app.innerHTML=`<div class="ads-card empty-state"><strong>Não foi possível carregar aprovações</strong><p>${esc(error.message)}</p></div>`;
 }
}

function approvalItem(newsId){
 return(app._approvalRows||[]).find(item=>item.noticia.id===newsId&&item.status==="pendente")
  ||(app._approvalRows||[]).find(item=>item.noticia.id===newsId);
}
function openPreview(newsId){
 const item=approvalItem(newsId);if(!item)return;
 const news=item.noticia,dialog=document.getElementById("editorial-dialog");
 dialog.innerHTML=`<div class="cms-dialog-backdrop"><section class="cms-dialog editorial-preview" role="dialog" aria-modal="true" aria-label="Prévia da notícia">
  <button class="dialog-close" data-dialog-close aria-label="Fechar">×</button>
  <p class="eyebrow">Pré-visualização editorial</p><h2>${esc(news.titulo)}</h2>
  ${news.resumo?`<p class="article-subtitle">${esc(news.resumo)}</p>`:""}
  ${news.imagem_url?`<img src="${esc(news.imagem_url)}" alt="">`:""}
  <div class="editorial-copy">${safeArticleHtml(news.conteudo_html)||"<p>Sem conteúdo.</p>"}</div>
 </section></div>`;
}
function localDateTime(value){
 if(!value)return"";
 const date=new Date(value),offset=date.getTimezoneOffset();
 return new Date(date.getTime()-offset*60000).toISOString().slice(0,16);
}
function openReview(newsId){
 const item=approvalItem(newsId);if(!item)return;
 const dialog=document.getElementById("editorial-dialog");
 dialog.innerHTML=`<div class="cms-dialog-backdrop"><section class="cms-dialog" role="dialog" aria-modal="true" aria-label="Revisar notícia">
  <button class="dialog-close" data-dialog-close aria-label="Fechar">×</button>
  <p class="eyebrow">Revisão editorial</p><h2>${esc(item.noticia.titulo)}</h2>
  <label class="cms-field full"><span>Comentário para o redator</span><textarea id="review-comment" rows="5" placeholder="Obrigatório ao solicitar ajustes. Opcional na aprovação."></textarea></label>
  <label class="cms-field"><span>Data e horário de publicação</span><input id="review-published-at" type="datetime-local" value="${localDateTime(item.noticia.publicado_em)}"></label>
  <div class="dialog-actions">
   <button class="admin-button secondary" data-request-changes="${newsId}">Solicitar ajustes</button>
   <button class="admin-button secondary" data-approve-news="${newsId}">Aprovar</button>
   <button class="admin-button" data-publish-news="${newsId}">Aprovar e publicar</button>
  </div>
 </section></div>`;
}
async function reviewNews(newsId,decision,publish=false){
 const comment=document.getElementById("review-comment")?.value.trim()||null;
 if(decision==="solicitar_ajustes"&&!comment){toast("Informe quais ajustes o redator deve fazer.","error");return}
 const publication=document.getElementById("review-published-at")?.value;
 const {error}=await db.rpc("revisar_noticia",{
  p_noticia:newsId,p_decisao:decision,p_comentario:comment,p_publicar:publish,
  p_publicado_em:publication?new Date(publication).toISOString():null
 });
 if(error){toast(error.message,"error");return}
 document.getElementById("editorial-dialog").innerHTML="";
 toast(decision==="solicitar_ajustes"?"Matéria devolvida para ajustes.":publish?"Matéria aprovada e publicada.":"Matéria aprovada.");
 renderApprovals();
}

async function decorateNews(){
 const rows=[...document.querySelectorAll("#news-rows tr")];if(!rows.length)return;
 const ids=rows.map(row=>row.querySelector("[data-news-edit]")?.dataset.newsEdit).filter(Boolean);
 if(!ids.length)return;
 const {data}=await db.from("noticias").select("id,status_editorial").in("id",ids);
 const states=new Map((data||[]).map(item=>[item.id,item.status_editorial]));
 rows.forEach(row=>{
  const edit=row.querySelector("[data-news-edit]"),status=states.get(edit?.dataset.newsEdit);
  if(!status||row.querySelector(".editorial-status"))return;
  row.querySelector(".cms-title-cell small")?.insertAdjacentHTML("afterend",`<span class="editorial-status ${status}">${esc(editorialLabel(status))}</span>`);
  if(access()?.admin.funcao==="redator"&&status==="em_revisao"){
   edit.disabled=true;edit.title="A matéria está bloqueada durante a revisão";
  }
 });
}

async function decorateNewsForm(){
 const form=document.getElementById("news-form");if(!form||form.dataset.editorialReady)return;
 form.dataset.editorialReady="1";
 const actions=form.querySelector(".cms-sticky-actions");
 let news=null,latest=null;
 if(currentNewsId){
  const result=await db.from("noticias").select("id,titulo,status,status_editorial,criado_por").eq("id",currentNewsId).single();
  news=result.data;
  const request=await db.from("solicitacoes_aprovacao").select("status,comentario,revisado_em").eq("noticia_id",currentNewsId).order("enviado_em",{ascending:false}).limit(1).maybeSingle();
  latest=request.data;
 }
 const state=news?.status_editorial||"rascunho";
 const publishButton=actions.querySelector('[data-save-status="publicado"]');
 if(publishButton&&state!=="aprovado")publishButton.hidden=true;
 const info=document.createElement("div");info.className="editorial-form-state";
 info.innerHTML=`<div><span>Fluxo editorial</span><strong>${esc(editorialLabel(state))}</strong></div>${latest?.comentario?`<p><strong>Comentário da revisão:</strong> ${esc(latest.comentario)}</p>`:""}`;
 actions.before(info);
 if(currentNewsId&&["rascunho","ajustes_solicitados"].includes(state)&&news?.status==="rascunho"){
  const send=document.createElement("button");send.type="button";send.className="admin-button";send.dataset.sendApproval=currentNewsId;send.textContent="Enviar para aprovação";
  actions.insertBefore(send,actions.querySelector('[data-save-status="publicado"]'));
 }
 if(!currentNewsId){
  info.insertAdjacentHTML("beforeend","<p>Salve o rascunho e abra-o novamente para enviar à aprovação.</p>");
 }
 if(currentNewsId&&state!=="aprovado"){
  info.insertAdjacentHTML("beforeend","<p>A publicação será liberada depois da aprovação editorial.</p>");
 }
 if(access()?.admin.funcao==="redator"&&state==="em_revisao"){
  form.querySelectorAll("input,textarea,select,button").forEach(field=>{if(!field.hasAttribute("data-back-news")&&!field.hasAttribute("data-preview"))field.disabled=true});
  document.querySelector("#editor")?.classList.add("editor-locked");
  info.insertAdjacentHTML("beforeend","<p>A edição está bloqueada enquanto a matéria estiver em revisão.</p>");
 }
}

async function sendForApproval(newsId){
 const {error}=await db.rpc("enviar_noticia_revisao",{p_noticia:newsId});
 if(error){toast(error.message,"error");return}
 toast("Matéria enviada para aprovação.");
 document.querySelector("[data-back-news]")?.click();
}

function variation(current,previous){
 if(!previous)return current?"+100%":"0%";
 const value=((current-previous)/previous)*100;
 return`${value>=0?"+":""}${value.toFixed(1)}%`;
}
function rankList(rows,label,value="total"){
 return(rows||[]).map((row,index)=>`<div class="rank-item"><span>${index+1}</span><strong>${esc(row[label]||"Não identificado")}</strong><small>${Number(row[value]||0).toLocaleString("pt-BR")}</small></div>`).join("")||'<div class="empty-state">Sem dados no período.</div>';
}
async function resourceNames(resources=[]){
 const config={noticia:["noticias","titulo"],guia:["guia_comercial","nome"],evento:["eventos","titulo"],turismo:["turismo","nome"]};
 const map=new Map();
 await Promise.all(Object.entries(config).map(async([type,[table,label]])=>{
  const ids=[...new Set(resources.filter(item=>item.tipo===type).map(item=>item.id).filter(Boolean))];
  if(!ids.length)return;
  const {data}=await db.from(table).select(`id,${label}`).in("id",ids);
  (data||[]).forEach(item=>map.set(`${type}:${item.id}`,item[label]));
 }));
 return resources.map(item=>({...item,nome:map.get(`${item.tipo}:${item.id}`)||"Conteúdo removido"}));
}
function chart(series=[]){
 const max=Math.max(1,...series.map(item=>Number(item.visualizacoes||0)));
 return`<div class="audience-chart" aria-label="Visualizações por dia">${series.map(item=>`<div class="audience-bar-wrap" title="${esc(item.dia)}: ${item.visualizacoes}"><div class="audience-bar" style="height:${Math.max(4,Math.round(item.visualizacoes/max*150))}px"></div><small>${esc(item.dia.slice(5))}</small></div>`).join("")||'<div class="empty-state">Sem visualizações no período.</div>'}</div>`;
}
async function googleAudience(start,end){
 const {data:{session}}=await db.auth.getSession();
 if(!session?.access_token)return{error:"Sessão administrativa não encontrada."};
 const response=await fetch(`/api/google-audience?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,{
  headers:{Authorization:`Bearer ${session.access_token}`,Accept:"application/json"}
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)return{error:data.error||"Integração Google indisponível."};
 return data;
}
const percent=value=>`${(Number(value||0)*100).toFixed(1).replace(".",",")}%`;
function googlePanels(google){
 if(google?.error)return`<section class="panel wide google-status error"><h2>Google Analytics e Search Console</h2><p>${esc(google.error)}</p></section>`;
 const ga=google?.ga4||{},search=google?.searchConsole||{},summary=ga.summary||{},searchSummary=search.summary||{};
 const gaError=ga.error?`<div class="integration-warning"><strong>Google Analytics:</strong> ${esc(ga.error)}</div>`:"";
 const searchError=search.error?`<div class="integration-warning"><strong>Search Console:</strong> ${esc(search.error)}</div>`:"";
 const daily=(ga.daily||[]).map(item=>({dia:item.date,visualizacoes:item.screenPageViews||0}));
 return`<section class="panel wide google-status"><div class="google-heading"><div><p class="eyebrow">Dados Google</p><h2>Google Analytics 4 e Search Console</h2></div><span>Atualização com cache de 10 minutos</span></div>${gaError}${searchError}
  <div class="google-metrics">
   <article><span>Usuários ativos</span><strong>${Number(summary.activeUsers||0).toLocaleString("pt-BR")}</strong></article>
   <article><span>Sessões</span><strong>${Number(summary.sessions||0).toLocaleString("pt-BR")}</strong></article>
   <article><span>Visualizações GA4</span><strong>${Number(summary.screenPageViews||0).toLocaleString("pt-BR")}</strong></article>
   <article><span>Cliques no Google</span><strong>${Number(searchSummary.clicks||0).toLocaleString("pt-BR")}</strong></article>
   <article><span>Impressões no Google</span><strong>${Number(searchSummary.impressions||0).toLocaleString("pt-BR")}</strong></article>
   <article><span>CTR da pesquisa</span><strong>${percent(searchSummary.ctr)}</strong></article>
  </div>
  ${daily.length?`<div class="google-chart"><h3>Visualizações registradas pelo GA4</h3>${chart(daily)}</div>`:""}
 </section>
 <section class="panel"><header class="panel-header"><h2>Páginas no GA4</h2></header>${(ga.pages||[]).map((item,index)=>`<div class="rank-item"><span>${index+1}</span><strong>${esc(item.pagePath)}</strong><small>${Number(item.screenPageViews||0).toLocaleString("pt-BR")}</small></div>`).join("")||'<div class="empty-state">O GA4 ainda não possui dados.</div>'}</section>
 <section class="panel"><header class="panel-header"><h2>Canais de aquisição</h2></header>${(ga.channels||[]).map((item,index)=>`<div class="rank-item"><span>${index+1}</span><strong>${esc(item.sessionDefaultChannelGroup||"Não identificado")}</strong><small>${Number(item.sessions||0).toLocaleString("pt-BR")} sessões</small></div>`).join("")||'<div class="empty-state">Sem dados de aquisição.</div>'}</section>
 <section class="panel"><header class="panel-header"><h2>Consultas no Google</h2></header>${(search.queries||[]).map((item,index)=>`<div class="rank-item"><span>${index+1}</span><div><strong>${esc(item.item)}</strong><small>Posição média ${Number(item.position||0).toFixed(1)}</small></div><small>${item.clicks} cliques · ${item.impressions} impressões</small></div>`).join("")||'<div class="empty-state">O Search Console ainda não retornou consultas.</div>'}</section>
 <section class="panel"><header class="panel-header"><h2>Páginas na Pesquisa Google</h2></header>${(search.pages||[]).map((item,index)=>`<div class="rank-item"><span>${index+1}</span><div><strong>${esc(item.item.replace("https://euamourania.com.br","")||"/")}</strong><small>CTR ${percent(item.ctr)}</small></div><small>${item.clicks} cliques</small></div>`).join("")||'<div class="empty-state">Sem páginas no período.</div>'}</section>`;
}
async function renderAudience(days=30,customStart=null,customEnd=null){
 setActive("audience-nav","Audiência","audiencia");
 loading();
 try{
  const end=customEnd?new Date(`${customEnd}T12:00:00`):new Date();
  const start=customStart?new Date(`${customStart}T12:00:00`):new Date(end.getTime()-(days-1)*864e5);
  const startString=isoDate(start),endString=isoDate(end);
  const [data,ads,google]=await Promise.all([
   obterAudienciaAvancada(startString,endString),
   db.from("publicidade_resumo").select("nome,impressoes,cliques,ctr").order("impressoes",{ascending:false}).limit(8),
   googleAudience(startString,endString)
  ]);
  data.recursos=await resourceNames(data.recursos||[]);
  audienceData=data;
  const summary=data.resumo||{},previous=data.anterior||{};
  const metrics=[
   ["Visualizações",summary.visualizacoes||0,variation(summary.visualizacoes||0,previous.visualizacoes||0)],
   ["Visitantes",summary.visitantes||0,variation(summary.visitantes||0,previous.visitantes||0)],
   ["Notícias lidas",summary.noticias||0,variation(summary.noticias||0,previous.noticias||0)],
   ["Cliques WhatsApp",summary.whatsapp||0,variation(summary.whatsapp||0,previous.whatsapp||0)],
   ["Links externos",summary.externos||0,variation(summary.externos||0,previous.externos||0)]
  ];
  const content=(data.recursos||[]).filter(item=>["noticia","guia","evento","turismo"].includes(item.tipo)).slice(0,12);
  app.innerHTML=`<section class="audience-head panel"><div><h2>Central de audiência</h2><p>Dados próprios do portal, sem armazenamento de IP ou informações pessoais.</p></div>
   <div class="audience-filters"><select id="audience-period"><option value="7">7 dias</option><option value="30" ${days===30?"selected":""}>30 dias</option><option value="90" ${days===90?"selected":""}>90 dias</option><option value="custom">Personalizado</option></select><input id="audience-start" type="date" value="${isoDate(start)}"><input id="audience-end" type="date" value="${isoDate(end)}"><button class="admin-button secondary" id="audience-apply">Aplicar</button><button class="admin-button secondary" id="audience-export">Exportar CSV</button></div>
  </section>
  <div class="insight-grid audience-metrics">${metrics.map(([label,value,change])=>`<article class="metric-card"><span>${label}</span><strong>${Number(value).toLocaleString("pt-BR")}</strong><small class="${change.startsWith("-")?"down":"up"}">${change} vs. período anterior</small></article>`).join("")}</div>
  <div class="insight-layout audience-layout">
   ${googlePanels(google)}
   <section class="panel wide"><header class="panel-header"><h2>Acessos por dia</h2></header>${chart(data.serie)}</section>
   <section class="panel"><header class="panel-header"><h2>Páginas mais acessadas</h2></header>${rankList(data.paginas,"pagina")}</section>
   <section class="panel"><header class="panel-header"><h2>Conteúdos mais acessados</h2></header>${content.map((item,index)=>`<div class="rank-item"><span>${index+1}</span><div><strong>${esc(item.nome)}</strong><small>${esc(item.tipo)}</small></div><small>${item.total}</small></div>`).join("")||'<div class="empty-state">Sem dados.</div>'}</section>
   <section class="panel"><header class="panel-header"><h2>Origem dos acessos</h2></header>${rankList(data.origens,"origem")}</section>
   <section class="panel"><header class="panel-header"><h2>Dispositivos</h2></header>${rankList(data.dispositivos,"dispositivo")}</section>
   <section class="panel"><header class="panel-header"><h2>Pesquisas no portal</h2></header>${rankList(data.buscas,"termo")}</section>
   <section class="panel"><header class="panel-header"><h2>Campanhas publicitárias</h2></header>${(ads.data||[]).map((item,index)=>`<div class="rank-item"><span>${index+1}</span><div><strong>${esc(item.nome)}</strong><small>${item.cliques||0} cliques · CTR ${item.ctr||0}%</small></div><small>${item.impressoes||0} impressões</small></div>`).join("")||'<div class="empty-state">Sem campanhas.</div>'}</section>
  </div>`;
 }catch(error){
  app.innerHTML=`<div class="ads-card empty-state"><strong>Não foi possível carregar a audiência</strong><p>${esc(error.message)}</p><p>Confirme se a migração de fluxo editorial e audiência foi executada no Supabase.</p></div>`;
 }
}
function exportAudience(){
 if(!audienceData)return;
 const rows=[["Seção","Item","Total"]];
 (audienceData.paginas||[]).forEach(item=>rows.push(["Páginas",item.pagina,item.total]));
 (audienceData.origens||[]).forEach(item=>rows.push(["Origens",item.origem,item.total]));
 (audienceData.dispositivos||[]).forEach(item=>rows.push(["Dispositivos",item.dispositivo,item.total]));
 (audienceData.buscas||[]).forEach(item=>rows.push(["Buscas",item.termo,item.total]));
 (audienceData.recursos||[]).forEach(item=>rows.push(["Conteúdos",`${item.tipo}: ${item.nome}`,item.total]));
 const csv="\ufeff"+rows.map(row=>row.map(value=>`"${String(value??"").replaceAll('"','""')}"`).join(";")).join("\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})),link=document.createElement("a");
 link.href=url;link.download=`audiencia-eu-amo-urania-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
}

async function decorateDashboard(){
 if(location.hash&&location.hash!=="#dashboard")return;
 const grid=app.querySelector(".dashboard-grid");if(!grid||grid.dataset.editorialReady)return;
 grid.dataset.editorialReady="1";
 try{
  const {count}=await db.from("solicitacoes_aprovacao").select("*",{count:"exact",head:true}).eq("status","pendente");
  if(count&&canReview()){
   grid.insertAdjacentHTML("beforeend",`<article class="metric-card approval-metric"><span>Aguardando aprovação</span><strong>${count}</strong><button id="dashboard-approvals">Abrir fila</button></article>`);
   const alerts=app.querySelector(".cms-alerts");
   alerts?.insertAdjacentHTML("afterbegin",`<div class="cms-alert">${count} matéria(s) aguardando revisão editorial.</div>`);
  }
 }catch{}
}

document.addEventListener("click",event=>{
 const button=event.target.closest("button");if(!button)return;
 if(button.dataset.newsEdit)currentNewsId=button.dataset.newsEdit;
 if(button.hasAttribute("data-news-new"))currentNewsId=null;
 if(button.id==="editorial-approvals-nav"||button.id==="dashboard-approvals"){event.preventDefault();event.stopImmediatePropagation();renderApprovals();return}
 if(button.id==="audience-nav"){event.preventDefault();event.stopImmediatePropagation();renderAudience();return}
 if(button.dataset.approvalPreview){openPreview(button.dataset.approvalPreview);return}
 if(button.dataset.approvalReview){openReview(button.dataset.approvalReview);return}
 if(button.dataset.approvalComment){
  const item=(app._approvalRows||[]).find(row=>row.id===button.dataset.approvalComment);
  if(item)toast(item.comentario||"Sem comentário.","success");
  return;
 }
 if(button.hasAttribute("data-dialog-close")){document.getElementById("editorial-dialog").innerHTML="";return}
 if(button.dataset.requestChanges){reviewNews(button.dataset.requestChanges,"solicitar_ajustes");return}
 if(button.dataset.approveNews){reviewNews(button.dataset.approveNews,"aprovar",false);return}
 if(button.dataset.publishNews){reviewNews(button.dataset.publishNews,"aprovar",true);return}
 if(button.dataset.sendApproval){sendForApproval(button.dataset.sendApproval);return}
 if(button.id==="audience-apply"){
  const period=document.getElementById("audience-period").value,start=document.getElementById("audience-start").value,end=document.getElementById("audience-end").value;
  renderAudience(period==="custom"?30:Number(period),start,end);return;
 }
 if(button.id==="audience-export"){exportAudience();return}
},true);

document.addEventListener("change",event=>{
 if(event.target.id!=="audience-period")return;
 const custom=event.target.value==="custom";
 document.getElementById("audience-start").hidden=!custom;
 document.getElementById("audience-end").hidden=!custom;
});

const observer=new MutationObserver(()=>{
 decorateNews();
 decorateNewsForm();
 decorateDashboard();
});
observer.observe(app,{childList:true,subtree:true});

window.addEventListener("load",()=>{
 const approvalNav=document.getElementById("editorial-approvals-nav");
 if(approvalNav)approvalNav.hidden=!canReview();
 if(location.hash==="#aprovacoes"&&canReview())renderApprovals();
 else if(location.hash==="#audiencia")renderAudience();
});
