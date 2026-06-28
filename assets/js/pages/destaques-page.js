import { getSupabase } from "../services/supabaseClient.js";
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const img=v=>/^https?:\/\//i.test(v||"")?esc(v):"";
async function init(){
 const home=location.pathname==="/"||location.pathname==="/index.html";
 const news=/\/news\/?(?:index\.html)?$/.test(location.pathname);if(!home&&!news)return;
 const {data,error}=await getSupabase().from("noticias").select("titulo,slug,resumo,imagem_url,categoria_nome,publicado_em").eq("status","publicado").eq("destaque",true).order("publicado_em",{ascending:false}).limit(home?3:1);if(error||!data?.length)return;
 const cards=data.map(n=>`<a class="featured-news-card" href="/noticias/${encodeURIComponent(n.slug)}">${img(n.imagem_url)?`<img src="${img(n.imagem_url)}" alt="${esc(n.titulo)}" loading="lazy">`:""}<div><p class="eyebrow">${esc(n.categoria_nome||"Destaque")}</p><h3>${esc(n.titulo)}</h3>${n.resumo?`<p>${esc(n.resumo.slice(0,150))}</p>`:""}<span class="read-more">Ler notícia →</span></div></a>`).join("");
 const section=`<section class="featured-news" aria-labelledby="featured-title"><div class="container"><div class="section-heading"><p class="eyebrow">Em destaque</p><h2 id="featured-title">Notícias que merecem atenção</h2></div><div class="featured-news-grid">${cards}</div></div></section>`;
 const target=home?document.querySelector(".quick-access"):document.querySelector("#news-container");if(target)target.insertAdjacentHTML(home?"afterend":"beforebegin",section);
 if(!document.getElementById("featured-news-style")){const s=document.createElement("style");s.id="featured-news-style";s.textContent='.featured-news{padding:clamp(3rem,6vw,5rem) 0;background:#f7f9f9}.featured-news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem}.featured-news-card{display:flex;flex-direction:column;overflow:hidden;color:inherit;text-decoration:none;background:#fff;border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 12px 30px rgba(7,59,76,.08)}.featured-news-card img{width:100%;height:210px;object-fit:cover}.featured-news-card>div{padding:1.25rem}.featured-news-card h3{margin:.25rem 0 .6rem}.featured-news-card p{color:var(--muted)}@media(max-width:760px){.featured-news-grid{grid-template-columns:1fr}.featured-news-card{display:grid;grid-template-columns:120px 1fr}.featured-news-card img{height:100%}}';document.head.append(s)}
}
init();
