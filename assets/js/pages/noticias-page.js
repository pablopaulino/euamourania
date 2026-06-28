import { listarNoticias } from "../services/noticiasService.js";
import { formatarData, textoPuro } from "../utils.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";
const container=document.getElementById("news-container"),status=document.getElementById("news-status");
const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const safeImage=v=>/^https?:\/\//i.test(v||"")?esc(v):"../assets/Design sem nome (9).png";
async function carregarNoticias(){if(!supabaseConfigurado()){status.textContent="Configure o Supabase para carregar as notícias.";return}try{const noticias=await listarNoticias();if(!noticias.length){status.textContent="Nenhuma notícia publicada.";return}status.hidden=true;container.innerHTML=noticias.map(n=>{const resumo=n.resumo||textoPuro(n.conteudo_html).slice(0,145),url=`/noticias/${encodeURIComponent(n.slug)}`;return `<article class="news-item"><img src="${safeImage(n.imagem_url)}" alt="${esc(n.titulo)}" loading="lazy"><div class="content"><p class="eyebrow">${esc(n.categoria_nome||"Urânia")} · ${esc(formatarData(n.publicado_em))}</p><h2><a href="${url}">${esc(n.titulo)}</a></h2><p>${esc(resumo)}${resumo.length>=145?"…":""}</p><a href="${url}" class="read-more">Ler notícia <span aria-hidden="true">→</span></a></div></article>`}).join("")}catch(error){console.error(error);status.textContent="Não foi possível carregar as notícias. Tente novamente mais tarde."}}
carregarNoticias();
