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
 const approvals=document.getElementById("editorial-approvals-nav");
 if(approvals){approvals.dataset.module="noticias";approvals.type="button";approvals.textContent="Aprovações";}
 const audience=document.getElementById("audience-nav");
 if(audience){audience.dataset.module="insights";audience.type="button";audience.textContent="Audiência";}
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
function isSuperAdmin(){
 return access()?.admin?.funcao==="super_admin";
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
    <input id="approval-search" type="search" placeholder="Pesquisar matéria⬦">
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
    <td><div class="cms-actions"><button data-approval-preview="${item.noticia.id}">Prévia</button>${item.status==="pendente"?`<button class="primary-action" data-approval-review="${item.noticia.id}" ${item.enviado_por===access()?.user?.id&&!isSuperAdmin()?'disabled title="Sua matéria deve ser revisada por outra pessoa"':""}>${item.enviado_por===access()?.user?.id&&!isSuperAdmin()?"Aguardando outro revisor":"Revisar"}</button>`:""}${item.comentario?`<button data-approval-comment="${item.id}">Comentário</button>`:""}</div></td>
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
  <button class="dialog-close" data-dialog-close aria-label="Fechar">&times;</button>
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
  <button class="dialog-close" data-dialog-close aria-label="Fechar">&times;</button>
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
 const {data}=await db.from("noticias").select("id,status_editorial,criado_por").in("id",ids);
 const states=new Map((data||[]).map(item=>[item.id,item]));
 rows.forEach(row=>{
  const edit=row.querySelector("[data-news-edit]"),item=states.get(edit?.dataset.newsEdit),status=item?.status_editorial;
  if(!status||row.querySelector(".editorial-status"))return;
  row.querySelector(".cms-title-cell small")?.insertAdjacentHTML("afterend",`<span class="editorial-status ${status}">${esc(editorialLabel(status))}</span>`);
  if(!isSuperAdmin()&&item.criado_por===access()?.user?.id&&status==="em_revisao"){
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
 const directPublish=isSuperAdmin();
 if(publishButton){
  publishButton.hidden=!directPublish&&state!=="aprovado";
  if(directPublish)publishButton.textContent="Publicar agora";
 }
 const info=document.createElement("div");info.className="editorial-form-state";
 info.innerHTML=`<div><span>Fluxo editorial</span><strong>${esc(editorialLabel(state))}</strong></div>${latest?.comentario?`<p><strong>Comentário da revisão:</strong> ${esc(latest.comentario)}</p>`:""}`;
 actions.before(info);
 if(!directPublish&&currentNewsId&&["rascunho","ajustes_solicitados"].includes(state)&&news?.status==="rascunho"){
  const send=document.createElement("button");send.type="button";send.className="admin-button";send.dataset.sendApproval=currentNewsId;send.textContent="Enviar para aprovação";
  actions.insertBefore(send,actions.querySelector('[data-save-status="publicado"]'));
 }
 if(directPublish){
  info.insertAdjacentHTML("beforeend","<p>Como Super Admin, você pode publicar diretamente sem enviar para aprovação.</p>");
 }else if(!currentNewsId){
  info.insertAdjacentHTML("beforeend","<p>Salve o rascunho e abra-o novamente para enviar à aprovação.</p>");
 }
 if(!directPublish&&currentNewsId&&state!=="aprovado"){
  info.insertAdjacentHTML("beforeend","<p>A publicação será liberada depois da aprovação editorial.</p>");
 }
 if(!directPublish&&news?.criado_por===access()?.user?.id&&state==="em_revisao"){
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
function slugNoticiaPagina(pagina=""){const match=String(pagina||"").match(/^\/noticias\/([^/?#]+)/);return match?decodeURIComponent(match[1]):null}
async function mergeNewsPageViews(resources=[],pages=[]){
 const grouped=new Map((resources||[]).map(item=>[`${item.tipo}:${item.id}`,{...item,total:Number(item.total||0)}]));
 const counts=new Map();
 (pages||[]).forEach(page=>{const slug=slugNoticiaPagina(page.pagina);if(slug)counts.set(slug,(counts.get(slug)||0)+Number(page.total||0))});
 const slugs=[...counts.keys()];
 if(!slugs.length)return[...grouped.values()].sort((a,b)=>b.total-a.total);
 const {data,error}=await db.from("noticias").select("id,slug").in("slug",slugs);
 if(error)throw error;
 (data||[]).forEach(news=>{
  const key=`noticia:${news.id}`,current=grouped.get(key)||{tipo:"noticia",id:news.id,evento:"page_view",total:0};
  current.total=Math.max(Number(current.total||0),counts.get(news.slug)||0);
  current.evento="page_view";
  grouped.set(key,current);
 });
 return[...grouped.values()].sort((a,b)=>b.total-a.total);
}
async function consolidatedNewsAudience(startString,endString){
 const startIso=`${startString}T00:00:00-03:00`,endDate=new Date(`${endString}T00:00:00-03:00`);
 endDate.setDate(endDate.getDate()+1);
 const {data,error}=await db.from("analytics_eventos")
  .select("tipo,pagina,recurso_tipo,recurso_id")
  .in("tipo",["page_view","noticia_view"])
  .gte("criado_em",startIso).lt("criado_em",endDate.toISOString()).limit(10000);
 if(error)throw error;
 const byId=new Map(),bySlug=new Map();
 (data||[]).forEach(item=>{
  if(item.tipo==="noticia_view"&&item.recurso_id){
   byId.set(item.recurso_id,(byId.get(item.recurso_id)||0)+1);
   return;
  }
  if(item.tipo==="page_view"){
   const slug=slugNoticiaPagina(item.pagina);
   if(slug)bySlug.set(slug,(bySlug.get(slug)||0)+1);
  }
 });
 const ids=[...byId.keys()],slugs=[...bySlug.keys()],newsById=new Map(),newsBySlug=new Map();
 if(ids.length){
  const {data:rows}=await db.from("noticias").select("id,titulo,slug").in("id",ids);
  (rows||[]).forEach(item=>newsById.set(item.id,item));
 }
 if(slugs.length){
  const {data:rows}=await db.from("noticias").select("id,titulo,slug").in("slug",slugs);
  (rows||[]).forEach(item=>{newsById.set(item.id,item);newsBySlug.set(item.slug,item)});
 }
 bySlug.forEach((total,slug)=>{
  const news=newsBySlug.get(slug);
  if(news)byId.set(news.id,Math.max(byId.get(news.id)||0,total));
 });
 const ranking=[...byId.entries()].map(([id,total])=>{
  const news=newsById.get(id);
  return{tipo:"noticia",id,nome:news?.titulo||"Noticia removida",slug:news?.slug,total};
 }).filter(item=>item.total>0).sort((a,b)=>b.total-a.total);
 return{total:ranking.reduce((sum,item)=>sum+Number(item.total||0),0),ranking};
}
async function resourceNames(resources=[]){
 const config={noticia:["noticias","titulo"],guia:["guia_comercial","nome"],evento:["eventos","titulo"],evento_principal:["eventos_principais","nome"],evento_edicao:["eventos_edicoes","titulo"],turismo:["turismo","nome"],link:["links","titulo"]};
 const map=new Map();
 await Promise.all(Object.entries(config).map(async([type,[table,label]])=>{
  const ids=[...new Set(resources.filter(item=>item.tipo===type).map(item=>item.id).filter(Boolean))];
  if(!ids.length)return;
  const select = type === "evento_edicao" ? `id,${label},slug,ano,eventos_principais(slug,nome)` : `id,${label},slug`;
  const {data}=await db.from(table).select(select).in("id",ids);
  (data||[]).forEach(item=>map.set(`${type}:${item.id}`,{nome:item[label],slug:item.slug,ano:item.ano,eventoSlug:item.eventos_principais?.slug,eventoNome:item.eventos_principais?.nome}));
 }));
 return resources.map(item=>({...item,...(map.get(`${item.tipo}:${item.id}`)||{nome:"Conteúdo removido"})}));
}
function completeDailySeries(start,end,series=[]){
 const values=new Map(series.map(item=>[item.dia,Number(item.visualizacoes||0)]));
 const result=[],cursor=new Date(`${start}T12:00:00Z`),last=new Date(`${end}T12:00:00Z`);
 while(cursor<=last){
  const day=cursor.toISOString().slice(0,10);
  result.push({dia:day,visualizacoes:values.get(day)||0});
  cursor.setUTCDate(cursor.getUTCDate()+1);
 }
 return result;
}
function chart(series=[],showValues=false){
 const max=Math.max(1,...series.map(item=>Number(item.visualizacoes||0)));
 return`<div class="audience-chart ${showValues?"show-values":""}" aria-label="Visualizações por dia">${series.map(item=>`<div class="audience-bar-wrap"><button type="button" class="audience-column" data-chart-bar title="${esc(item.dia)}: ${item.visualizacoes} visualizações" aria-label="${esc(item.dia)}: ${item.visualizacoes} visualizações"><strong class="audience-bar-value">${Number(item.visualizacoes||0).toLocaleString("pt-BR")}</strong><span class="audience-bar" style="height:${Math.max(4,Math.round(item.visualizacoes/max*150))}px"></span></button><small>${esc(item.dia.slice(5))}</small></div>`).join("")||'<div class="empty-state">Sem visualizações no período.</div>'}</div>`;
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
const fmt=value=>Number(value||0).toLocaleString("pt-BR");
const typeLabel={noticia:"Notícia",guia:"Guia",turismo:"Turismo",evento:"Agenda",evento_principal:"Evento principal",evento_edicao:"Edição de evento",link:"Link"};
function contentUrl(item){
 if(item.tipo==="noticia"&&item.slug)return`/noticias/${encodeURIComponent(item.slug)}`;
 if(item.tipo==="guia"&&item.slug)return`/guia/${encodeURIComponent(item.slug)}/`;
 if(item.tipo==="turismo"&&item.slug)return`/turismo/${encodeURIComponent(item.slug)}/`;
 if(item.tipo==="evento_principal"&&item.slug)return`/eventos/${encodeURIComponent(item.slug)}`;
 if(item.tipo==="evento_edicao"&&item.eventoSlug&&item.ano)return`/eventos/${encodeURIComponent(item.eventoSlug)}/${encodeURIComponent(item.ano)}`;
 return null;
}
function compactRank(rows=[],label,value="total",limit=6){
 return rows.slice(0,limit).map((row,index)=>`<div class="audience-rank-row"><span>${index+1}</span><div><strong>${esc(row[label]||"Não identificado")}</strong></div><small>${fmt(row[value])}</small></div>`).join("")||'<div class="empty-state">Sem dados no período.</div>';
}
function contentCard(item,index,total=1){
 const share=total?Math.round((Number(item.total||0)/total)*100):0,url=contentUrl(item);
 return`<article class="audience-content-card"><span>${index+1}</span><div><p>${esc(typeLabel[item.tipo]||item.tipo||"Conteúdo")}</p><h3>${esc(item.nome||"Conteúdo removido")}</h3><small>${fmt(item.total)} interação(ões) · ${share}% do ranking</small></div>${url?`<a href="${url}" target="_blank" rel="noopener">Abrir</a>`:""}</article>`;
}
function audienceTable(headers=[],rows=[],empty="Sem dados no período."){
 const hasRows=Array.isArray(rows)?rows.length:Boolean(rows),body=Array.isArray(rows)?rows.join(""):rows;
 return`<div class="audience-table-wrap"><table class="audience-table"><thead><tr>${headers.map(item=>`<th>${esc(item)}</th>`).join("")}</tr></thead><tbody>${hasRows?body:`<tr><td colspan="${headers.length}"><div class="empty-state compact">${esc(empty)}</div></td></tr>`}</tbody></table></div>`;
}
function contentRows(items=[],total=1,limit=12){
 return items.slice(0,limit).map((item,index)=>{
  const share=total?Math.round((Number(item.total||0)/total)*100):0,url=contentUrl(item);
  return`<tr><td><span class="audience-position">${index+1}</span></td><td><strong class="audience-ellipsis" title="${esc(item.nome||"Conteúdo removido")}">${esc(item.nome||"Conteúdo removido")}</strong></td><td><span class="audience-badge">${esc(typeLabel[item.tipo]||item.tipo||"Conteúdo")}</span></td><td>${fmt(item.total)}</td><td>${share}%</td><td>${url?`<a class="audience-open-link" href="${url}" target="_blank" rel="noopener">Abrir</a>`:"—"}</td></tr>`;
 }).join("");
}
function simpleRows(rows=[],label,value="total",limit=8){
 return rows.slice(0,limit).map((row,index)=>`<tr><td><span class="audience-position">${index+1}</span></td><td><strong class="audience-ellipsis" title="${esc(row[label]||"Não identificado")}">${esc(row[label]||"Não identificado")}</strong></td><td>${fmt(row[value])}</td></tr>`);
}
function barRows(rows=[],label,value="total",limit=6){
 const max=Math.max(1,...rows.map(item=>Number(item[value]||0)));
 return rows.slice(0,limit).map((row,index)=>`<div class="audience-bar-rank"><div><span>${index+1}</span><strong class="audience-ellipsis" title="${esc(row[label]||"Não identificado")}">${esc(row[label]||"Não identificado")}</strong><small>${fmt(row[value])}</small></div><i style="width:${Math.max(4,Math.round(Number(row[value]||0)/max*100))}%"></i></div>`).join("")||'<div class="empty-state compact">Sem dados no período.</div>';
}
function metricKpi([label,value,change,help]){
 const current=String(change||"0%"),down=current.startsWith("-"),neutral=current==="0%"||current==="—";
 return`<article class="audience-kpi" title="${esc(help||"")}"><strong>${fmt(value)}</strong><span>${esc(label)}</span><small class="${down?"down":neutral?"":"up"}">${neutral?"•":down?"↓":"↑"} ${esc(current)}</small></article>`;
}
async function countRows(table,build=query=>query){
 const {count,error}=await build(db.from(table).select("*",{count:"exact",head:true}));
 if(error)throw error;
 return count||0;
}
async function listRows(table,select,build=query=>query){
 const {data,error}=await build(db.from(table).select(select));
 if(error)throw error;
 return data||[];
}
async function appAudience(startString,endString){
 if(!temPermissao(access()?.admin,"notificacoes","ler")){
  return{available:false,error:"Seu perfil nao possui permissao para consultar dados do app."};
 }
 const startIso=`${startString}T00:00:00.000Z`,endIso=`${endString}T23:59:59.999Z`;
 try{
  const [ativos,ativosPeriodo,android,ios,tokens,notifications,failures]=await Promise.all([
   countRows("app_push_tokens",query=>query.eq("ativo",true)),
   countRows("app_push_tokens",query=>query.eq("ativo",true).gte("visto_em",startIso)),
   countRows("app_push_tokens",query=>query.eq("ativo",true).eq("plataforma","android")),
   countRows("app_push_tokens",query=>query.eq("ativo",true).eq("plataforma","ios")),
   listRows("app_push_tokens","plataforma,app_version,locale,ativo,visto_em,criado_em",query=>query.eq("ativo",true).order("visto_em",{ascending:false}).limit(600)),
   listRows("app_notificacoes","titulo,status,plataforma,total_destinatarios,total_aceitos,total_erros,enviado_em,criado_em",query=>query.gte("criado_em",startIso).lte("criado_em",endIso).order("criado_em",{ascending:false}).limit(80)),
   countRows("app_push_falhas",query=>query.gte("criado_em",startIso).lte("criado_em",endIso))
  ]);
  const versions=new Map(),locales=new Map();
  tokens.forEach(item=>{
   const version=item.app_version||"Sem versao";
   versions.set(version,(versions.get(version)||0)+1);
   const locale=item.locale||"Nao informado";
   locales.set(locale,(locales.get(locale)||0)+1);
  });
  const sent=notifications.filter(item=>item.status==="enviado").length;
  const accepted=notifications.reduce((sum,item)=>sum+Number(item.total_aceitos||0),0);
  const recipients=notifications.reduce((sum,item)=>sum+Number(item.total_destinatarios||0),0);
  const errors=notifications.reduce((sum,item)=>sum+Number(item.total_erros||0),0);
  return{available:true,ativos,ativosPeriodo,platforms:{android,ios},
   versions:[...versions.entries()].map(([label,total])=>({label,total})).sort((a,b)=>b.total-a.total),
   locales:[...locales.entries()].map(([label,total])=>({label,total})).sort((a,b)=>b.total-a.total),
   notifications,sent,accepted,recipients,errors,failures};
 }catch(error){
  return{available:false,error:error.message};
 }
}
function appRank(rows=[],limit=5){
 return rows.slice(0,limit).map((item,index)=>`<div class="audience-rank-row"><span>${index+1}</span><div><strong>${esc(item.label)}</strong></div><small>${fmt(item.total)}</small></div>`).join("")||'<div class="empty-state">Sem dados do app.</div>';
}
function appStatusLabel(status){
 return({rascunho:"Rascunho",enviando:"Enviando",enviado:"Enviado",falhou:"Falhou",cancelado:"Cancelado"})[status]||status||"Sem status";
}
function appPanels(data){
 if(!data?.available){
  return`<section class="panel wide app-audience-panel unavailable"><header class="panel-header"><div><p class="eyebrow">Viva Ur\u00e2nia</p><h2>Audi\u00eancia do app</h2><p>Os dados do aplicativo ficam separados dos eventos do site.</p></div></header><div class="empty-state">${esc(data?.error||"Dados do app indisponiveis no momento.")}</div></section>`;
 }
 const delivery=data.recipients?Math.round((data.accepted/data.recipients)*100):0;
 return`<section class="panel wide app-audience-panel"><header class="panel-header"><div><p class="eyebrow">Viva Ur\u00e2nia</p><h2>Audi\u00eancia do app</h2><p>Instalacoes com push ativo, atividade recente e desempenho das notificacoes no periodo.</p></div><span class="audience-source-pill">Fonte: app_push_tokens</span></header>
  <div class="app-audience-grid">
   <article><span>Aparelhos ativos</span><strong>${fmt(data.ativos)}</strong><small>Total com push ativo</small></article>
   <article><span>Ativos no periodo</span><strong>${fmt(data.ativosPeriodo)}</strong><small>Vistos dentro do filtro</small></article>
   <article><span>Android</span><strong>${fmt(data.platforms.android)}</strong><small>${data.ativos?Math.round(data.platforms.android/data.ativos*100):0}% dos aparelhos</small></article>
   <article><span>iPhone</span><strong>${fmt(data.platforms.ios)}</strong><small>${data.ativos?Math.round(data.platforms.ios/data.ativos*100):0}% dos aparelhos</small></article>
   <article><span>Push enviados</span><strong>${fmt(data.sent)}</strong><small>${fmt(data.accepted)} aceitos</small></article>
   <article><span>Entrega</span><strong>${delivery}%</strong><small>${fmt(data.errors+data.failures)} falha(s)</small></article>
  </div>
  <div class="app-audience-columns">
   <div><h3>Versoes do app</h3>${appRank(data.versions)}</div>
   <div><h3>Campanhas recentes</h3>${data.notifications.slice(0,5).map((item,index)=>`<div class="audience-rank-row"><span>${index+1}</span><div><strong>${esc(item.titulo)}</strong><small>${esc(appStatusLabel(item.status))} · ${esc(item.plataforma)}</small></div><small>${fmt(item.total_aceitos||0)} aceitos</small></div>`).join("")||'<div class="empty-state">Sem push no periodo.</div>'}</div>
  </div>
 </section>`;
}
function strategicInsights(summary={},previous={},series=[],content=[],searches=[]){
 const views=Number(summary.visualizacoes||0),useful=Number(summary.whatsapp||0)+Number(summary.externos||0)+Number(summary.cliques_conteudo||0);
 const avg=Math.round(views/Math.max(series.length,1)),best=[...series].sort((a,b)=>Number(b.visualizacoes||0)-Number(a.visualizacoes||0))[0];
 const items=[
  views>Number(previous.visualizacoes||0)?["Audiência em alta",`As visualizações cresceram ${variation(views,previous.visualizacoes||0)} em relação ao período anterior.`]:["Atenção ao alcance",`As visualizações ficaram ${variation(views,previous.visualizacoes||0)} versus o período anterior.`],
  ["Média diária",`${fmt(avg)} visualizações por dia no período selecionado.`],
  best?.visualizacoes?["Melhor dia",`${best.dia.split("-").reverse().join("/")} concentrou ${fmt(best.visualizacoes)} visualizações.`]:["Sem pico definido","Ainda não há volume suficiente para identificar um melhor dia."],
  useful?["Ações úteis",`${fmt(useful)} cliques ou interações indicam intenção real do público.`]:["Oportunidade","Poucos cliques úteis; vale reforçar chamadas para WhatsApp, guia e links."],
  searches?.length?["Busca interna",`"${searches[0].termo}" foi o termo mais pesquisado no portal.`]:["Busca interna","Ainda não há pesquisas suficientes para revelar demanda do público."],
  content?.[0]?["Conteúdo líder",`${content[0].nome} puxou o ranking de conteúdos.`]:["Conteúdo líder","Ainda não há conteúdo destacado no período."]
 ];
 return items.map(([title,text])=>`<article><strong>${esc(title)}</strong><p>${esc(text)}</p></article>`).join("");
}
async function renderAudience(days=30,customStart=null,customEnd=null){
 setActive("audience-nav","Audiência","audiencia");
 loading();
 try{
  const end=customEnd?new Date(`${customEnd}T12:00:00`):new Date();
  const start=customStart?new Date(`${customStart}T12:00:00`):new Date(end.getTime()-(days-1)*864e5);
  const startString=isoDate(start),endString=isoDate(end);
  const periodDays=Math.max(1,Math.round((end-start)/864e5)+1);
  const previousEnd=new Date(start.getTime()-864e5),previousStart=new Date(previousEnd.getTime()-(periodDays-1)*864e5);
  const previousStartString=isoDate(previousStart),previousEndString=isoDate(previousEnd);
  const [data,ads,google,appStats,newsStats,previousNewsStats]=await Promise.all([
   obterAudienciaAvancada(startString,endString),
   db.from("publicidade_resumo").select("nome,impressoes,cliques,ctr").order("impressoes",{ascending:false}).limit(8),
   googleAudience(startString,endString),
   appAudience(startString,endString),
   consolidatedNewsAudience(startString,endString),
   consolidatedNewsAudience(previousStartString,previousEndString)
  ]);
  data.recursos=await resourceNames(await mergeNewsPageViews(data.recursos||[],data.paginas||[]));
  data.resumo={...(data.resumo||{}),noticias:newsStats.total};
  audienceData={...data,app:appStats,noticias_consolidadas:newsStats};
  const summary=data.resumo||{},previous=data.anterior||{},previousNews=Number(previousNewsStats.total||0);
  const previousUsefulClicks=Number(previous.whatsapp||0)+Number(previous.externos||0)+Number(previous.cliques_conteudo||0);
  const isCustomRange=Boolean(customStart&&customEnd);
  const metrics=[
   ["Visualizações",summary.visualizacoes||0,variation(summary.visualizacoes||0,previous.visualizacoes||0)],
   ["Visitantes",summary.visitantes||0,variation(summary.visitantes||0,previous.visitantes||0)],
   ["Notícias lidas",summary.noticias||0,variation(summary.noticias||0,previousNews)],
   ["Cliques WhatsApp",summary.whatsapp||0,variation(summary.whatsapp||0,previous.whatsapp||0)],
   ["Links externos",summary.externos||0,variation(summary.externos||0,previous.externos||0)],
   ["Cliques em conteúdos",summary.cliques_conteudo||0,variation(summary.cliques_conteudo||0,previous.cliques_conteudo||0)]
  ];
  const content=[...(newsStats.ranking||[]),...(data.recursos||[]).filter(item=>item.tipo!=="noticia")].filter(item=>["noticia","guia","evento","evento_principal","evento_edicao","turismo","link"].includes(item.tipo)).sort((a,b)=>Number(b.total||0)-Number(a.total||0)).slice(0,12);
  const series=completeDailySeries(startString,endString,data.serie),usefulClicks=Number(summary.whatsapp||0)+Number(summary.externos||0)+Number(summary.cliques_conteudo||0);
  const strategicMetrics=[
   ["Visualizações",summary.visualizacoes||0,variation(summary.visualizacoes||0,previous.visualizacoes||0),"Volume total de páginas vistas"],
   ["Visitantes",summary.visitantes||0,variation(summary.visitantes||0,previous.visitantes||0),"Sessões identificadas sem dados pessoais"],
   ["Notícias lidas",summary.noticias||0,variation(summary.noticias||0,previousNews),"Leituras consolidadas por URL e ID da matéria"],
   ["Ações úteis",usefulClicks,variation(usefulClicks,previousUsefulClicks),"WhatsApp, links externos e cliques em conteúdos"]
  ];
   const news=(newsStats.ranking||[]).slice(0,8),localServices=content.filter(item=>item.tipo!=="noticia").slice(0,8),contentTotal=content.reduce((sum,item)=>sum+Number(item.total||0),0);
   const adsRows=ads.data||[],adsImpressions=adsRows.reduce((sum,item)=>sum+Number(item.impressoes||0),0),adsClicks=adsRows.reduce((sum,item)=>sum+Number(item.cliques||0),0);
   const adsCtr=adsImpressions?`${((adsClicks/adsImpressions)*100).toFixed(1).replace(".",",")}%`:"0%";
   const savedTab=sessionStorage.getItem("audience-tab")||"overview",activeTab=["overview","content","acquisition","app","google","ads"].includes(savedTab)?savedTab:"overview";
   const tabButton=(id,label)=>`<button type="button" class="${activeTab===id?"active":""}" data-audience-tab-button="${id}" role="tab" aria-selected="${activeTab===id?"true":"false"}">${label}</button>`;
   const tabPanel=(id,html)=>`<section class="audience-tab-panel ${activeTab===id?"active":""}" data-audience-tab="${id}" role="tabpanel">${html}</section>`;
   const periodLabel=isCustomRange?`${startString.split("-").reverse().join("/")} a ${endString.split("-").reverse().join("/")}`:`Últimos ${periodDays} dias`;
   app.innerHTML=`<section class="audience-page-head">
    <div><h2>Audiência</h2><p>Entenda como o público encontra, consome e interage com o Eu Amo Urânia.</p></div>
    <div class="audience-filters">
     <label><span>Período</span><select id="audience-period"><option value="7" ${!isCustomRange&&days===7?"selected":""}>7 dias</option><option value="30" ${!isCustomRange&&days===30?"selected":""}>30 dias</option><option value="90" ${!isCustomRange&&days===90?"selected":""}>90 dias</option><option value="custom" ${isCustomRange?"selected":""}>Personalizado</option></select></label>
     <label data-custom-date ${isCustomRange?"":"hidden"}><span>Início</span><input id="audience-start" type="date" value="${isoDate(start)}"></label>
     <label data-custom-date ${isCustomRange?"":"hidden"}><span>Fim</span><input id="audience-end" type="date" value="${isoDate(end)}"></label>
     <div class="audience-filter-actions"><button class="admin-button secondary" id="audience-apply">Aplicar</button><button class="admin-button secondary" id="audience-export">Exportar CSV</button></div>
    </div>
   </section>
   <div class="audience-kpi-grid">${strategicMetrics.map(metricKpi).join("")}</div>
   <nav class="audience-tabs" role="tablist" aria-label="Seções da audiência">
    ${tabButton("overview","Visão geral")}
    ${tabButton("content","Conteúdo")}
    ${tabButton("acquisition","Aquisição")}
    ${tabButton("app","Viva Urânia")}
    ${tabButton("google","Google")}
    ${tabButton("ads","Publicidade")}
   </nav>
   <div class="audience-tab-panels">
    ${tabPanel("overview",`<div class="audience-overview-grid">
     <section class="panel audience-chart-panel"><header class="panel-header"><div><p class="eyebrow">${esc(periodLabel)}</p><h2>Evolução diária</h2><p>Picos e quedas ajudam a entender o efeito de publicações, buscas e compartilhamentos.</p></div></header>${chart(series,Math.round((end-start)/864e5)+1<=7)}</section>
     <section class="panel audience-intel-panel"><header class="panel-header"><div><p class="eyebrow">Leitura rápida</p><h2>O que merece atenção</h2></div></header><div class="audience-insights">${strategicInsights(summary,previous,series,content,data.buscas||[])}</div></section>
    </div>
    <section class="panel audience-ranking-panel"><header class="panel-header"><div><h2>Ranking estratégico</h2><p>Conteúdos, empresas, turismo e eventos com maior movimento no período.</p></div></header>${audienceTable(["#","Conteúdo","Tipo","Interações","Participação",""],contentRows(content,contentTotal,8),"Sem conteúdos com interação no período.")}</section>`)}
    ${tabPanel("content",`<div class="audience-split-grid">
     <section class="panel wide"><header class="panel-header"><div><h2>Desempenho por conteúdo</h2><p>Ranking consolidado entre notícias, guia, turismo, eventos e links.</p></div></header>${audienceTable(["#","Conteúdo","Tipo","Interações","Participação",""],contentRows(content,contentTotal,12),"Sem conteúdos no período.")}</section>
     <section class="panel"><header class="panel-header"><div><h2>Notícias lidas</h2><p>Consolidado por URL e ID da matéria.</p></div></header>${audienceTable(["#","Matéria","Interações"],simpleRows(news,"nome","total",8),"Sem notícias no período.")}</section>
     <section class="panel"><header class="panel-header"><div><h2>Guia, turismo e eventos</h2><p>Interações locais fora das notícias.</p></div></header>${audienceTable(["#","Conteúdo","Interações"],simpleRows(localServices,"nome","total",8),"Sem interações locais no período.")}</section>
    </div>`)}
    ${tabPanel("acquisition",`<div class="audience-split-grid">
     <section class="panel"><header class="panel-header"><h2>Páginas mais acessadas</h2></header>${audienceTable(["#","Página","Acessos"],simpleRows(data.paginas,"pagina","total",10),"Sem páginas no período.")}</section>
     <section class="panel"><header class="panel-header"><h2>Origem dos acessos</h2></header>${barRows(data.origens,"origem","total",8)}</section>
     <section class="panel"><header class="panel-header"><h2>Dispositivos</h2></header>${barRows(data.dispositivos,"dispositivo","total",6)}</section>
     <section class="panel"><header class="panel-header"><h2>Buscas internas</h2></header>${audienceTable(["#","Termo pesquisado","Buscas"],simpleRows(data.buscas,"termo","total",10),"Sem buscas no período.")}</section>
    </div>`)}
    ${tabPanel("app",`<div class="audience-split-grid app-tab">${appPanels(appStats)}</div>`)}
    ${tabPanel("google",`<div class="audience-split-grid google-tab">${googlePanels(google)}</div>`)}
    ${tabPanel("ads",`<div class="audience-mini-kpis"><article><span>Impressões</span><strong>${fmt(adsImpressions)}</strong></article><article><span>Cliques</span><strong>${fmt(adsClicks)}</strong></article><article><span>CTR médio</span><strong>${adsCtr}</strong></article><article><span>Campanhas</span><strong>${fmt(adsRows.length)}</strong></article></div><section class="panel"><header class="panel-header"><div><h2>Campanhas publicitárias</h2><p>Desempenho dos anúncios internos no período.</p></div></header>${audienceTable(["#","Campanha","Impressões","Cliques","CTR"],adsRows.slice(0,12).map((item,index)=>`<tr><td><span class="audience-position">${index+1}</span></td><td><strong class="audience-ellipsis">${esc(item.nome||"Campanha")}</strong></td><td>${fmt(item.impressoes)}</td><td>${fmt(item.cliques)}</td><td>${item.ctr||0}%</td></tr>`),"Sem campanhas no período.")}</section>`)}
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
 if(audienceData.app?.available){
  rows.push(["App","Aparelhos ativos",audienceData.app.ativos]);
  rows.push(["App","Aparelhos ativos no periodo",audienceData.app.ativosPeriodo]);
  rows.push(["App","Android",audienceData.app.platforms.android]);
  rows.push(["App","iPhone",audienceData.app.platforms.ios]);
  rows.push(["App","Push enviados",audienceData.app.sent]);
  rows.push(["App","Push aceitos",audienceData.app.accepted]);
  (audienceData.app.versions||[]).forEach(item=>rows.push(["Versoes do app",item.label,item.total]));
 }
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
 if(button.hasAttribute("data-chart-bar")){
  document.querySelectorAll("[data-chart-bar].active").forEach(item=>{if(item!==button)item.classList.remove("active")});
  button.classList.toggle("active");return;
 }
 if(button.dataset.newsEdit)currentNewsId=button.dataset.newsEdit;
 if(button.hasAttribute("data-news-new"))currentNewsId=null;
 if(button.id==="editorial-approvals-nav"||button.id==="dashboard-approvals"){event.preventDefault();event.stopImmediatePropagation();renderApprovals();return}
  if(button.id==="audience-nav"||button.id==="dashboard-audience"){event.preventDefault();event.stopImmediatePropagation();renderAudience();return}
  if(button.dataset.audienceTabButton){
   const tab=button.dataset.audienceTabButton;
   document.querySelectorAll("[data-audience-tab-button]").forEach(item=>{item.classList.toggle("active",item===button);item.setAttribute("aria-selected",item===button?"true":"false")});
   document.querySelectorAll("[data-audience-tab]").forEach(item=>item.classList.toggle("active",item.dataset.audienceTab===tab));
   sessionStorage.setItem("audience-tab",tab);
   return;
  }
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
  if(period==="custom"){renderAudience(30,start,end);return}
  renderAudience(Number(period));return;
 }
 if(button.id==="audience-export"){exportAudience();return}
},true);

document.addEventListener("change",event=>{
 if(event.target.id!=="audience-period")return;
 const custom=event.target.value==="custom";
 document.querySelectorAll("[data-custom-date]").forEach(item=>{item.hidden=!custom});
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
