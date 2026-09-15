import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { responsiveImage } from "/assets/js/image-tools.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "/preview/guia/banners-preview.js";

const currentList=document.getElementById("agenda-current-list");
const archiveList=document.getElementById("agenda-archive-list");
const status=document.getElementById("agenda-status");
const esc=(value="")=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const strip=value=>String(value||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const compact=(value,limit=150)=>{const text=strip(value);return text.length>limit?`${text.slice(0,limit).trim()}…`:text;};
const safeImage=(value,options={})=>/^https?:\/\//i.test(value||"")||/^\/?assets\//i.test(value||"")?esc(responsiveImage(value,options)):"";
const safeHttp=value=>/^https?:\/\//i.test(value||"")?esc(value):"";
const eventUrl=item=>`/preview/agenda/evento/?slug=${encodeURIComponent(item.slug)}`;
const publicEventUrl=item=>`/eventos/agenda/${encodeURIComponent(item.slug)}`;
const archiveUrl=item=>`/preview/agenda/tradicao/?slug=${encodeURIComponent(item.slug)}`;
const editionUrl=(item,year)=>`/preview/agenda/edicao/?slug=${encodeURIComponent(item.slug)}&ano=${encodeURIComponent(year)}`;
const recurrenceLabel=type=>({semanal:"Semanal",mensal:"Mensal",anual:"Anual"})[type]||"";

function dateInfo(value){
  if(!value)return {day:"—",month:"A definir",weekday:"",long:"Data a confirmar",time:"",iso:""};
  const date=new Date(value),zone="America/Sao_Paulo";
  if(Number.isNaN(date.getTime()))return {day:"—",month:"A definir",weekday:"",long:"Data a confirmar",time:"",iso:""};
  return {
    day:new Intl.DateTimeFormat("pt-BR",{day:"2-digit",timeZone:zone}).format(date),
    month:new Intl.DateTimeFormat("pt-BR",{month:"short",timeZone:zone}).format(date).replace(".","").toUpperCase(),
    weekday:new Intl.DateTimeFormat("pt-BR",{weekday:"short",timeZone:zone}).format(date).replace(".","").toUpperCase(),
    long:new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"long",year:"numeric",timeZone:zone}).format(date),
    time:new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:zone}).format(date),
    iso:date.toISOString()
  };
}

async function safeRows(table,params){try{return await fetchPublicRows(table,params);}catch(error){console.warn(`${table} indisponível`,error);return [];}}

async function fetchSimpleEvents(){
  try{return await fetchPublicRows("eventos",{select:"*",status:"eq.publicado",order:"data_inicio.asc"});}
  catch(error){
    console.warn("Agenda completa indisponível; carregando campos essenciais.",error);
    return safeRows("eventos",{select:"id,titulo,slug,descricao,imagem_url,data_inicio,data_fim,local,destaque,recorrencia_tipo,recorrencia_ate",status:"eq.publicado",order:"data_inicio.asc"});
  }
}

function addRecurrenceDate(date,type){const next=new Date(date);if(type==="semanal")next.setDate(next.getDate()+7);else if(type==="mensal")next.setMonth(next.getMonth()+1);else if(type==="anual")next.setFullYear(next.getFullYear()+1);return next;}

function expandRecurringEvents(events,now=new Date()){
  const horizon=new Date(now);horizon.setMonth(horizon.getMonth()+12);
  const today=new Date(now);today.setHours(0,0,0,0);
  return events.map(event=>{
    const originalStart=event.data_inicio?new Date(event.data_inicio):null;
    if(!originalStart||Number.isNaN(originalStart.getTime())||!["semanal","mensal","anual"].includes(event.recorrencia_tipo))return event;
    const originalEnd=event.data_fim?new Date(event.data_fim):null;
    const duration=originalEnd&&!Number.isNaN(originalEnd.getTime())?originalEnd-originalStart:null;
    const recurrenceEnd=event.recorrencia_ate?new Date(event.recorrencia_ate):horizon;
    const limit=recurrenceEnd<horizon?recurrenceEnd:horizon;
    let occurrence=new Date(originalStart),guard=0;
    while(occurrence<=limit&&guard<80){
      if(occurrence>=today)return {...event,id:`${event.id}-${occurrence.toISOString()}`,original_id:event.id,data_inicio:occurrence.toISOString(),data_fim:duration?new Date(occurrence.getTime()+duration).toISOString():event.data_fim,recorrencia_label:recurrenceLabel(event.recorrencia_tipo)};
      occurrence=addRecurrenceDate(occurrence,event.recorrencia_tipo);guard+=1;
    }
    return event;
  }).sort((a,b)=>new Date(a.data_inicio||0)-new Date(b.data_inicio||0));
}

function mapUrl(item){
  if(safeHttp(item.mapa_url))return safeHttp(item.mapa_url);
  const destination=item.endereco||item.local;
  return destination?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.titulo,destination,"Urânia SP"].filter(Boolean).join(" "))}`:"";
}

const icons={route:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>'};

function eventCard(item,index){
  const date=dateInfo(item.data_inicio),url=eventUrl(item),image=safeImage(item.imagem_url,{width:760,height:520,quality:76}),route=mapUrl(item),description=compact(item.descricao,170);
  return `<article class="agenda-event${image?" has-image":" no-image"}" data-event-id="${esc(item.original_id||item.id)}">
    <time class="agenda-date" datetime="${esc(date.iso)}" aria-label="${esc(`${date.long}${date.time?` às ${date.time}`:""}`)}"><strong>${esc(date.day)}</strong><span>${esc(date.month)}</span><small>${esc(date.weekday)}</small></time>
    ${image?`<a class="agenda-event-image" href="${url}" aria-label="Ver ${esc(item.titulo)}"><img src="${image}" alt="${esc(item.titulo)}" width="760" height="520" ${index?"loading=\"lazy\"":"fetchpriority=\"high\""} decoding="async"></a>`:""}
    <div class="agenda-event-copy">
      <div class="agenda-event-meta">${date.time?`<time datetime="${esc(date.iso)}">${esc(date.time)}</time>`:""}${item.recorrencia_label||recurrenceLabel(item.recorrencia_tipo)?`<span>${esc(item.recorrencia_label||recurrenceLabel(item.recorrencia_tipo))}</span>`:""}</div>
      <h3><a href="${url}">${esc(item.titulo)}</a></h3>
      ${item.local?`<p class="agenda-location">${esc(item.local)}</p>`:""}
      ${description?`<p class="agenda-description">${esc(description)}</p>`:""}
      <div class="agenda-event-actions"><a class="agenda-event-link" href="${url}">Ver evento <span aria-hidden="true">→</span></a>${route?`<a class="agenda-route-link" href="${route}" target="_blank" rel="noopener" aria-label="Como chegar a ${esc(item.titulo)}" title="Como chegar">${icons.route}<span>Como chegar</span></a>`:""}</div>
    </div>
  </article>`;
}

function archiveCard(item,editions){
  const url=archiveUrl(item),image=safeImage(item.imagem_capa_url,{width:680,height:430,quality:75});
  const current=editions.find(edition=>["anunciado","confirmado","acontecendo"].includes(edition.status));
  const facts=[item.recorrencia,item.periodo_aproximado,editions.length?`${editions.length} ${editions.length>1?"edições":"edição"}`:null].filter(Boolean);
  return `<article class="agenda-archive-card" data-event-principal-id="${esc(item.id)}">
    ${image?`<a class="agenda-archive-image" href="${url}" aria-label="Conhecer ${esc(item.nome)}"><img src="${image}" alt="${esc(item.nome)}" width="680" height="430" loading="lazy" decoding="async"></a>`:"<div class=\"agenda-archive-mark\" aria-hidden=\"true\"><span>Tradição</span></div>"}
    <div class="agenda-archive-copy"><p>${esc(item.categoria||"Evento de Urânia")}</p><h3><a href="${url}">${esc(item.nome)}</a></h3>${item.descricao_curta||item.historia_html?`<p class="agenda-archive-description">${esc(compact(item.descricao_curta||item.historia_html,145))}</p>`:""}${facts.length?`<div class="agenda-archive-facts">${facts.map(fact=>`<span>${esc(fact)}</span>`).join("")}</div>`:""}<div class="agenda-archive-actions"><a href="${url}">Conhecer evento <b aria-hidden="true">→</b></a>${current?`<a href="${editionUrl(item,current.ano)}">Edição ${esc(current.ano)}</a>`:`<a href="${url}#edicoes">Ver edições</a>`}</div></div>
  </article>`;
}

function renderStructuredData(items){
  document.getElementById("agenda-structured-data")?.remove();
  if(!items.length)return;
  const script=document.createElement("script");script.id="agenda-structured-data";script.type="application/ld+json";
  script.textContent=JSON.stringify({"@context":"https://schema.org","@type":"ItemList",itemListElement:items.slice(0,10).map((item,index)=>({"@type":"ListItem",position:index+1,url:`https://euamourania.com.br${publicEventUrl(item)}`,name:item.titulo}))});
  document.head.append(script);
}

function render(events,principals,editions){
  const now=new Date();
  const active=expandRecurringEvents(events,now).filter(item=>!item.data_fim||new Date(item.data_fim)>=now);
  currentList.innerHTML=active.length?active.slice(0,8).map(eventCard).join(""):`<div class="agenda-empty"><strong>Nada marcado por enquanto.</strong><p>A agenda será atualizada assim que novos eventos forem confirmados.</p><a href="/cadastrar-evento.html">Cadastrar evento <span aria-hidden="true">→</span></a></div>`;
  const editionsByEvent=new Map();editions.forEach(edition=>editionsByEvent.set(edition.evento_id,[...(editionsByEvent.get(edition.evento_id)||[]),edition]));
  archiveList.innerHTML=principals.length?principals.map(item=>archiveCard(item,editionsByEvent.get(item.id)||[])).join(""):`<div class="agenda-empty archive-empty"><strong>O acervo está sendo organizado.</strong><p>As tradições e edições anteriores aparecerão aqui.</p></div>`;
  status.hidden=true;renderStructuredData(active);
  document.dispatchEvent(new CustomEvent("agenda:renderizada"));
}

const header=document.querySelector(".site-header"),menu=document.getElementById("menu-principal"),menuButton=header?.querySelector(".menu-toggle"),searchTrigger=header?.querySelector(".search-trigger"),headerSearchInput=document.getElementById("header-search-input");
const closeHeaderSearch=()=>{header?.classList.remove("search-open");searchTrigger?.setAttribute("aria-expanded","false");};
searchTrigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");menuButton?.setAttribute("aria-expanded","false");header?.classList.add("search-open");searchTrigger.setAttribute("aria-expanded","true");setTimeout(()=>headerSearchInput?.focus(),180);});
menuButton?.addEventListener("click",()=>{closeHeaderSearch();const open=menuButton.getAttribute("aria-expanded")!=="true";menuButton.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open);});
header?.querySelector(".header-search-close")?.addEventListener("click",closeHeaderSearch);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeHeaderSearch();});
document.getElementById("year").textContent=new Date().getFullYear();
getAppDownloadConfig().then(app=>document.querySelectorAll("[data-app-download]").forEach(link=>{link.href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html";})).catch(()=>{});

function configureNewsletter(){const signup=document.querySelector(".newsletter-signup");if(!signup)return;const title=signup.querySelector("h2"),description=signup.querySelector(".newsletter-box > div > p:last-child"),name=signup.querySelector('input[name="nome"]');if(title)title.textContent="Urânia direto no seu e-mail.";if(description)description.textContent="Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";if(name){name.placeholder="Seu nome";name.required=true;}}

async function init(){
  if(!publicSupabaseConfigured()){status.textContent="Configure o Supabase para carregar a Agenda.";return;}
  const [events,principals,editions]=await Promise.all([fetchSimpleEvents(),safeRows("eventos_principais",{select:"*",ativo:"eq.true",order:"destaque.desc,atualizado_em.desc"}),safeRows("eventos_edicoes",{select:"*",order:"ano.desc,data_inicio.desc"})]);
  render(events,principals,editions);
  await Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")]);
  configureNewsletter();
}

init().catch(error=>{console.error(error);status.textContent="Não foi possível carregar a Agenda agora.";});
