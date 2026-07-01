import { buscarNoticiaPorSlug, listarNoticiasRelacionadas } from "../services/noticiasService.js";
import { definirMeta, formatarData, textoPuro } from "../utils.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";

const container=document.getElementById("newsDetails");
const params=new URLSearchParams(location.search||location.hash.slice(1));
const pathSlug=location.pathname.match(/^\/noticias\/([^/]+)\/?$/)?.[1];
const slug=params.get("slug")||pathSlug;
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const safeImage=v=>/^https?:\/\//i.test(v||"")||/^\/?assets\//.test(v||"")?esc(v):"";
const resumo=item=>(item.resumo||textoPuro(item.conteudo_html||"")).trim();
const urlNoticia=s=>`/noticias/${encodeURIComponent(s)}`;
const icons={whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.8 9.8 0 0 0-8.4 14.8L2 22l5.4-1.4A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3.2.9.9-3.1-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.8-1.8-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.3 0-.4.1-.5l.4-.5.2-.4c.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.5-.4-.7-.4H8c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',facebook:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.2l.8-4h-4V9c0-.7.3-1 1-1Z"/></svg>',copy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3Zm2 0h4a2 2 0 0 1 2 2v4h3V4h-9v3Zm4 2H5v9h9V9Z"/></svg>'};

async function carregarNoticia(){
  if(!supabaseConfigurado()){container.innerHTML='<p class="not-found-message">Configure o Supabase para carregar esta notícia.</p>';return}
  if(!slug){container.innerHTML='<p class="not-found-message">Notícia não encontrada.</p>';return}
  try{
    const noticia=await buscarNoticiaPorSlug(slug);if(!noticia||noticia.status!=="publicado")throw new Error("not-found");
    const canonical=`https://euamourania.com.br/noticias/${encodeURIComponent(noticia.slug)}`;
    if(location.pathname.includes("news-details"))history.replaceState({},"",urlNoticia(noticia.slug));
    const descricao=noticia.seo_descricao||resumo(noticia).slice(0,160),imagemMeta=noticia.seo_imagem||noticia.imagem_url;
    definirMeta({titulo:`${noticia.seo_titulo||noticia.titulo} | Eu Amo Urânia`,descricao,imagem:imagemMeta,url:canonical});
    let structured=document.getElementById("news-structured-data");if(!structured){structured=document.createElement("script");structured.type="application/ld+json";structured.id="news-structured-data";document.head.appendChild(structured)}structured.textContent=JSON.stringify({"@context":"https://schema.org","@type":"NewsArticle",headline:noticia.titulo,description:descricao,image:imagemMeta?[imagemMeta]:undefined,datePublished:noticia.publicado_em,dateModified:noticia.atualizado_em||noticia.publicado_em,author:{"@type":"Organization",name:noticia.autor||"Eu Amo Urânia"},publisher:{"@type":"Organization",name:"Eu Amo Urânia",logo:{"@type":"ImageObject",url:"https://euamourania.com.br/assets/Design%20sem%20nome%20(9).png"}},mainEntityOfPage:canonical});
    const conteudo=window.DOMPurify?window.DOMPurify.sanitize(noticia.conteudo_html,{ADD_TAGS:["iframe"],ADD_ATTR:["allow","allowfullscreen","frameborder"]}):`<p>${esc(textoPuro(noticia.conteudo_html))}</p>`;
    container.innerHTML=`<article class="news-detail-container"><header class="article-header"><p class="eyebrow">${esc(noticia.categoria_nome||"Notícias de Urânia")}</p><h1>${esc(noticia.titulo)}</h1>${noticia.subtitulo?`<p class="article-subtitle">${esc(noticia.subtitulo)}</p>`:""}<p class="meta"><span>Por ${esc(noticia.autor||"Eu Amo Urânia")}</span><time datetime="${esc(noticia.publicado_em)}">${esc(formatarData(noticia.publicado_em))}</time></p></header>${safeImage(noticia.imagem_url)?`<figure class="article-figure"><img src="${safeImage(noticia.imagem_url)}" alt="${esc(noticia.legenda_imagem||noticia.titulo)}" class="main-image">${noticia.legenda_imagem?`<figcaption>${esc(noticia.legenda_imagem)}</figcaption>`:""}</figure>`:""}<div class="article-copy">${conteudo}</div><div class="share-buttons"><p>Compartilhe esta notícia</p><a class="btn-share" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?text=${encodeURIComponent(noticia.titulo+" - "+canonical)}">${icons.whatsapp}WhatsApp</a><a class="btn-share" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}">${icons.facebook}Facebook</a><button class="btn-share" id="copy-link" type="button">${icons.copy}<span>Copiar link</span></button></div><section class="related-news" id="related-news" aria-label="Notícias relacionadas"></section></article>`;
    document.getElementById("copy-link").addEventListener("click",async e=>{await navigator.clipboard.writeText(canonical);e.currentTarget.querySelector("span").textContent="Link copiado"});
    const relacionadas=await listarNoticiasRelacionadas(noticia.categoria_nome,noticia.slug);
    if(relacionadas.length)document.getElementById("related-news").innerHTML=`<div class="related-heading"><p class="eyebrow">Mais notícias</p><h2>Continue lendo</h2></div><div class="related-grid">${relacionadas.map(item=>`<a class="related-card" href="${urlNoticia(item.slug)}">${safeImage(item.imagem_url)?`<img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="lazy">`:'<div class="related-placeholder">Eu Amo Urânia</div>'}<div class="related-card-body"><p class="related-meta">${esc(item.categoria_nome||"Notícias")} · ${esc(formatarData(item.publicado_em))}</p><h3>${esc(item.titulo)}</h3><p>${esc(resumo(item).slice(0,105))}${resumo(item).length>105?"…":""}</p><span class="read-more">Ler notícia →</span></div></a>`).join("")}</div>`;
    window.dispatchEvent(new CustomEvent("noticia:renderizada"));
  }catch(error){container.innerHTML='<p class="not-found-message">Notícia não encontrada ou indisponível.</p>'}
}
carregarNoticia();
