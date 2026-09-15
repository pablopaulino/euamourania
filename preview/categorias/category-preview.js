import { formatarData, gerarSlug, textoPuro } from "/assets/js/utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

const params = new URLSearchParams(location.search);
const currentSlug = params.get("categoria") || params.get("slug") || "";
const byId = id => document.getElementById(id);
const title = byId("category-title"), description = byId("category-description"), count = byId("category-count"), total = byId("category-total"), updated = byId("category-updated"), status = byId("category-status"), nav = byId("category-nav"), list = byId("category-news"), featured = byId("category-featured"), feedTitle = byId("category-feed-title"), form = byId("category-search-form"), search = byId("category-search");
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const summary = item => (item.resumo || textoPuro(item.conteudo_html || "")).trim();
const newsUrl = slug => `/preview/noticias/materia/?slug=${encodeURIComponent(slug)}`;
const categoryUrl = category => `/preview/categorias/?categoria=${encodeURIComponent(gerarSlug(category || "urania"))}`;
let categoryNews = [], categoryName = "";

function imageMarkup(item, className, priority = false) {
  const image = /^https?:\/\//i.test(item.imagem_url || "") || /^\/?assets\//.test(item.imagem_url || "") ? item.imagem_url : "";
  if (!image) return `<a class="${className} category-card-placeholder" href="${newsUrl(item.slug)}"><span>Eu Amo Urânia</span></a>`;
  return `<a class="${className}" href="${newsUrl(item.slug)}"><img src="${esc(image)}" alt="${esc(item.titulo)}" width="920" height="620" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="this.onerror=null;this.src='/assets/compartilhamento-logo.png';this.classList.add('is-fallback')"></a>`;
}
function metaLine(item) { return `<p class="category-card-meta"><span>${esc(item.categoria_nome || categoryName)}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p>`; }
function featuredCard(item) { const text = summary(item); return `<article class="category-featured-card">${imageMarkup(item,"category-featured-media",true)}<div class="category-featured-copy">${metaLine(item)}<h2><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h2>${text ? `<p>${esc(text)}</p>` : ""}<a class="category-read-link" href="${newsUrl(item.slug)}">Ler notícia <span>→</span></a></div></article>`; }
function card(item) { const text = summary(item); return `<article class="category-card">${imageMarkup(item,"category-card-media")}<div class="category-card-body">${metaLine(item)}<h3><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h3>${text ? `<p>${esc(text)}</p>` : ""}</div></article>`; }

function renderNav(news, rows) {
  const fromTable = rows.filter(item => normalize(item.tipo) === "noticias" && (!item.status || item.status === "ativo")).map(item => item.nome).filter(Boolean);
  const categories = [...new Set([...fromTable, ...news.map(item => item.categoria_nome).filter(Boolean)])].sort((a,b) => a.localeCompare(b,"pt-BR"));
  nav.innerHTML = [`<a href="/preview/noticias/">Todas</a>`, ...categories.map(category => `<a class="${gerarSlug(category) === currentSlug ? "active" : ""}" href="${categoryUrl(category)}"${gerarSlug(category) === currentSlug ? ' aria-current="page"' : ""}>${esc(category)}</a>`)].join("");
}
function render() {
  const term = normalize(search.value.trim());
  const filtered = categoryNews.filter(item => !term || normalize(`${item.titulo} ${item.resumo || ""}`).includes(term));
  const main = categoryNews[0];
  const items = term ? filtered : filtered.filter(item => item.slug !== main?.slug);
  feedTitle.textContent = `Mais sobre ${categoryName}.`;
  count.textContent = filtered.length === 1 ? "1 publicação encontrada" : `${filtered.length} publicações encontradas`;
  search.placeholder = `Buscar em ${categoryName}`;
  featured.innerHTML = main && !term ? featuredCard(main) : "";
  if (!filtered.length) { list.innerHTML = ""; status.hidden = false; status.textContent = term ? "Nenhuma notícia encontrada com essa busca." : "Ainda não há notícias nesta editoria."; return; }
  if (!items.length) { list.innerHTML = ""; status.hidden = false; status.textContent = term ? "A busca encontrou apenas a notícia em destaque." : "Esta editoria ainda tem apenas uma publicação."; return; }
  status.hidden = true; list.innerHTML = `<div class="category-news-grid">${items.map(card).join("")}</div>`;
}

function setupChrome() {
  const header=document.querySelector(".site-header"),menu=byId("menu-principal"),toggle=header?.querySelector(".menu-toggle"),trigger=header?.querySelector(".search-trigger"),headerInput=byId("header-search-input"),close=()=>{header?.classList.remove("search-open");trigger?.setAttribute("aria-expanded","false")};
  trigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");toggle?.setAttribute("aria-expanded","false");header?.classList.add("search-open");trigger.setAttribute("aria-expanded","true");setTimeout(()=>headerInput?.focus(),180)});toggle?.addEventListener("click",()=>{close();const open=toggle.getAttribute("aria-expanded")!=="true";toggle.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open)});header?.querySelector(".header-search-close")?.addEventListener("click",close);byId("year").textContent=new Date().getFullYear();getAppDownloadConfig().then(app=>document.querySelectorAll("[data-app-download]").forEach(link=>{link.href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html"})).catch(()=>{});
}
async function init() {
  setupChrome();
  if (!currentSlug) { location.replace("/preview/noticias/"); return; }
  if (!publicSupabaseConfigured()) { status.textContent = "Notícias indisponíveis no momento."; return; }
  try {
    const [news,categories] = await Promise.all([fetchPublicRows("noticias",{select:"id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em",status:"eq.publicado",publicado_em:`lte.${new Date().toISOString()}`,order:"publicado_em.desc",limit:"250"}),fetchPublicRows("categorias",{select:"nome,slug,descricao,tipo,status,ordem",status:"eq.ativo",order:"ordem.asc",limit:"100"}).catch(()=>[])]);
    renderNav(news,categories);
    const meta=categories.find(item=>gerarSlug(item.slug||item.nome||"")===currentSlug||gerarSlug(item.nome||"")===currentSlug);
    categoryName=meta?.nome||news.find(item=>gerarSlug(item.categoria_nome||"")===currentSlug)?.categoria_nome||"";
    if(!categoryName){title.textContent="Editoria não encontrada";description.textContent="Não encontramos notícias publicadas para esta editoria.";count.textContent="Nenhuma notícia encontrada.";status.textContent="Escolha outra editoria.";total.textContent="0";updated.textContent="—";return;}
    categoryNews=news.filter(item=>gerarSlug(item.categoria_nome||"")===gerarSlug(categoryName));title.textContent=categoryName;description.textContent=meta?.descricao||`Notícias de ${categoryName} em Urânia, com informação local e atualização da redação.`;total.textContent=String(categoryNews.length);updated.textContent=categoryNews[0]?.publicado_em?formatarData(categoryNews[0].publicado_em):"—";document.title=`${categoryName} | Eu Amo Urânia`;render();
  } catch(error) { console.error(error); status.textContent="Não foi possível carregar esta editoria agora."; }
  Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/error-monitor.js")]);
}
form?.addEventListener("submit",event=>{event.preventDefault();render()});search?.addEventListener("input",render);init();
