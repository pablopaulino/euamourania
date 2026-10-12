import { formatarData, gerarSlug } from "/assets/js/utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { responsiveImage } from "/assets/js/image-tools.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "/preview/guia/banners-preview.js";

const featured = document.getElementById("news-featured");
const container = document.getElementById("news-container");
const status = document.getElementById("news-status");
const filters = document.getElementById("news-category-filters");
const search = document.getElementById("news-search");
const searchForm = document.getElementById("news-search-form");
const resultsCount = document.getElementById("news-results-count");
const clearFilters = document.getElementById("news-clear-filters");
const loadMore = document.getElementById("news-load-more");
const loadStatus = document.getElementById("news-load-status");
const PAGE_SIZE = 6;
const PAGE_FETCH = 7;
const INITIAL_LIMIT = 10;
const fallbackImage = "/assets/Design sem nome (9).png";
let initialState = null;
try { initialState = JSON.parse(document.getElementById("initial-news-list-data")?.textContent || "null"); } catch {}
const hasServerContent = featured?.dataset.serverRendered === "true" && container?.dataset.serverRendered === "true";
const canHydrate = hasServerContent && Array.isArray(initialState?.items);
let allNews = canHydrate ? initialState.items : [], feed = [], selectedCategory = "", visibleCount = PAGE_SIZE, isLoading = false;
let highlightNews = canHydrate ? initialState.highlight : null;
let popularNews = canHydrate ? initialState.popular || [] : [];
let categoryNames = canHydrate ? initialState.categories || [] : [];
let publishedBefore = canHydrate ? initialState.publishedBefore : new Date().toISOString();
let nextOffset = canHydrate ? Number(initialState.nextOffset || allNews.length) : 0;
let hasMore = canHydrate ? Boolean(initialState.hasMore) : false;
let fullCorpusLoaded = false, corpusPromise = null;

const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const short = (value = "", limit = 150) => { const text=String(value || "").trim(); return text.length > limit ? `${text.slice(0,limit).trim()}…` : text; };
const newsUrl = slug => `/noticias/${encodeURIComponent(slug)}`;
const categoryUrl = category => `/news/${encodeURIComponent(gerarSlug(category || "urania"))}`;
const imageUrl = (value, options) => /^https?:\/\//i.test(value || "") || /^\/?assets\//i.test(value || "") ? esc(responsiveImage(value, options)) : fallbackImage;
const categoryLink = value => `<a href="${categoryUrl(value)}">${esc(value || "Urânia")}</a>`;

function nowStrip(items) {
  const links=items.slice(0,6).map(item => `<a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a>`).join("");
  const duplicateLinks=links.replaceAll("<a ",'<a tabindex="-1" ');
  return `<div class="news-now"><strong><i></i> Agora</strong><div class="news-now-viewport" tabindex="0" aria-label="Últimas manchetes"><div class="news-now-track"><span>${links}</span><span aria-hidden="true">${duplicateLinks}</span></div></div></div>`;
}

function leadStory(item) {
  const url=newsUrl(item.slug), summary=short(item.resumo,185);
  return `<article class="cover-lead"><a class="cover-lead-image" href="${url}" aria-label="${esc(item.titulo)}"><img src="${imageUrl(item.imagem_url,{width:1100,height:760,quality:78})}" alt="${esc(item.titulo)}" width="1100" height="760" fetchpriority="high" decoding="async"></a><div class="cover-lead-copy"><div><span>Manchete</span>${categoryLink(item.categoria_nome)}</div><h2><a href="${url}">${esc(item.titulo)}</a></h2>${summary ? `<p>${esc(summary)}</p>`:""}<footer><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time><a href="${url}">Ler notícia <b aria-hidden="true">→</b></a></footer></div></article>`;
}

function secondaryStory(item) {
  const url=newsUrl(item.slug);
  return `<article class="cover-secondary"><a class="cover-secondary-image" href="${url}" aria-label="${esc(item.titulo)}"><img src="${imageUrl(item.imagem_url,{width:560,height:380,quality:75})}" alt="${esc(item.titulo)}" width="560" height="380" loading="lazy" decoding="async"></a><div><p>${categoryLink(item.categoria_nome)}<time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3><a class="secondary-arrow" href="${url}" aria-label="Ler ${esc(item.titulo)}">→</a></div></article>`;
}

function trending(items) {
  if (!items.length) return "";
  return `<section class="news-trending" aria-labelledby="trending-title"><header><p class="news-eyebrow">Mais lidas</p><h2 id="trending-title">Em alta.</h2></header><div>${items.map((item,index) => `<a href="${newsUrl(item.slug)}"><span>${String(index+1).padStart(2,"0")}</span><strong>${esc(item.titulo)}</strong><b aria-hidden="true">↗</b></a>`).join("")}</div></section>`;
}

function prepareFeed() {
  const lead=highlightNews || allNews.find(item => item.destaque) || allNews[0];
  if (!lead) { feed=[]; return {lead:null,supporting:[]}; }
  const supporting=allNews.filter(item => item.id !== lead.id).slice(0,2);
  const featuredIds=new Set([lead,...supporting].map(item => item.id));
  feed=allNews.filter(item => !featuredIds.has(item.id));
  return {lead,supporting};
}

function renderFeatured() {
  const {lead,supporting}=prepareFeed();
  if (!lead) return;
  const popular=popularNews.length ? popularNews : [...allNews].sort((a,b) => Number(b.visualizacoes || 0)-Number(a.visualizacoes || 0) || new Date(b.publicado_em)-new Date(a.publicado_em)).slice(0,5);
  featured.innerHTML=`${nowStrip(allNews)}<div class="news-cover"><div class="cover-grid">${leadStory(lead)}<div class="cover-secondary-list">${supporting.map(secondaryStory).join("")}</div></div>${trending(popular)}</div>`;
}

function renderFilters() {
  const categories=[...new Set([...categoryNames,...allNews.map(item => item.categoria_nome)].filter(Boolean))].sort((a,b) => a.localeCompare(b,"pt-BR"));
  filters.innerHTML=[["","Todas"],...categories.map(category => [category,category])].map(([value,label],index) => `<button type="button" data-category="${esc(value)}" aria-pressed="${index===0}" class="${index===0 ? "active":""}">${esc(label)}</button>`).join("");
}

function filteredNews() {
  const term=normalize(search.value.trim());
  return feed.filter(item => (!selectedCategory || item.categoria_nome === selectedCategory) && (!term || normalize(`${item.titulo} ${item.resumo || ""} ${item.categoria_nome || ""}`).includes(term)));
}

function newsCard(item) {
  const url=newsUrl(item.slug), summary=short(item.resumo,150);
  return `<article class="news-item archive-card"><a class="archive-card-image" href="${url}" aria-label="${esc(item.titulo)}"><img src="${imageUrl(item.imagem_url,{width:760,height:470,quality:75})}" alt="${esc(item.titulo)}" width="760" height="470" loading="lazy" decoding="async"></a><div class="archive-card-copy"><p>${categoryLink(item.categoria_nome)}<time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3>${summary ? `<p class="archive-summary">${esc(summary)}</p>`:""}<a class="archive-card-link" href="${url}">Ler notícia <span aria-hidden="true">→</span></a></div></article>`;
}

function updateControls(items, visible) {
  const filtered=Boolean(selectedCategory || search.value.trim());
  resultsCount.textContent=filtered ? (items.length === 1 ? "1 notícia encontrada" : `${items.length} notícias encontradas`) : "";
  clearFilters.hidden=!filtered;
  loadMore.hidden=visible.length >= items.length && (filtered || !hasMore);
  loadMore.textContent=isLoading ? "Carregando…" : "Ver mais notícias";
  loadStatus.textContent=isLoading ? "Carregando mais notícias…" : visible.length < items.length || (!filtered && hasMore) ? "Continue rolando para ver mais notícias." : items.length > PAGE_SIZE ? "Você chegou ao fim das notícias." : "";
}

function renderFeed() {
  const items=filteredNews(), visible=items.slice(0,visibleCount);
  container.innerHTML=visible.length ? `<div class="news-card-grid">${visible.map(newsCard).join("")}</div>` : `<div class="news-empty"><strong>Nenhuma notícia encontrada.</strong><p>Tente outro termo ou escolha outra categoria.</p><button type="button" data-clear-news>Limpar filtros</button></div>`;
  updateControls(items,visible);
  document.dispatchEvent(new CustomEvent("noticias:renderizado"));
}

const listQuery = (limit, offset, cutoff = publishedBefore) => ({
  select:"id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque,visualizacoes",
  status:"eq.publicado", publicado_em:`lte.${cutoff}`, order:"publicado_em.desc",
  limit:String(limit), offset:String(offset)
});

async function ensureFullCorpus() {
  if (fullCorpusLoaded) return;
  if (corpusPromise) return corpusPromise;
  corpusPromise=fetchPublicRows("noticias",{
    select:"id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque,visualizacoes",
    status:"eq.publicado", publicado_em:`lte.${new Date().toISOString()}`, order:"publicado_em.desc"
  }).then(items=>{
    allNews=items; fullCorpusLoaded=true; hasMore=false; prepareFeed();
  }).finally(()=>{corpusPromise=null;});
  return corpusPromise;
}

async function loadNext(scrollToNew=false) {
  if (isLoading || loadMore.hidden) return;
  const previous=visibleCount;
  let failed=false;
  isLoading=true; updateControls(filteredNews(),filteredNews().slice(0,visibleCount));
  visibleCount+=PAGE_SIZE;
  try {
    while (!fullCorpusLoaded && !selectedCategory && !search.value.trim() && feed.length<visibleCount && hasMore) {
      const next=await fetchPublicRows("noticias",listQuery(PAGE_FETCH,nextOffset));
      nextOffset+=next.length;
      hasMore=next.length===PAGE_FETCH;
      const existing=new Set(allNews.map(item=>item.id));
      allNews.push(...next.filter(item=>!existing.has(item.id)));
      prepareFeed();
    }
    renderFeed();
    if(scrollToNew)container.querySelectorAll(".archive-card")[previous]?.scrollIntoView({behavior:"smooth",block:"nearest"});
  } catch(error) {
    console.error(error); visibleCount=previous; failed=true;
  } finally {
    isLoading=false; updateControls(filteredNews(),filteredNews().slice(0,visibleCount));
    if(failed)loadStatus.textContent="Não foi possível carregar mais notícias. Tente novamente.";
  }
}

async function applySearchOrFilter() {
  if(!selectedCategory&&!search.value.trim()&&!fullCorpusLoaded){visibleCount=PAGE_SIZE;renderFeed();return;}
  loadStatus.textContent="Buscando notícias…";
  try { await ensureFullCorpus(); visibleCount=PAGE_SIZE; renderFeed(); }
  catch(error) { console.error(error); loadStatus.textContent="Não foi possível completar a busca agora. Tente novamente."; }
}

filters.addEventListener("click", event => { const button=event.target.closest("[data-category]"); if(!button)return; selectedCategory=button.dataset.category; filters.querySelectorAll("button").forEach(item => { const active=item===button; item.classList.toggle("active",active); item.setAttribute("aria-pressed",String(active)); }); applySearchOrFilter(); });
search.addEventListener("input", applySearchOrFilter);
searchForm.addEventListener("submit", event => { event.preventDefault(); applySearchOrFilter(); });
loadMore.addEventListener("click", () => loadNext(true));
document.addEventListener("click", event => { if(!event.target.closest("#news-clear-filters,[data-clear-news]"))return; selectedCategory=""; search.value=""; visibleCount=PAGE_SIZE; filters.querySelectorAll("button").forEach((item,index) => { item.classList.toggle("active",index===0); item.setAttribute("aria-pressed",String(index===0)); }); renderFeed(); search.focus(); });

if ("IntersectionObserver" in window) {
  document.body.classList.add("has-auto-load");
  new IntersectionObserver(entries => { if(entries.some(entry => entry.isIntersecting)) loadNext(false); },{rootMargin:"500px 0px"}).observe(loadMore);
}

const header=document.querySelector(".site-header"), menu=document.getElementById("menu-principal"), menuButton=header?.querySelector(".menu-toggle"), searchTrigger=header?.querySelector(".search-trigger"), headerSearchInput=document.getElementById("header-search-input");
const closeHeaderSearch=()=>{header?.classList.remove("search-open");searchTrigger?.setAttribute("aria-expanded","false");};
searchTrigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");menuButton?.setAttribute("aria-expanded","false");header?.classList.add("search-open");searchTrigger.setAttribute("aria-expanded","true");setTimeout(()=>headerSearchInput?.focus(),180);});
menuButton?.addEventListener("click",()=>{closeHeaderSearch();const open=menuButton.getAttribute("aria-expanded")!=="true";menuButton.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open);});
header?.querySelector(".header-search-close")?.addEventListener("click",closeHeaderSearch);
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeHeaderSearch();});
document.querySelectorAll("#year").forEach(element=>{element.textContent=new Date().getFullYear();});
getAppDownloadConfig().then(app=>document.querySelectorAll("[data-app-download]").forEach(link=>{link.href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html";})).catch(()=>{});

function configureNewsletter() {
  const signup=document.querySelector(".newsletter-signup"); if(!signup)return false;
  const title=signup.querySelector("h2"), description=signup.querySelector(".newsletter-box > div > p:last-child"), name=signup.querySelector('input[name="nome"]');
  if(title)title.textContent="Urânia direto no seu e-mail.";
  if(description)description.textContent="Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";
  if(name){name.placeholder="Seu nome";name.required=true;}
  return true;
}

async function loadNews() {
  if (canHydrate) {
    prepareFeed();
    if (allNews.length) status.hidden=true;
    updateControls(filteredNews(),filteredNews().slice(0,visibleCount));
    document.dispatchEvent(new CustomEvent("noticias:renderizado"));
    await Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")]);
    configureNewsletter();
    return;
  }
  if(!publicSupabaseConfigured()){if(!hasServerContent)status.textContent="Configure o Supabase para carregar as notícias.";return;}
  try {
    const cutoff=new Date().toISOString();
    const [latest,highlight,popular,categories]=await Promise.all([
      fetchPublicRows("noticias",listQuery(INITIAL_LIMIT,0,cutoff)),
      fetchPublicRows("noticias",{...listQuery(1,0,cutoff),destaque:"eq.true"}).catch(()=>[]),
      fetchPublicRows("noticias",{...listQuery(5,0,cutoff),order:"visualizacoes.desc,publicado_em.desc"}).catch(()=>[]),
      fetchPublicRows("categorias",{select:"nome",tipo:"eq.noticias",status:"eq.ativo",order:"ordem.asc",limit:"100"}).catch(()=>[])
    ]);
    allNews=latest; highlightNews=highlight[0]||null; popularNews=popular;
    categoryNames=categories.map(item=>item.nome).filter(Boolean);
    publishedBefore=cutoff; nextOffset=latest.length; hasMore=latest.length===INITIAL_LIMIT;
    if(!allNews.length){featured.innerHTML="";status.textContent="Nenhuma notícia publicada.";return;}
    renderFeatured(); renderFilters(); renderFeed(); status.hidden=true;
    await Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")]);
    configureNewsletter();
  } catch(error) { console.error(error); if(!hasServerContent){featured.innerHTML=""; status.textContent="Não foi possível carregar as notícias agora.";} }
}

document.querySelectorAll('a[href="/news/sobre-publicacoes/"]').forEach(link=>link.href="/preview/noticias/sobre-publicacoes/");
document.querySelectorAll('a[href="/news/politica-editorial/"]').forEach(link=>link.href="/preview/noticias/politica-editorial/");
document.querySelectorAll('a[href="/news/correcoes-transparencia-contato/"]').forEach(link=>link.href="/preview/noticias/correcoes-transparencia-contato/");
loadNews();
