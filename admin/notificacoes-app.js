import { exigirPermissao, sair, temPermissao } from "./auth.js";
import { getSupabase } from "../assets/js/services/supabaseClient.js";

const app=document.getElementById("push-app"),db=getSupabase();
let access=null,notifications=[],deviceCounts={total:0,android:0,ios:0};
const esc=(value="")=>String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const fmt=value=>value?new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"—";
function toast(message,type="success"){const item=document.createElement("div");item.className=`toast ${type}`;item.textContent=message;document.getElementById("toasts").append(item);setTimeout(()=>item.remove(),4200)}
function statusLabel(status){return({rascunho:"Rascunho",enviando:"Enviando",enviado:"Enviado",falhou:"Falhou",cancelado:"Cancelado"})[status]||status}

async function load(){
  app.innerHTML='<div class="skeleton"></div><div class="skeleton"></div>';
  const[{data:rows,error},{data:tokens,error:tokenError}]=await Promise.all([
    db.from("app_notificacoes").select("*").order("criado_em",{ascending:false}).limit(100),
    db.from("app_push_tokens").select("plataforma").eq("ativo",true)
  ]);
  if(error||tokenError){app.innerHTML=`<section class="push-card"><h3>Não foi possível carregar</h3><p>${esc(error?.message||tokenError?.message)}</p></section>`;return}
  notifications=rows||[];
  deviceCounts={total:tokens.length,android:tokens.filter(item=>item.plataforma==="android").length,ios:tokens.filter(item=>item.plataforma==="ios").length};
  render();
}
function render(){
  const sent=notifications.filter(item=>item.status==="enviado").length;
  const accepted=notifications.reduce((sum,item)=>sum+(item.total_aceitos||0),0);
  const canDelete=temPermissao(access.admin,"notificacoes","excluir");
  app.innerHTML=`
    <section class="push-metrics">
      <article class="metric-card"><span>Aparelhos ativos</span><strong>${deviceCounts.total}</strong></article>
      <article class="metric-card"><span>Android</span><strong>${deviceCounts.android}</strong></article>
      <article class="metric-card"><span>iPhone</span><strong>${deviceCounts.ios}</strong></article>
      <article class="metric-card"><span>Envios aceitos</span><strong>${accepted}</strong><em>${sent} campanhas</em></article>
    </section>
    <section class="push-card table-card">
      <div class="push-history-head"><h3>Histórico</h3>${canDelete&&notifications.length?'<button class="admin-button secondary" id="clear-history">Limpar histórico</button>':""}</div>
      <table class="push-table"><thead><tr><th>Notificação</th><th>Público</th><th>Status</th><th>Resultado</th><th>Data</th><th>Ações</th></tr></thead>
      <tbody>${notifications.map(item=>`<tr>
        <td class="push-copy"><strong>${esc(item.titulo)}</strong><small>${esc(item.mensagem)}</small></td>
        <td>${esc(item.plataforma)}</td>
        <td><span class="status-pill ${esc(item.status)}">${esc(statusLabel(item.status))}</span></td>
        <td>${item.total_aceitos||0} aceitos${item.total_erros?` · ${item.total_erros} erros`:""}</td>
        <td>${fmt(item.enviado_em||item.criado_em)}</td>
        <td><div class="push-row-actions">${["rascunho","falhou"].includes(item.status)?`<button class="admin-button" data-send="${item.id}">Enviar</button>`:""}${canDelete?`<button class="admin-button secondary" data-delete="${item.id}">Excluir</button>`:""}</div></td>
      </tr>`).join("")||'<tr><td colspan="6">Nenhuma notificação criada.</td></tr>'}</tbody></table>
    </section>`;
  app.querySelectorAll("[data-send]").forEach(button=>button.onclick=()=>send(button.dataset.send,button));
  app.querySelectorAll("[data-delete]").forEach(button=>button.onclick=()=>removeNotification(button.dataset.delete,button));
  const clear=document.getElementById("clear-history");if(clear)clear.onclick=()=>clearHistory(clear);
}
function openForm(){
  app.innerHTML=`<section class="push-card"><h3>Nova notificação</h3>
    <form id="push-form" class="push-form">
      <div class="push-notice full push-field">A mensagem será enviada somente após sua confirmação. Use textos objetivos e envie apenas informações relevantes.</div>
      <div class="push-field full"><label>Título *</label><input name="titulo" maxlength="80" required placeholder="Ex.: Agenda do fim de semana"><small class="push-counter" id="title-count">0/80</small></div>
      <div class="push-field full"><label>Mensagem *</label><textarea name="mensagem" maxlength="220" required placeholder="Conte a novidade em poucas palavras."></textarea><small class="push-counter" id="body-count">0/220</small></div>
      <div class="push-field"><label>Público</label><select name="plataforma"><option value="todos">Android e iPhone</option><option value="android">Somente Android</option><option value="ios">Somente iPhone</option></select></div>
      <div class="push-field"><label>Ao tocar, abrir</label><select name="destino_tipo"><option value="home">Página inicial</option><option value="empresa">Empresa</option><option value="turismo">Turismo</option><option value="evento">Evento</option></select></div>
      <div class="push-field full" id="destination-field" hidden><label>Slug do conteúdo</label><input name="destino_valor" maxlength="160" placeholder="exemplo-do-conteudo"><small>Use o slug exibido na URL do conteúdo.</small></div>
      <div class="push-actions"><button type="button" class="admin-button secondary" id="cancel">Cancelar</button><button class="admin-button">Salvar rascunho</button></div>
    </form></section>`;
  const form=document.getElementById("push-form"),destination=document.getElementById("destination-field");
  form.elements.titulo.oninput=()=>document.getElementById("title-count").textContent=`${form.elements.titulo.value.length}/80`;
  form.elements.mensagem.oninput=()=>document.getElementById("body-count").textContent=`${form.elements.mensagem.value.length}/220`;
  form.elements.destino_tipo.onchange=()=>destination.hidden=form.elements.destino_tipo.value==="home";
  document.getElementById("cancel").onclick=render;
  form.onsubmit=async event=>{
    event.preventDefault();
    const button=event.submitter,values=Object.fromEntries(new FormData(form));
    button.disabled=true;button.textContent="Salvando…";
    const{error}=await db.from("app_notificacoes").insert({...values,criado_por:access.user.id});
    if(error){toast(error.message,"error");button.disabled=false;button.textContent="Salvar rascunho";return}
    toast("Rascunho salvo. Revise e clique em Enviar.");await load();
  };
}
async function send(id,button){
  if(!confirm("Enviar esta notificação agora? Essa ação alcançará todos os aparelhos do público selecionado."))return;
  button.disabled=true;button.textContent="Enviando…";
  try{
    const{data:{session}}=await db.auth.getSession();
    const response=await fetch("/api/push-send",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({id})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Não foi possível enviar.");
    toast(`Notificação enviada: ${data.accepted} aceitas, ${data.errors} erros.`);await load();
  }catch(error){toast(error.message,"error");button.disabled=false;button.textContent="Enviar"}
}
async function removeNotification(id,button){
  if(!confirm("Excluir esta notificação do histórico? Os aparelhos cadastrados não serão removidos."))return;
  button.disabled=true;button.textContent="Excluindo…";
  const{error}=await db.from("app_notificacoes").delete().eq("id",id);
  if(error){toast(error.message,"error");button.disabled=false;button.textContent="Excluir";return}
  toast("Notificação excluída do histórico.");await load();
}
async function clearHistory(button){
  const processed=notifications.filter(item=>["enviado","falhou","cancelado"].includes(item.status));
  if(!processed.length){toast("Não há envios concluídos para limpar.","error");return}
  if(!confirm(`Excluir ${processed.length} registro(s) concluído(s) do histórico? Rascunhos e aparelhos cadastrados serão mantidos.`))return;
  button.disabled=true;button.textContent="Limpando…";
  const{error}=await db.from("app_notificacoes").delete().in("id",processed.map(item=>item.id));
  if(error){toast(error.message,"error");button.disabled=false;button.textContent="Limpar histórico";return}
  toast("Histórico concluído removido.");await load();
}

access=await exigirPermissao("notificacoes","acessar");
if(access){
  document.getElementById("admin-user").textContent=access.admin?.nome||access.user.email;
  document.getElementById("logout").onclick=sair;
  document.getElementById("mobile-menu").onclick=()=>document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("new-notification").onclick=openForm;
  await load();
}
