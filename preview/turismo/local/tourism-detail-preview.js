import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { definirMeta, textoPuro } from "/assets/js/utils.js";
import { sanitizeArticleHtml } from "/assets/js/security/sanitize-html.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "/preview/guia/banners-preview.js";

const root = document.getElementById("turismo-details");
const params = new URLSearchParams(location.search);
const requestedSlug = params.get("slug") || location.pathname.match(/^\/turismo\/([^/]+)\/?$/)?.[1] || "";
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//i.test(value || "") ? esc(String(value).startsWith("assets/") ? `/${value}` : value) : "";
const safeHttp = value => /^https?:\/\//i.test(value || "") ? esc(value) : "";
const fallbackImage = "/assets/AD3A1763-min (1).jpg";
const nowIso = () => new Date().toISOString();
const firstLine = value => textoPuro(value || "").split(/[\n,]/).map(part => part.trim()).filter(Boolean)[0] || "";
const truncate = (value = "", size = 130) => { const text = textoPuro(value || "").trim(); return text.length > size ? `${text.slice(0, size).trim()}…` : text; };

const icons = {
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  map:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h3l1 5-2 1c1 3 3 5 6 6l1-2 5 1v3c0 2-2 4-4 4C9 20 4 15 3 7c0-2 2-4 4-4Z"/></svg>',
  globe:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
  instagram:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.2"/><path d="M17.3 6.8h.01"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.6-4H14V7.3c0-1.2.4-2 2.1-2H18V2.2c-.8-.1-1.8-.2-3-.2-3 0-5 1.8-5 5.2V9H7v4h3v8"/></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>',
  arrow:'<span aria-hidden="true">→</span>'
};

function gallery(item) {
  let raw = item.galeria_urls;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = raw.split(/[\n,]/); } }
  return [item.imagem_url, ...(Array.isArray(raw) ? raw : [])]
    .map(value => safeImage(typeof value === "string" ? value : value?.url || value?.imagem_url))
    .filter((value, index, list) => value && list.indexOf(value) === index).slice(0, 8);
}

const DAYS = [["mon","Segunda"],["tue","Terça"],["wed","Quarta"],["thu","Quinta"],["fri","Sexta"],["sat","Sábado"],["sun","Domingo"]];
function parseHours(raw) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return []; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return DAYS.map(([key,label]) => {
    const day = raw[key]; if (!day || typeof day !== "object") return null;
    if (day.closed === true || day.isClosed === true) return { key,label,closed:true,periods:[] };
    if (day.twenty_four_hours || day.open_24h || day.is_24h || day.all_day) return { key,label,allDay:true,periods:[["00:00","24:00"]] };
    const candidates = Array.isArray(day.periods) ? day.periods : Array.isArray(day.shifts) ? day.shifts : [day];
    const periods = candidates.map(period => [String(period?.open || ""),String(period?.close || "")]).filter(([open,close]) => /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close));
    return periods.length ? { key,label,periods } : null;
  }).filter(Boolean);
}

function openingState(hours) {
  if (!hours.length) return null;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone:"America/Sao_Paulo", weekday:"short", hour:"2-digit", minute:"2-digit", hourCycle:"h23" });
  const parts = formatter.formatToParts(new Date());
  const key = parts.find(part => part.type === "weekday")?.value.toLowerCase().slice(0,3);
  const minutes = Number(parts.find(part => part.type === "hour")?.value || 0) * 60 + Number(parts.find(part => part.type === "minute")?.value || 0);
  const day = hours.find(entry => entry.key === key);
  if (!day || day.closed) return { open:false,label:"Fechado agora" };
  if (day.allDay) return { open:true,label:"Aberto agora",detail:"24 horas" };
  const current = day.periods.find(([open,close]) => { const [oh,om]=open.split(":").map(Number),[ch,cm]=close.split(":").map(Number); const start=oh*60+om,end=close === "24:00" ? 1440 : ch*60+cm; return end >= start ? minutes >= start && minutes < end : minutes >= start || minutes < end; });
  return current ? { open:true,label:"Aberto agora",detail:`Fecha às ${current[1].replace(":","h")}` } : { open:false,label:"Fechado agora" };
}

function hoursMarkup(item, hours) {
  if (hours.length) return `<details class="hours-details"><summary>Ver todos os horários</summary><div>${DAYS.map(([key,label]) => { const day=hours.find(entry => entry.key === key); const value=!day || day.closed ? "Fechado" : day.allDay ? "24 horas" : day.periods.map(period => `${period[0]}–${period[1]}`).join(" / "); return `<p><span>${label}</span><strong>${esc(value)}</strong></p>`; }).join("")}${item.opening_hours_note ? `<em>${esc(item.opening_hours_note)}</em>` : ""}</div></details>`;
  return item.horario ? `<p class="plain-hours">${esc(item.horario)}</p>${item.opening_hours_note ? `<p class="hours-note">${esc(item.opening_hours_note)}</p>` : ""}` : "";
}

function mapsUrl(item) { const direct=safeHttp(item.mapa_url); if (direct) return direct; const query=[item.nome,item.endereco,"Urânia SP"].filter(Boolean).join(" "); return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ""; }
function instagramUrl(value) { if (!value) return ""; if (/^https?:\/\//i.test(value)) return safeHttp(value); const handle=String(value).replace(/^@/,"").replace(/[^a-z0-9._]/gi,""); return handle ? `https://instagram.com/${handle}` : ""; }

function companyCard(item) {
  const image=safeImage(item.imagem_url);
  return `<a class="place-company-card" href="/preview/guia/empresa/?slug=${encodeURIComponent(item.slug || item.id)}">${image ? `<img src="${image}" alt="" width="410" height="270" loading="lazy" decoding="async">` : `<span class="media-placeholder">Guia de Urânia</span>`}<div><small>${esc(item.categoria_nome || "Guia")}</small><h3>${esc(item.nome)}</h3><p>${esc(truncate(item.descricao || item.endereco,82))}</p><span>Ver empresa ${icons.arrow}</span></div></a>`;
}
function tourismCard(item) {
  const image=safeImage(item.imagem_url);
  return `<a class="place-tourism-card" href="/preview/turismo/local/?slug=${encodeURIComponent(item.slug || item.id)}">${image ? `<img src="${image}" alt="" width="520" height="360" loading="lazy" decoding="async">` : ""}<div><small>Descubra Urânia</small><h3>${esc(item.nome)}</h3><p>${esc(truncate(item.descricao,75))}</p><span>Conhecer ${icons.arrow}</span></div></a>`;
}
function newsCard(item) {
  const image=safeImage(item.imagem_url);
  return `<a class="place-news-card" href="/noticias/${encodeURIComponent(item.slug)}">${image ? `<img src="${image}" alt="" width="380" height="240" loading="lazy" decoding="async">` : ""}<div><small>${esc(item.categoria_nome || "Notícias")}</small><h3>${esc(item.titulo)}</h3><span>Ler notícia ${icons.arrow}</span></div></a>`;
}
function section(kicker,title,description,items,className) {
  if (!items.length) return "";
  return `<section class="place-related ${className}"><header><p>${esc(kicker)}</p><h2>${esc(title)}</h2>${description ? `<span>${esc(description)}</span>` : ""}</header><div class="place-related-track">${items.join("")}</div></section>`;
}

async function categoryName(item) {
  if (!item.categoria_id) return item.categoria_nome || "Turismo local";
  const [category] = await fetchPublicRows("categorias", { select:"id,nome", id:`eq.${item.categoria_id}`, tipo:"eq.turismo", status:"eq.ativo", limit:"1" }, { ttl:180000 }).catch(() => []);
  return category?.nome || item.categoria_nome || "Turismo local";
}
async function relatedData(item) {
  const [food,stay,attractions,news] = await Promise.all([
    fetchPublicRows("guia_comercial", { select:"id,nome,slug,descricao,imagem_url,categoria_nome,endereco", status:"eq.publicado", or:"(categoria_nome.ilike.*aliment*,categoria_nome.ilike.*restaurante*,categoria_nome.ilike.*pizz*,categoria_nome.ilike.*lanche*,categoria_nome.ilike.*bar*,nome.ilike.*restaurante*,nome.ilike.*pizz*)", order:"recomendado.desc,nome.asc", limit:"3" }, { ttl:180000 }).catch(() => []),
    fetchPublicRows("guia_comercial", { select:"id,nome,slug,descricao,imagem_url,categoria_nome,endereco", status:"eq.publicado", or:"(categoria_nome.ilike.*hotel*,categoria_nome.ilike.*hosped*,categoria_nome.ilike.*pousada*,nome.ilike.*hotel*,nome.ilike.*pousada*)", order:"recomendado.desc,nome.asc", limit:"3" }, { ttl:180000 }).catch(() => []),
    fetchPublicRows("turismo", { select:"id,nome,slug,descricao,imagem_url", status:"eq.publicado", id:`neq.${item.id}`, order:"destaque.desc,nome.asc", limit:"3" }, { ttl:180000 }).catch(() => []),
    fetchPublicRows("noticias", { select:"id,titulo,slug,imagem_url,categoria_nome,publicado_em", status:"eq.publicado", publicado_em:`lte.${nowIso()}`, order:"publicado_em.desc", limit:"3" }, { ttl:180000 }).catch(() => [])
  ]);
  return { food,stay,attractions,news };
}

function addStructuredData(item,image,canonical) {
  document.getElementById("tourism-place-structured-data")?.remove();
  const script=document.createElement("script"); script.type="application/ld+json"; script.id="tourism-place-structured-data";
  script.textContent=JSON.stringify({ "@context":"https://schema.org", "@type":"TouristAttraction", name:item.nome, image, url:canonical, description:textoPuro(item.descricao || ""), address:item.endereco || undefined, telephone:item.telefone || item.whatsapp || undefined, sameAs:[instagramUrl(item.instagram),safeHttp(item.facebook),safeHttp(item.site)].filter(Boolean) });
  document.head.appendChild(script);
}

async function loadItem() {
  if (requestedSlug) { const query=/^[0-9a-f-]{20,}$/i.test(requestedSlug) ? { id:`eq.${requestedSlug}` } : { slug:`eq.${requestedSlug}` }; return (await fetchPublicRows("turismo", { select:"*", ...query, status:"eq.publicado", limit:"1" }))[0]; }
  return (await fetchPublicRows("turismo", { select:"*", status:"eq.publicado", order:"destaque.desc,nome.asc", limit:"1" }))[0];
}

async function render() {
  if (!publicSupabaseConfigured()) { root.innerHTML='<p class="detail-error">Configure o Supabase para carregar este lugar.</p>'; return; }
  try {
    const item=await loadItem(); if (!item) { root.innerHTML='<p class="detail-error">Ponto turístico não encontrado.</p>'; return; }
    const [category,related]=await Promise.all([categoryName(item),relatedData(item)]);
    const images=gallery(item); if (!images.length) images.push(fallbackImage);
    const structuredHours=parseHours(item.opening_hours), state=openingState(structuredHours), map=mapsUrl(item);
    const whatsappDigits=String(item.whatsapp || "").replace(/\D/g,"");
    const instagram=instagramUrl(item.instagram), facebook=safeHttp(item.facebook), site=safeHttp(item.site);
    const canonical=`https://euamourania.com.br/turismo/${encodeURIComponent(item.slug || item.id)}`;
    const absoluteImage=new URL(images[0],location.origin).href;
    const metaDescription=textoPuro(item.seo_descricao || item.descricao || `Conheça ${item.nome} em Urânia.`).slice(0,160);
    const pageTitle=item.seo_titulo || `${item.nome} | Turismo em Urânia`;
    definirMeta({ titulo:pageTitle, descricao:metaDescription, imagem:absoluteImage, url:canonical });
    addStructuredData(item,absoluteImage,canonical);
    const articleHtml=sanitizeArticleHtml(item.conteudo_html || `<p>${esc(item.descricao || "")}</p>`);
    const shouldCollapse=textoPuro(item.conteudo_html || item.descricao || "").length > 620;
    const actionLinks=[map ? `<a class="visit-action primary" href="${map}" target="_blank" rel="noopener">${icons.map}<span>Abrir no mapa</span>${icons.arrow}</a>`:"", whatsappDigits ? `<a class="visit-action" href="https://wa.me/${whatsappDigits}" target="_blank" rel="noopener">${icons.whatsapp}<span>Falar no WhatsApp</span></a>`:"", instagram ? `<a class="visit-icon" href="${instagram}" target="_blank" rel="noopener" aria-label="Abrir Instagram" title="Instagram">${icons.instagram}</a>`:"", facebook ? `<a class="visit-icon" href="${facebook}" target="_blank" rel="noopener" aria-label="Abrir Facebook" title="Facebook">${icons.facebook}</a>`:"", site ? `<a class="visit-icon" href="${site}" target="_blank" rel="noopener" aria-label="Abrir site oficial" title="Site oficial">${icons.globe}</a>`:""].join("");

    root.innerHTML=`<article class="tourism-place" data-tourism-id="${esc(item.id)}">
      <nav class="place-breadcrumb" aria-label="Navegação estrutural"><a href="/preview/turismo/">Turismo</a><span>/</span><span aria-current="page">${esc(item.nome)}</span></nav>
      <section class="place-hero">
        <div class="place-hero-media">
          <div class="place-gallery-track" tabindex="0" aria-label="Fotos de ${esc(item.nome)}">${images.map((image,index)=>`<figure class="place-gallery-slide"><img src="${image}" alt="${esc(index ? `${item.nome}, foto ${index + 1}` : item.nome)}" width="900" height="720" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async"></figure>`).join("")}</div>
          ${images.length > 1 ? `<div class="place-gallery-controls"><button type="button" data-gallery-prev aria-label="Foto anterior">←</button><span><b data-gallery-current>1</b> / ${images.length}</span><button type="button" data-gallery-next aria-label="Próxima foto">→</button></div>`:""}
        </div>
        <header class="place-hero-copy"><div class="place-badges"><a href="/preview/turismo/?busca=${encodeURIComponent(category)}">${esc(category)}</a>${item.destaque ? "<strong>Destaque</strong>" : ""}</div><p class="place-kicker">Descubra Urânia</p><h1>${esc(item.nome)}</h1>${item.descricao ? `<p class="place-summary">${esc(truncate(item.descricao,220))}</p>`:""}<div class="place-quick-info">${item.endereco ? `<p>${icons.pin}<span>${esc(firstLine(item.endereco))}</span></p>`:""}${state ? `<p class="opening-state ${state.open ? "is-open":"is-closed"}"><i></i><span><strong>${state.label}</strong>${state.detail ? `<small>${esc(state.detail)}</small>`:""}</span></p>` : item.horario ? `<p>${icons.clock}<span>${esc(truncate(item.horario,75))}</span></p>`:""}</div><div class="hero-actions">${actionLinks}<button class="visit-icon" type="button" data-share-place aria-label="Compartilhar lugar">${icons.share}</button></div></header>
      </section>

      <section class="place-main">
        <div class="place-story"><p class="section-kicker">Sobre a experiência</p><h2>Conheça este lugar.</h2><div id="place-article" class="place-article${shouldCollapse ? " is-collapsed":""}">${articleHtml}</div>${shouldCollapse ? '<button class="read-more" type="button" aria-expanded="false" aria-controls="place-article">Ver mais <span aria-hidden="true">↓</span></button>':""}</div>
        <aside class="visit-panel"><p class="section-kicker">Informações úteis</p><h2>Planeje sua visita.</h2>${item.endereco ? `<div class="visit-fact">${icons.pin}<div><small>Endereço</small><strong>${esc(item.endereco)}</strong>${map ? `<a href="${map}" target="_blank" rel="noopener">Ver no mapa ${icons.arrow}</a>`:""}</div></div>`:""}${structuredHours.length || item.horario ? `<div class="visit-fact">${icons.clock}<div><small>Horários</small>${state ? `<strong class="${state.open ? "open":"closed"}">${state.label}${state.detail ? ` · ${esc(state.detail)}`:""}</strong>`:""}${hoursMarkup(item,structuredHours)}</div></div>`:""}<div class="visit-panel-actions">${actionLinks}<button class="visit-icon" type="button" data-share-place aria-label="Compartilhar lugar">${icons.share}</button></div></aside>
      </section>

      ${images.length > 2 ? `<section class="place-photo-story"><header><p class="section-kicker">Galeria</p><h2>Registros do local.</h2></header><div class="place-photo-grid">${images.slice(1,5).map((image,index)=>`<button type="button" data-gallery-jump="${index+1}" aria-label="Ver foto ${index+2} na galeria"><img src="${image}" alt="${esc(`${item.nome}, registro ${index+1}`)}" width="620" height="440" loading="lazy" decoding="async"></button>`).join("")}</div></section>`:""}
      <div class="place-relations">
        ${section("Guia da cidade","Onde comer por perto","Poucas escolhas para completar o passeio.",related.food.map(companyCard),"is-guide")}
        ${section("Planeje sua visita","Onde se hospedar","Opções reais cadastradas no Guia de Urânia.",related.stay.map(companyCard),"is-guide")}
        ${section("Continue explorando","Mais lugares para conhecer","Outras experiências para descobrir na cidade.",related.attractions.map(tourismCard),"is-tourism")}
        ${section("Agora em Urânia","O que acontece por aqui","Informação local para acompanhar sem tirar o foco do passeio.",related.news.map(newsCard),"is-news")}
      </div>
    </article>`;

    const track=root.querySelector(".place-gallery-track");
    const setSlide=index => { if (!track) return; const clamped=(index+images.length)%images.length; track.scrollTo({ left:clamped*track.clientWidth, behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); setTimeout(()=>{ const node=root.querySelector("[data-gallery-current]"); if(node) node.textContent=String(clamped+1); },80); };
    root.querySelector("[data-gallery-prev]")?.addEventListener("click",()=>setSlide(Math.round(track.scrollLeft/track.clientWidth)-1));
    root.querySelector("[data-gallery-next]")?.addEventListener("click",()=>setSlide(Math.round(track.scrollLeft/track.clientWidth)+1));
    let scrollFrame=0; track?.addEventListener("scroll",()=>{ cancelAnimationFrame(scrollFrame); scrollFrame=requestAnimationFrame(()=>{ const current=Math.round(track.scrollLeft/track.clientWidth); const node=root.querySelector("[data-gallery-current]"); if (node) node.textContent=String(current+1); }); },{passive:true});
    root.querySelectorAll("[data-gallery-jump]").forEach(button=>button.addEventListener("click",()=>{ setSlide(Number(button.dataset.galleryJump)); root.querySelector(".place-hero")?.scrollIntoView({ behavior:"smooth",block:"start" }); }));
    root.querySelector(".read-more")?.addEventListener("click",event=>{ const article=root.querySelector("#place-article"),open=event.currentTarget.getAttribute("aria-expanded") === "true"; article?.classList.toggle("is-collapsed",open); event.currentTarget.setAttribute("aria-expanded",String(!open)); event.currentTarget.innerHTML=open ? 'Ver mais <span aria-hidden="true">↓</span>' : 'Ver menos <span aria-hidden="true">↓</span>'; });
    root.querySelectorAll("[data-share-place]").forEach(button=>button.addEventListener("click",async()=>{ try { if (navigator.share) return await navigator.share({ title:`${item.nome} | Turismo em Urânia`,text:item.descricao || `Conheça ${item.nome} em Urânia.`,url:canonical }); await navigator.clipboard.writeText(canonical); button.classList.add("copied"); button.setAttribute("aria-label","Link copiado"); } catch(error) { if (error?.name !== "AbortError") location.href=`https://wa.me/?text=${encodeURIComponent(`${item.nome}: ${canonical}`)}`; } }));
    window.dispatchEvent(new CustomEvent("turismo:renderizado",{detail:{id:item.id}}));
  } catch(error) { console.error(error); root.innerHTML='<p class="detail-error">Não foi possível carregar este ponto turístico.</p>'; }
}

const header=document.querySelector(".site-header"),menu=document.getElementById("menu-principal"),menuButton=header?.querySelector(".menu-toggle"),searchTrigger=header?.querySelector(".search-trigger"),searchInput=document.getElementById("header-search-input");
const closeSearch=()=>{header?.classList.remove("search-open");searchTrigger?.setAttribute("aria-expanded","false");};
searchTrigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");menuButton?.setAttribute("aria-expanded","false");header?.classList.add("search-open");searchTrigger.setAttribute("aria-expanded","true");setTimeout(()=>searchInput?.focus(),180);});
menuButton?.addEventListener("click",()=>{const open=menuButton.getAttribute("aria-expanded")!=="true";menuButton.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open);});
header?.querySelector(".header-search-close")?.addEventListener("click",closeSearch);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeSearch();});
document.querySelectorAll("#year").forEach(element=>{element.textContent=new Date().getFullYear();});
getAppDownloadConfig().then(app=>document.querySelectorAll("[data-app-download]").forEach(link=>{link.href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html";})).catch(()=>{});

function configureNewsletter(){const signup=document.querySelector(".newsletter-signup");if(!signup||signup.dataset.tourismDetailReady==="true")return Boolean(signup);signup.dataset.tourismDetailReady="true";const title=signup.querySelector("h2"),description=signup.querySelector(".newsletter-box > div > p:last-child"),name=signup.querySelector('input[name="nome"]');if(title)title.textContent="Urânia direto no seu e-mail.";if(description)description.textContent="Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";if(name){name.placeholder="Seu nome";name.required=true;}return true;}

render().then(()=>Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")])).then(()=>{if(configureNewsletter())return;const observer=new MutationObserver(()=>{if(configureNewsletter())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),10000);});
