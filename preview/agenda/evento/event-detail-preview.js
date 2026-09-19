import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { definirMeta, textoPuro } from "/assets/js/utils.js";
import { responsiveImage } from "/assets/js/image-tools.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "/preview/guia/banners-preview.js";

const root=document.getElementById("agenda-event-details");
const requestedSlug=new URLSearchParams(location.search).get("slug")||"";
const esc=(value="")=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const strip=value=>textoPuro(value||"").replace(/\s+/g," ").trim();
const safeImage=value=>/^https?:\/\//i.test(value||"")||/^\/?assets\//i.test(value||"")?esc(responsiveImage(value,{width:1200,height:820,quality:80})):"";
const safeHttp=value=>/^https?:\/\//i.test(value||"")?esc(value):"";
const recurrenceLabel=value=>({semanal:"Evento semanal",mensal:"Evento mensal",anual:"Evento anual"})[value]||"";
const icons={
  map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'
};

function dateInfo(value){
  if(!value)return {day:"—",month:"A definir",weekday:"",long:"Data a confirmar",time:"",iso:""};
  const date=new Date(value),zone="America/Sao_Paulo";
  if(Number.isNaN(date.getTime()))return {day:"—",month:"A definir",weekday:"",long:"Data a confirmar",time:"",iso:""};
  return {day:new Intl.DateTimeFormat("pt-BR",{day:"2-digit",timeZone:zone}).format(date),month:new Intl.DateTimeFormat("pt-BR",{month:"short",timeZone:zone}).format(date).replace(".","").toUpperCase(),weekday:new Intl.DateTimeFormat("pt-BR",{weekday:"long",timeZone:zone}).format(date),long:new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long",year:"numeric",timeZone:zone}).format(date),time:new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:zone}).format(date),iso:date.toISOString()};
}
function addRecurrenceDate(date,type){const next=new Date(date);if(type==="semanal")next.setDate(next.getDate()+7);else if(type==="mensal")next.setMonth(next.getMonth()+1);else if(type==="anual")next.setFullYear(next.getFullYear()+1);return next;}
function currentOccurrence(item){
  const start=item.data_inicio?new Date(item.data_inicio):null;
  if(!start||Number.isNaN(start.getTime())||!["semanal","mensal","anual"].includes(item.recorrencia_tipo))return item;
  const today=new Date();today.setHours(0,0,0,0);
  const recurrenceEnd=item.recorrencia_ate?new Date(item.recorrencia_ate):null;
  const originalEnd=item.data_fim?new Date(item.data_fim):null;
  const duration=originalEnd&&!Number.isNaN(originalEnd.getTime())?originalEnd-start:null;
  let occurrence=new Date(start),guard=0;
  while(occurrence<today&&guard<520){occurrence=addRecurrenceDate(occurrence,item.recorrencia_tipo);guard+=1;}
  if(recurrenceEnd&&!Number.isNaN(recurrenceEnd.getTime())&&occurrence>recurrenceEnd)return item;
  return {...item,data_inicio:occurrence.toISOString(),data_fim:duration?new Date(occurrence.getTime()+duration).toISOString():item.data_fim};
}
function mapUrl(item){const direct=safeHttp(item.mapa_url);if(direct)return direct;const target=item.endereco||item.local;return target?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.titulo,target,"Urânia SP"].filter(Boolean).join(" "))}`:"";}
function fact(icon,label,value,extra=""){if(!value)return "";return `<div class="event-fact">${icon}<div><small>${esc(label)}</small><strong>${esc(value)}</strong>${extra}</div></div>`;}
function structuredData(item,image,canonical){const script=document.createElement("script");script.type="application/ld+json";script.id="agenda-event-structured-data";script.textContent=JSON.stringify({"@context":"https://schema.org","@type":"Event",name:item.titulo,description:strip(item.descricao),url:canonical,image:image?new URL(image,location.origin).href:undefined,startDate:item.data_inicio||undefined,endDate:item.data_fim||undefined,eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",eventStatus:"https://schema.org/EventScheduled",location:item.local||item.endereco?{"@type":"Place",name:item.local||undefined,address:item.endereco||undefined}:undefined,organizer:item.organizador?{"@type":"Organization",name:item.organizador}:undefined});document.head.appendChild(script);}

async function loadEvent(){const query=requestedSlug?{slug:`eq.${requestedSlug}`}:{order:"data_inicio.asc"};return (await fetchPublicRows("eventos",{select:"*",status:"eq.publicado",...query,limit:"1"}))[0];}
async function loadRelatedEvents(current){
  const rows=await fetchPublicRows("eventos",{select:"*",status:"eq.publicado",order:"data_inicio.asc",limit:"12"}).catch(()=>[]);
  const now=new Date();
  return rows.filter(row=>row.id!==current.id).map(currentOccurrence).filter(row=>{const end=new Date(row.data_fim||row.data_inicio||0);return !Number.isNaN(end.getTime())&&end>=now;}).sort((a,b)=>new Date(a.data_inicio||0)-new Date(b.data_inicio||0)).slice(0,3);
}
function relatedEventsMarkup(items){
  if(!items.length)return "";
  return `<section class="event-related"><header><div><p class="event-kicker">Na agenda</p><h2>Outros eventos.</h2></div><a href="/preview/agenda/">Ver agenda <span aria-hidden="true">→</span></a></header><div class="event-related-grid">${items.map(item=>{const date=dateInfo(item.data_inicio),image=safeImage(item.imagem_url),recurrence=recurrenceLabel(item.recorrencia_tipo);return `<a class="event-related-card" href="/preview/agenda/evento/?slug=${encodeURIComponent(item.slug)}">${image?`<img src="${image}" alt="" width="520" height="330" loading="lazy" decoding="async">`:""}<div><time datetime="${esc(date.iso)}"><strong>${esc(date.day)}</strong><span>${esc(date.month)}</span></time><section>${recurrence?`<small>${esc(recurrence)}</small>`:""}<h3>${esc(item.titulo)}</h3>${item.local?`<p>${esc(item.local)}</p>`:""}</section></div></a>`;}).join("")}</div></section>`;
}

async function render(){
  if(!publicSupabaseConfigured()){root.innerHTML='<p class="event-detail-status">Configure o Supabase para carregar este evento.</p>';return;}
  try{
    const loadedItem=await loadEvent();if(!loadedItem){root.innerHTML='<p class="event-detail-status">Evento não encontrado.</p>';return;}const item=currentOccurrence(loadedItem),related=await loadRelatedEvents(loadedItem);
    const date=dateInfo(item.data_inicio),end=dateInfo(item.data_fim),image=safeImage(item.imagem_url),map=mapUrl(item),phone=String(item.whatsapp||"").replace(/\D/g,""),recurrence=recurrenceLabel(item.recorrencia_tipo);
    const canonical=`https://euamourania.com.br/eventos/agenda/${encodeURIComponent(item.slug)}`;
    const summary=strip(item.descricao)||"Informações deste evento no Eu Amo Urânia.";
    definirMeta({titulo:`${item.titulo} | Eu Amo Urânia`,descricao:summary.slice(0,160),imagem:image||"/assets/compartilhamento-logo.png",url:canonical});
    structuredData(item,image,canonical);
    root.innerHTML=`<article class="event-detail" data-event-id="${esc(item.id)}">
      <nav class="event-breadcrumb" aria-label="Navegação estrutural"><a href="/preview/agenda/">Agenda</a><span>/</span><span aria-current="page">${esc(item.titulo)}</span></nav>
      <section class="event-detail-hero${image?" has-image":" no-image"}">
        ${image?`<div class="event-detail-media"><img src="${image}" alt="${esc(item.titulo)}" width="1200" height="820" fetchpriority="high" decoding="async"></div>`:"<div class=\"event-detail-media event-detail-placeholder\"><span>Agenda de Urânia</span></div>"}
        <time class="event-date-signature" datetime="${esc(date.iso)}" aria-label="${esc(`${date.long}${date.time?` às ${date.time}`:""}`)}"><strong>${esc(date.day)}</strong><span>${esc(date.month)}</span><small>${esc(date.weekday)}</small></time>
        <header class="event-detail-intro"><div class="event-detail-labels"><span>Agenda de Urânia</span>${recurrence?`<b>${esc(recurrence)}</b>`:""}${item.destaque?"<b>Destaque</b>":""}</div><h1>${esc(item.titulo)}</h1><p>${esc(summary)}</p><div class="event-detail-actions">${phone?`<a class="event-action primary" href="https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Vim pelo Eu Amo Urânia e quero saber mais sobre ${item.titulo}.`)}" target="_blank" rel="noopener">${icons.whatsapp}<span>Falar com a organização</span></a>`:""}${map?`<a class="event-action" href="${map}" target="_blank" rel="noopener">${icons.map}<span>Como chegar</span></a>`:""}<button class="event-icon-action" type="button" data-share-event aria-label="Compartilhar evento" title="Compartilhar">${icons.share}</button></div></header>
      </section>
      <section class="event-detail-main"><div class="event-detail-copy"><p class="event-kicker">Sobre o evento</p><h2>O que você precisa saber.</h2><div class="event-description"><p>${esc(summary)}</p></div></div><aside class="event-info-panel" aria-labelledby="event-info-title"><p class="event-kicker">Informações úteis</p><h2 id="event-info-title">Quando e onde.</h2>${fact(icons.calendar,"Data",date.long,item.data_fim&&end.long!==date.long?`<span>até ${esc(end.long)}</span>`:"")}${fact(icons.clock,"Horário",date.time,item.data_fim&&end.time?`<span>até ${esc(end.time)}</span>`:"")}${fact(icons.pin,"Local",item.local,item.endereco?`<span>${esc(item.endereco)}</span>`:"")}${fact(icons.calendar,"Organização",item.organizador)}${map?`<a class="event-panel-map" href="${map}" target="_blank" rel="noopener">${icons.map}<span>Abrir no mapa</span><b aria-hidden="true">→</b></a>`:""}</aside></section>
      ${relatedEventsMarkup(related)}
    </article>`;
    root.querySelector("[data-share-event]")?.addEventListener("click",async event=>{const data={title:item.titulo,text:summary,url:canonical};try{if(navigator.share){await navigator.share(data);return;}await navigator.clipboard.writeText(canonical);event.currentTarget.classList.add("copied");event.currentTarget.setAttribute("aria-label","Link copiado");}catch(error){if(error?.name!=="AbortError")location.href=`https://wa.me/?text=${encodeURIComponent(`${item.titulo}: ${canonical}`)}`;}});
    window.dispatchEvent(new CustomEvent("evento:renderizado",{detail:{id:item.id}}));
  }catch(error){console.error(error);root.innerHTML='<p class="event-detail-status">Não foi possível carregar este evento.</p>';}
}

const header=document.querySelector(".site-header"),menu=document.getElementById("menu-principal"),menuButton=header?.querySelector(".menu-toggle"),searchTrigger=header?.querySelector(".search-trigger"),searchInput=document.getElementById("header-search-input");
const closeSearch=()=>{header?.classList.remove("search-open");searchTrigger?.setAttribute("aria-expanded","false");};
searchTrigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");menuButton?.setAttribute("aria-expanded","false");header?.classList.add("search-open");searchTrigger.setAttribute("aria-expanded","true");setTimeout(()=>searchInput?.focus(),180);});
menuButton?.addEventListener("click",()=>{closeSearch();const open=menuButton.getAttribute("aria-expanded")!=="true";menuButton.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open);});
header?.querySelector(".header-search-close")?.addEventListener("click",closeSearch);document.addEventListener("keydown",event=>{if(event.key==="Escape")closeSearch();});
document.getElementById("year").textContent=new Date().getFullYear();
getAppDownloadConfig().then(app=>document.querySelectorAll("[data-app-download]").forEach(link=>{link.href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html";})).catch(()=>{});
function configureNewsletter(){const signup=document.querySelector(".newsletter-signup");if(!signup)return false;const title=signup.querySelector("h2"),description=signup.querySelector(".newsletter-box > div > p:last-child"),name=signup.querySelector('input[name="nome"]');if(title)title.textContent="Urânia direto no seu e-mail.";if(description)description.textContent="Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";if(name){name.placeholder="Seu nome";name.required=true;}return true;}
render().then(()=>Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")])).then(()=>{if(configureNewsletter())return;const observer=new MutationObserver(()=>{if(configureNewsletter())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000);});
