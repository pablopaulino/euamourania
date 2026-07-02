import { callPublicRpc, fetchPublicRows } from "../services/publicDataService.js";

const once=new Set();
const SESSION_KEY="euamourania_audience_session";
const SOURCE_KEY="euamourania_audience_source";
const DEDUPE_KEY="euamourania_audience_events";
function sessionId(){
 try{
  let id=sessionStorage.getItem(SESSION_KEY);
  if(!id){id=crypto.randomUUID();sessionStorage.setItem(SESSION_KEY,id)}
  return id;
 }catch{return null}
}
function source(){
 try{
  const stored=sessionStorage.getItem(SOURCE_KEY);if(stored)return stored;
  const utm=new URLSearchParams(location.search).get("utm_source");
  const ref=document.referrer?new URL(document.referrer):null;
  const value=(utm||(!ref||ref.origin===location.origin?"Direto":ref.hostname)).slice(0,160);
  sessionStorage.setItem(SOURCE_KEY,value);return value;
 }catch{return"Direto"}
}
function device(){
 const width=Math.max(document.documentElement.clientWidth||0,innerWidth||0);
 return width<768?"mobile":width<1100?"tablet":"desktop";
}
function recentlyRecorded(key){
 try{
  const now=Date.now(),stored=JSON.parse(sessionStorage.getItem(DEDUPE_KEY)||"{}");
  Object.keys(stored).forEach(k=>{if(now-stored[k]>30*60*1000)delete stored[k]});
  if(stored[key])return true;
  stored[key]=now;sessionStorage.setItem(DEDUPE_KEY,JSON.stringify(stored));return false;
 }catch{return false}
}
function record(tipo,data={}){
 const key=`${tipo}:${data.recursoId||data.destino||data.metadados?.termo||location.pathname}`;
 if(once.has(key)||recentlyRecorded(key))return;
 once.add(key);
 const payload={...data,sessaoHash:sessionId(),origem:source(),dispositivo:device()};
 callPublicRpc("registrar_evento_site",{
  p_tipo:tipo,p_pagina:payload.pagina||location.pathname,p_recurso_tipo:payload.recursoTipo||null,
  p_recurso_id:payload.recursoId||null,p_destino:payload.destino||null,p_sessao_hash:payload.sessaoHash,
  p_origem:payload.origem,p_dispositivo:payload.dispositivo,p_metadados:payload.metadados||{}
 },{timeout:4000,keepalive:true}).catch(()=>{});
}
record("page_view");

document.addEventListener("click",event=>{
 const link=event.target.closest("a[href]");if(!link)return;
 const href=link.href||"",guide=link.closest("[data-guide-id]"),eventCard=link.closest("[data-event-id]"),tourism=link.closest("[data-tourism-id]"),channel=link.closest("[data-link-id]");
 const resource=guide?{recursoTipo:"guia",recursoId:guide.dataset.guideId}:eventCard?{recursoTipo:"evento",recursoId:eventCard.dataset.eventId}:tourism?{recursoTipo:"turismo",recursoId:tourism.dataset.tourismId}:channel?{recursoTipo:"link",recursoId:channel.dataset.linkId}:{};
 if(guide)record("guia_click",resource);
 if(eventCard)record("evento_click",resource);
 if(tourism)record("turismo_click",resource);
 if(channel)record("link_click",{...resource,destino:href});
 if(/wa\.me|whatsapp\.com/i.test(href))record("whatsapp_click",{...resource,destino:href});
 else if(/instagram\.com/i.test(href))record("instagram_click",{...resource,destino:href});
 else if(/^https?:/i.test(href)&&new URL(href).origin!==location.origin)record("external_click",{...resource,destino:href});
});

function observeCards(selector,tipo,datasetKey,recursoTipo){
 if(!("IntersectionObserver" in window))return;
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
  if(!entry.isIntersecting)return;
  const id=entry.target.dataset[datasetKey];
  if(id)record(tipo,{recursoTipo,recursoId:id});
  observer.unobserve(entry.target);
 }),{threshold:.5});
 document.querySelectorAll(selector).forEach(card=>observer.observe(card));
}
document.addEventListener("guia:renderizado",()=>observeCards("[data-guide-id]","guia_view","guideId","guia"));

document.addEventListener("submit",event=>{
 const search=event.target.querySelector('input[type="search"],input[name="q"],input[name="busca"]');
 const termo=search?.value?.trim();
 if(termo)record("busca",{metadados:{termo:termo.slice(0,100)}});
});

async function noticiaView(){
 const slug=location.pathname.match(/^\/noticias\/([^/]+)/)?.[1]||new URLSearchParams(location.search).get("slug");if(!slug)return;
 const [data]=await fetchPublicRows("noticias",{select:"id",slug:`eq.${decodeURIComponent(slug)}`,limit:"1"});
 if(data?.id)record("noticia_view",{recursoTipo:"noticia",recursoId:data.id});
}
window.addEventListener("noticia:renderizada",noticiaView,{once:true});
async function detailView(){
 const params=new URLSearchParams(location.search),slug=params.get("slug");
 if(!slug)return;
 const isEvent=location.pathname.includes("/eventos/");
 const isTourism=location.pathname.endsWith("/turismo-details.html");
 if(!isEvent&&!isTourism)return;
 const table=isEvent?"eventos":"turismo",type=isEvent?"evento":"turismo";
 const [data]=await fetchPublicRows(table,{select:"id",slug:`eq.${slug}`,status:"eq.publicado",limit:"1"});
 if(data?.id)record(`${type}_view`,{recursoTipo:type,recursoId:data.id});
}
detailView();
window.addEventListener("evento:renderizado",event=>{
 const id=event.detail?.id;if(id)record("evento_view",{recursoTipo:"evento",recursoId:id});
},{once:true});
window.addEventListener("turismo:renderizado",event=>{
 const id=event.detail?.id;if(id)record("turismo_view",{recursoTipo:"turismo",recursoId:id});
},{once:true});
