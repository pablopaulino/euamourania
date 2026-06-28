import { getSupabase } from "../assets/js/services/supabaseClient.js";

const app=document.getElementById("app-content"), pageSize=10;
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function toast(message,type="success"){let stack=document.getElementById("toasts");if(!stack){stack=document.createElement("div");stack.id="toasts";stack.className="toast-stack";document.body.append(stack)}const node=document.createElement("div");node.className=`toast ${type}`;node.textContent=message;stack.append(node);setTimeout(()=>node.remove(),3500)}

function enhanceTable(panel){
  if(panel.dataset.enhanced||!panel.querySelector("table"))return;panel.dataset.enhanced="true";
  const header=panel.querySelector(".panel-header"),table=panel.querySelector("table"),body=table.tBodies[0];if(!header||!body)return;
  const controls=document.createElement("div");controls.className="ads-toolbar cms-toolbar";controls.innerHTML='<input type="search" placeholder="Pesquisar nesta seção…" aria-label="Pesquisar"><select aria-label="Filtrar status"><option value="">Todos os status</option><option value="publicado">Publicado</option><option value="rascunho">Rascunho</option><option value="arquivado">Arquivado</option><option value="ativo">Ativo</option><option value="inativo">Inativo</option></select><select aria-label="Ordenar"><option value="original">Mais recentes</option><option value="az">Nome A–Z</option><option value="za">Nome Z–A</option></select>';
  header.after(controls);
  const footer=document.createElement("div");footer.className="ads-pagination";footer.innerHTML='<span></span><div class="ads-pagination-buttons"><button type="button">Anterior</button><button type="button">Próxima</button></div>';table.closest(".table-wrap").after(footer);
  const original=[...body.rows].filter(r=>r.cells.length>1),search=controls.querySelector("input"),status=controls.querySelectorAll("select")[0],sort=controls.querySelectorAll("select")[1],buttons=footer.querySelectorAll("button");let page=1;
  function render(){let rows=original.filter(r=>(!search.value||r.innerText.toLowerCase().includes(search.value.toLowerCase()))&&(!status.value||r.innerText.toLowerCase().includes(status.value)));if(sort.value!=="original")rows.sort((a,b)=>a.cells[0].innerText.localeCompare(b.cells[0].innerText,"pt-BR")*(sort.value==="za"?-1:1));const pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);original.forEach(r=>r.hidden=true);rows.slice((page-1)*pageSize,page*pageSize).forEach(r=>r.hidden=false);footer.querySelector("span").textContent=`Página ${page} de ${pages} · ${rows.length} registros`;buttons[0].disabled=page===1;buttons[1].disabled=page===pages;}
  search.addEventListener("input",()=>{page=1;render()});status.addEventListener("change",()=>{page=1;render()});sort.addEventListener("change",render);buttons[0].addEventListener("click",()=>{page--;render()});buttons[1].addEventListener("click",()=>{page++;render()});render();
  table.querySelectorAll("th").forEach((th,index)=>{if(index>1)return;th.title="Clique para ordenar";th.addEventListener("click",()=>{sort.value=sort.value==="az"?"za":"az";render()})});
}

async function enhanceDashboard(){
  const grid=app.querySelector(".dashboard-grid");if(!grid||grid.dataset.enhanced)return;grid.dataset.enhanced="true";
  const supabase=getSupabase();
  try{const {count,error}=await supabase.from("campanhas_publicitarias").select("*",{count:"exact",head:true});if(!error)grid.insertAdjacentHTML("beforeend",`<article class="metric-card"><span>Campanhas publicitárias</span><strong>${count||0}</strong><a href="publicidade.html">Abrir publicidade →</a></article>`)}catch{}
  try{const {data,error}=await supabase.from("cms_atividades").select("tabela,acao,titulo,criado_em").order("criado_em",{ascending:false}).limit(8);if(!error){const section=document.createElement("section");section.className="panel cms-activities";section.innerHTML=`<header class="panel-header"><h2>Últimas atividades</h2></header>${data?.length?`<div class="activity-list">${data.map(x=>`<div><span class="status-pill ${esc(x.acao)}">${esc(x.acao)}</span><strong>${esc(x.titulo||"Registro")}</strong><small>${esc(x.tabela.replaceAll("_"," "))} · ${new Date(x.criado_em).toLocaleString("pt-BR")}</small></div>`).join("")}</div>`:'<div class="empty-state">As próximas alterações do CMS aparecerão aqui.</div>'}`;grid.after(section)}}catch{}
}

const observer=new MutationObserver(()=>{const panel=app.querySelector(".panel");if(panel)enhanceTable(panel);enhanceDashboard()});observer.observe(app,{childList:true,subtree:true});
window.addEventListener("unhandledrejection",event=>toast(event.reason?.message||"Ocorreu um erro inesperado.","error"));
