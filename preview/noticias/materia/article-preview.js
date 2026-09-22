import { definirMeta, formatarData, gerarSlug, textoPuro } from "/assets/js/utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { sanitizeArticleHtml } from "/assets/js/security/sanitize-html.js";
import { responsiveImage } from "/assets/js/image-tools.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "/preview/guia/banners-preview.js";

const container=document.getElementById("newsDetails");
const query=new URLSearchParams(location.search);
const pathSlug=location.pathname.match(/^\/noticias\/([^/]+)\/?$/)?.[1]||"";
const esc=(value="")=>String(value).replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const safeImage=(value,options={})=>/^https?:\/\//i.test(value||"")||/^\/?assets\//i.test(value||"")?esc(responsiveImage(value,options)):"";
const summary=item=>(item.resumo||textoPuro(item.conteudo_html||"")).trim();
const articleUrl=slug=>`/noticias/${encodeURIComponent(slug)}`;
const previewUrl=slug=>`/preview/noticias/materia/?slug=${encodeURIComponent(slug)}`;
const categoryUrl=value=>`/news/${encodeURIComponent(gerarSlug(value||"urania"))}/`;
const icons={
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.8 9.8 0 0 0-8.4 14.8L2 22l5.4-1.4A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3.2.9.9-3.1-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.8-1.8-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.3 0-.4.1-.5l.4-.5.2-.4c.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.5-.4-.7-.4H8c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
  facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.2l.8-4h-4V9c0-.7.3-1 1-1Z"/></svg>',
  copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="11" height="11" rx="2"></rect><path d="M9 8V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>',
  share:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"></path></svg>'
};

async function findNews(){
  if(!publicSupabaseConfigured())return null;
  const slug=query.get("slug")||pathSlug;
  const options={select:"*",status:"eq.publicado",publicado_em:`lte.${new Date().toISOString()}`,limit:"1"};
  if(slug)options.slug=`eq.${slug}`; else options.order="publicado_em.desc";
  const [news]=await fetchPublicRows("noticias",options);
  return news||null;
}

function structuredData(news,canonical,description,image){
  const node=document.createElement("script"); node.type="application/ld+json"; node.id="news-structured-data";
  node.textContent=JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"NewsArticle","@id":`${canonical}#newsarticle`,headline:news.titulo,description,image:image?[image]:undefined,datePublished:news.publicado_em,dateModified:news.publicado_em,author:{"@type":"Organization",name:news.autor||"Redação Eu Amo Urânia",url:"https://euamourania.com.br/quem-somos.html"},publisher:{"@type":"Organization",name:"Eu Amo Urânia",url:"https://euamourania.com.br"},mainEntityOfPage:{"@type":"WebPage","@id":canonical},articleSection:news.categoria_nome||"Notícias",articleBody:textoPuro(news.conteudo_html||news.resumo||"")||undefined,isAccessibleForFree:true,inLanguage:"pt-BR"},{"@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Início",item:"https://euamourania.com.br/"},{"@type":"ListItem",position:2,name:"Notícias",item:"https://euamourania.com.br/news/"},{"@type":"ListItem",position:3,name:news.titulo,item:canonical}]}]});
  document.head.appendChild(node);
}

function shareMarkup(news,canonical){
  const text=encodeURIComponent(`${news.titulo} — ${canonical}`),url=encodeURIComponent(canonical);
  return `<div class="article-share" aria-label="Compartilhar notícia"><a href="https://api.whatsapp.com/send?text=${text}" target="_blank" rel="noopener" aria-label="Compartilhar no WhatsApp">${icons.whatsapp}<span>WhatsApp</span></a><a href="https://www.facebook.com/sharer/sharer.php?u=${url}" target="_blank" rel="noopener" aria-label="Compartilhar no Facebook">${icons.facebook}<span>Facebook</span></a><button type="button" data-copy-link aria-label="Copiar link">${icons.copy}<span>Copiar link</span></button><button type="button" data-native-share aria-label="Compartilhar notícia">${icons.share}<span>Compartilhar</span></button></div>`;
}

function normalizeMedia(){
  const copy=container.querySelector(".article-copy"); if(!copy)return;
  copy.querySelectorAll("img").forEach(image=>{image.loading="lazy";image.decoding="async";if(!image.alt)image.alt="Imagem da matéria";});
  copy.querySelectorAll("iframe").forEach(frame=>{frame.loading="lazy";frame.title=frame.title||"Vídeo da matéria";frame.referrerPolicy="strict-origin-when-cross-origin";frame.allowFullscreen=true;});
  copy.querySelectorAll("video").forEach(video=>{video.controls=true;video.playsInline=true;video.preload="metadata";});
}

function readingProgress(){
  const bar=document.getElementById("reading-progress-bar"),article=container.querySelector(".article-reading"); if(!bar||!article)return;
  let ticking=false; const update=()=>{const rect=article.getBoundingClientRect(),start=scrollY+rect.top,end=Math.max(start+article.offsetHeight-innerHeight,start+1);bar.style.transform=`scaleX(${Math.min(1,Math.max(0,(scrollY-start)/(end-start)))})`;ticking=false;};
  addEventListener("scroll",()=>{if(!ticking){requestAnimationFrame(update);ticking=true;}},{passive:true}); addEventListener("resize",update,{passive:true}); update();
}

function card(item){
  const image=safeImage(item.imagem_url,{width:700,height:440,quality:76});
  return `<a class="more-card${image?"":" no-image"}" href="${previewUrl(item.slug)}">${image?`<img src="${image}" alt="${esc(item.titulo)}" width="700" height="440" loading="lazy" decoding="async">`:""}<div><p>${esc(item.categoria_nome||"Notícias")}</p><h3>${esc(item.titulo)}</h3><span>${esc(formatarData(item.publicado_em))}</span></div></a>`;
}

async function loadRelated(news){
  const target=document.getElementById("article-related"); if(!target)return;
  try{
    const common={select:"titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes",status:"eq.publicado",publicado_em:`lte.${new Date().toISOString()}`,slug:`neq.${news.slug}`,order:"publicado_em.desc",limit:"10"};
    let related=[];
    if(news.categoria_nome)related=await fetchPublicRows("noticias",{...common,categoria_nome:`eq.${news.categoria_nome}`,limit:"4"});
    const latest=await fetchPublicRows("noticias",common); const used=new Set(related.map(item=>item.slug)); latest.forEach(item=>{if(related.length<4&&!used.has(item.slug)){related.push(item);used.add(item.slug);}});
    const popular=await fetchPublicRows("noticias",{...common,order:"visualizacoes.desc",limit:"5"}).catch(()=>[]);
    const next=related[0],more=related.slice(1,4);
    if(!next&&!more.length&&!popular.length){target.remove();return;}
    const nextImage=next?safeImage(next.imagem_url,{width:420,height:280,quality:76}):"";
    target.innerHTML=`${next?`<section class="next-story" aria-labelledby="next-title"><p>Próxima leitura</p><a href="${previewUrl(next.slug)}">${nextImage?`<img class="next-story-image" src="${nextImage}" alt="" width="420" height="280" loading="lazy" decoding="async">`:""}<span><small>${esc(next.categoria_nome||"Notícias")} · ${esc(formatarData(next.publicado_em))}</small><strong id="next-title">${esc(next.titulo)}</strong></span><b aria-hidden="true">→</b></a></section>`:""}${more.length?`<section class="continue-reading" aria-labelledby="continue-title"><header><p>Mais notícias</p><h2 id="continue-title">Continue lendo.</h2></header><div class="more-track">${more.map(card).join("")}</div></section>`:""}${popular.length?`<section class="article-trending" aria-labelledby="popular-title"><header><p>Mais lidas</p><h2 id="popular-title">Em alta.</h2></header><ol>${popular.map((item,index)=>`<li><a href="${previewUrl(item.slug)}"><span>${String(index+1).padStart(2,"0")}</span><strong>${esc(item.titulo)}</strong><b aria-hidden="true">↗</b></a></li>`).join("")}</ol></section>`:""}`;
  }catch(error){console.warn("Relacionadas indisponíveis",error);target.remove();}
}

function render(news){
  const canonical=`https://euamourania.com.br/noticias/${encodeURIComponent(news.slug)}`,description=news.seo_descricao||summary(news).slice(0,160),image=news.imagem_url?.trim()||document.querySelector('meta[property="og:image"]')?.content;
  definirMeta({titulo:`${news.seo_titulo||news.titulo} | Eu Amo Urânia`,descricao:description,imagem:image,url:canonical}); structuredData(news,canonical,description,image);
  const content=sanitizeArticleHtml(news.conteudo_html)||`<p>${esc(summary(news))}</p>`,words=textoPuro(content).split(/\s+/).filter(Boolean).length,minutes=Math.max(1,Math.ceil(words/220));
  const category=news.categoria_nome||"Notícias",hero=safeImage(news.imagem_url,{width:1600,height:960,quality:84});
  container.innerHTML=`<article class="article-reading"><nav class="article-breadcrumb" aria-label="Navegação da notícia"><a href="/preview/noticias/">Notícias</a><i>/</i><a href="${categoryUrl(category)}">${esc(category)}</a></nav><header class="article-header"><p class="article-category">${esc(category)}</p><h1>${esc(news.titulo)}</h1>${news.subtitulo?`<p class="article-subtitle">${esc(news.subtitulo)}</p>`:""}<div class="article-meta"><span>Por ${esc(news.autor||"Eu Amo Urânia")}</span><time datetime="${esc(news.publicado_em)}">${esc(formatarData(news.publicado_em))}</time><span>${minutes} min de leitura</span></div>${shareMarkup(news,canonical)}</header>${hero?`<figure class="article-hero"><img src="${hero}" alt="${esc(news.legenda_imagem||news.titulo)}" width="1600" height="960" fetchpriority="high" decoding="async">${news.legenda_imagem?`<figcaption>${esc(news.legenda_imagem)}</figcaption>`:""}</figure>`:""}<div class="article-copy" data-ad-eligible="${words>=280}">${content}</div><footer class="article-correction"><a href="/news/correcoes-transparencia-contato/">Encontrou algum erro? Solicitar correção <span aria-hidden="true">→</span></a></footer></article><section class="editorial-contact"><div><p>Colabore com a redação</p><h2>Tem uma história relevante para Urânia?</h2><span>Envie pautas, fotos ou informações. A conversa continua depois da leitura.</span></div><a href="https://wa.me/5517976005583" target="_blank" rel="noopener">Falar com a redação <b aria-hidden="true">→</b></a></section><div id="article-related" class="article-related" aria-live="polite"><p class="article-loading">Organizando outras leituras…</p></div>`;
  normalizeMedia(); readingProgress(); bindShare(news,canonical); window.dispatchEvent(new CustomEvent("noticia:renderizada")); document.dispatchEvent(new CustomEvent("noticia:renderizada")); loadRelated(news);
}

function bindShare(news,canonical){
  container.querySelector("[data-copy-link]")?.addEventListener("click",async event=>{const label=event.currentTarget.querySelector("span");try{await navigator.clipboard.writeText(canonical);label.textContent="Link copiado";}catch{label.textContent="Copie pela barra";}});
  container.querySelector("[data-native-share]")?.addEventListener("click",async()=>{if(navigator.share)try{await navigator.share({title:news.titulo,text:summary(news).slice(0,120),url:canonical});}catch(error){if(error?.name!=="AbortError")console.warn(error);}});
}

const header=document.querySelector(".site-header"),menu=document.getElementById("menu-principal"),menuButton=header?.querySelector(".menu-toggle"),searchTrigger=header?.querySelector(".search-trigger"),headerSearchInput=document.getElementById("header-search-input");
const closeSearch=()=>{header?.classList.remove("search-open");searchTrigger?.setAttribute("aria-expanded","false");};
searchTrigger?.addEventListener("click",()=>{menu?.classList.remove("is-open");menuButton?.setAttribute("aria-expanded","false");header?.classList.add("search-open");searchTrigger.setAttribute("aria-expanded","true");setTimeout(()=>headerSearchInput?.focus(),180);});
menuButton?.addEventListener("click",()=>{closeSearch();const open=menuButton.getAttribute("aria-expanded")!=="true";menuButton.setAttribute("aria-expanded",String(open));menu?.classList.toggle("is-open",open);});
header?.querySelector(".header-search-close")?.addEventListener("click",closeSearch); addEventListener("keydown",event=>{if(event.key==="Escape")closeSearch();});
document.getElementById("year").textContent=new Date().getFullYear(); getAppDownloadConfig().then(app=>document.querySelectorAll("[data-app-download]").forEach(link=>{link.href=app.googlePlayUrl||app.appStoreUrl||app.appPageUrl||"/app.html";})).catch(()=>{});

async function load(){
  try{const news=await findNews();if(!news)throw new Error("not-found");render(news);await Promise.allSettled([import("/assets/js/pages/site-config-page.js"),import("/assets/js/pages/analytics-page.js"),import("/assets/js/pages/newsletter-public.js"),import("/assets/js/pages/google-analytics-page.js"),import("/assets/js/pages/smart-app-banner.js"),import("/assets/js/pages/error-monitor.js")]);configureNewsletter();}
  catch(error){console.error(error);container.innerHTML='<div class="article-empty"><strong>Notícia não encontrada.</strong><p>Ela pode ter sido removida ou ainda não está disponível.</p><a href="/preview/noticias/">Voltar às notícias</a></div>';}
}
function configureNewsletter(){const signup=document.querySelector(".newsletter-signup");if(!signup)return;const title=signup.querySelector("h2"),description=signup.querySelector(".newsletter-box > div > p:last-child"),name=signup.querySelector('input[name="nome"]');if(title)title.textContent="Urânia direto no seu e-mail.";if(description)description.textContent="Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";if(name){name.placeholder="Seu nome";name.required=true;}}
load();
