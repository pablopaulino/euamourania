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
 const href=link.href||"",guide=link.closest("[data-guide-id]"),eventCard=link.closest("[data-event-id]"),eventPrincipal=link.closest("[data-event-principal-id]"),eventEdition=link.closest("[data-event-edition-id]"),tourism=link.closest("[data-tourism-id]"),channel=link.closest("[data-link-id]");
 const resource=guide?{recursoTipo:"guia",recursoId:guide.dataset.guideId}:eventPrincipal?{recursoTipo:"evento_principal",recursoId:eventPrincipal.dataset.eventPrincipalId}:eventEdition?{recursoTipo:"evento_edicao",recursoId:eventEdition.dataset.eventEditionId}:eventCard?{recursoTipo:"evento",recursoId:eventCard.dataset.eventId}:tourism?{recursoTipo:"turismo",recursoId:tourism.dataset.tourismId}:channel?{recursoTipo:"link",recursoId:channel.dataset.linkId}:{};
 if(guide)record("guia_click",resource);
 if(eventCard||eventPrincipal||eventEdition)record("evento_click",resource);
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
function observePublicCards(){
 observeCards("[data-guide-id]","guia_view","guideId","guia");
 observeCards("[data-tourism-id]","turismo_view","tourismId","turismo");
 observeCards("[data-event-id]","evento_view","eventId","evento");
 observeCards("[data-event-principal-id]","evento_view","eventPrincipalId","evento_principal");
 observeCards("[data-event-edition-id]","evento_view","eventEditionId","evento_edicao");
}
document.addEventListener("guia:renderizado",observePublicCards);
document.addEventListener("turismo:renderizado",observePublicCards);
document.addEventListener("eventos:renderizado",observePublicCards);
observePublicCards();

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
noticiaView();
async function detailView(){
 const params=new URLSearchParams(location.search),slug=params.get("slug")||location.pathname.match(/^\/guia\/([^/]+)/)?.[1]||location.pathname.match(/^\/turismo\/([^/]+)/)?.[1];
 if(!slug)return;
 const isEvent=location.pathname.includes("/eventos/");
 const isTourism=location.pathname.endsWith("/turismo-details.html")||location.pathname.startsWith("/turismo/");
 const isGuide=(location.pathname.endsWith("/guia-details.html")||location.pathname.startsWith("/guia/"))&&!location.pathname.startsWith("/guia/categoria/");
 if(!isEvent&&!isTourism&&!isGuide)return;
 const table=isEvent?"eventos":isGuide?"guia_comercial":"turismo",type=isEvent?"evento":isGuide?"guia":"turismo";
 const [data]=await fetchPublicRows(table,{select:"id",slug:`eq.${decodeURIComponent(slug)}`,status:"eq.publicado",limit:"1"});
 if(data?.id)record(`${type}_view`,{recursoTipo:type,recursoId:data.id});
}
detailView();
window.addEventListener("evento:renderizado",event=>{
 const id=event.detail?.id,recursoTipo=event.detail?.recursoTipo||"evento";
 if(id)record("evento_view",{recursoTipo,recursoId:id});
},{once:true});
window.addEventListener("turismo:renderizado",event=>{
 const id=event.detail?.id;if(id)record("turismo_view",{recursoTipo:"turismo",recursoId:id});
},{once:true});
window.addEventListener("guia:renderizado",event=>{
 const id=event.detail?.id;if(id)record("guia_view",{recursoTipo:"guia",recursoId:id});
},{once:true});
