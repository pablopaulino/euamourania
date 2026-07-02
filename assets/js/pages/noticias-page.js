import { formatarData, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container=document.getElementById("news-container");
const featured=document.getElementById("news-featured");
const status=document.getElementById("news-status");
const filters=document.getElementById("news-category-filters");
const search=document.getElementById("news-search");
const searchForm=document.getElementById("news-search-form");
const resultsCount=document.getElementById("news-results-count");
const loadMore=document.getElementById("news-load-more");
const PAGE_SIZE=8;
let feed=[];
let selectedCategory="";
let visibleCount=PAGE_SIZE;

const esc=(value="")=>String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const safeImage=value=>/^https?:\/\//i.test(value||"")?esc(value):"../assets/Design sem nome (9).png";
const newsUrl=slug=>`/noticias/${encodeURIComponent(slug)}`;
const summary=item=>(item.resumo||textoPuro(item.conteudo_html||"")).trim();
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

function renderFeatured(item){
 const text=summary(item),url=newsUrl(item.slug);
 featured.innerHTML=`<article class="news-lead"><a class="news-lead-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" fetchpriority="high"></a><div class="news-lead-content"><p class="eyebrow">Em destaque · ${esc(item.categoria_nome||"Urânia")}</p><h2><a href="${url}">${esc(item.titulo)}</a></h2><p class="news-lead-date">${esc(formatarData(item.publicado_em))}</p>${text?`<p class="news-lead-summary">${esc(text.slice(0,220))}${text.length>220?"…":""}</p>`:""}<a class="button button-accent" href="${url}">Ler notícia completa <span aria-hidden="true">→</span></a></div></article>`;
}

function renderFilters(items){
 const categories=[...new Set(items.map(item=>item.categoria_nome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 filters.innerHTML=[["","Todas"],...categories.map(category=>[category,category])].map(([value,label],index)=>`<button type="button" class="news-filter ${index===0?"active":""}" data-category="${esc(value)}" aria-pressed="${index===0?"true":"false"}">${esc(label)}</button>`).join("");
}

function filteredNews(){
 const term=normalize(search.value.trim());
 return feed.filter(item=>{
  const categoryMatch=!selectedCategory||item.categoria_nome===selectedCategory;
  const contentMatch=!term||normalize(`${item.titulo} ${item.resumo||""} ${item.categoria_nome||""}`).includes(term);
  return categoryMatch&&contentMatch;
 });
}

function card(item){
 const text=summary(item),url=newsUrl(item.slug);
 return `<article class="news-item"><a class="news-item-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="lazy"></a><div class="content"><p class="news-item-meta"><span>${esc(item.categoria_nome||"Urânia")}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3>${text?`<p class="news-item-summary">${esc(text.slice(0,155))}${text.length>155?"…":""}</p>`:""}<a href="${url}" class="read-more">Ler notícia <span aria-hidden="true">→</span></a></div></article>`;
}

function renderFeed(){
 const items=filteredNews(),visible=items.slice(0,visibleCount);
 resultsCount.textContent=items.length===1?"1 notícia encontrada":`${items.length} notícias encontradas`;
 container.innerHTML=visible.length?visible.map(card).join(""):'<div class="empty-state news-empty"><strong>Nenhuma notícia encontrada.</strong><p>Tente outro termo ou escolha uma categoria diferente.</p></div>';
 loadMore.hidden=visible.length>=items.length;
}

filters.addEventListener("click",event=>{
 const button=event.target.closest("[data-category]");if(!button)return;
 selectedCategory=button.dataset.category;
 visibleCount=PAGE_SIZE;
 filters.querySelectorAll("[data-category]").forEach(item=>{
  const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));
 });
 renderFeed();
});
search.addEventListener("input",()=>{visibleCount=PAGE_SIZE;renderFeed()});
searchForm.addEventListener("submit",event=>{event.preventDefault();renderFeed()});
loadMore.addEventListener("click",()=>{visibleCount+=PAGE_SIZE;renderFeed()});

async function carregarNoticias(){
 if(!publicSupabaseConfigured()){status.textContent="Configure o Supabase para carregar as notícias.";return}
 try{
  const news=await fetchPublicRows("noticias",{
   select:"id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque",
   status:"eq.publicado",
   publicado_em:`lte.${new Date().toISOString()}`,
   order:"publicado_em.desc"
  });
  if(!news.length){status.textContent="Nenhuma notícia publicada.";return}
  const lead=news.find(item=>item.destaque)||news[0];
  feed=news.filter(item=>item.id!==lead.id);
  renderFeatured(lead);
  renderFilters(feed);
  renderFeed();
  status.hidden=true;
 }catch(error){
  console.error(error);
  status.textContent="Não foi possível carregar as notícias. Tente novamente mais tarde.";
 }
}

carregarNoticias();
