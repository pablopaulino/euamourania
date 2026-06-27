import { buscarNoticiaPorSlug, listarNoticiasRelacionadas } from "../services/noticiasService.js";
import { definirMeta, formatarData, textoPuro } from "../utils.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";

const container = document.getElementById("newsDetails");
const params = new URLSearchParams(location.search || location.hash.slice(1));
const slug = params.get("slug");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));

async function carregarNoticia() {
  if (!supabaseConfigurado()) { container.innerHTML = '<p class="not-found-message">Configure o Supabase para carregar esta notícia.</p>'; return; }
  if (!slug) { container.innerHTML = '<p class="not-found-message">Notícia não encontrada.</p>'; return; }
  try {
    const noticia = await buscarNoticiaPorSlug(slug);
    if (!noticia || noticia.status !== "publicado") { container.innerHTML = '<p class="not-found-message">Notícia não encontrada.</p>'; return; }
    definirMeta({
      titulo: `${noticia.seo_titulo || noticia.titulo} | Eu Amo Urânia`,
      descricao: noticia.seo_descricao || noticia.resumo || textoPuro(noticia.conteudo_html).substring(0, 160),
      imagem: noticia.seo_imagem || noticia.imagem_url
    });
    const conteudoSeguro = window.DOMPurify
      ? window.DOMPurify.sanitize(noticia.conteudo_html, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allow", "allowfullscreen", "frameborder"] })
      : `<p>${escapeHtml(textoPuro(noticia.conteudo_html))}</p>`;
    const titulo = escapeHtml(noticia.titulo);
    const imagem = escapeHtml(noticia.imagem_url);
    const legenda = escapeHtml(noticia.legenda_imagem || noticia.titulo);
    container.innerHTML = `<article class="news-detail-container">
      <p class="eyebrow">${escapeHtml(noticia.categoria_nome || "Notícias de Urânia")}</p>
      <h1>${titulo}</h1>
      ${noticia.subtitulo ? `<p class="article-subtitle">${escapeHtml(noticia.subtitulo)}</p>` : ""}
      <p class="meta">${escapeHtml(noticia.autor)} · ${escapeHtml(formatarData(noticia.publicado_em))}</p>
      ${noticia.imagem_url ? `<figure><img src="${imagem}" alt="${legenda}" class="main-image">${noticia.legenda_imagem ? `<figcaption>${escapeHtml(noticia.legenda_imagem)}</figcaption>` : ""}</figure>` : ""}
      <div class="article-copy">${conteudoSeguro}</div>
      <div class="share-buttons"><p>Compartilhe esta notícia</p><a class="btn-share" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?text=${encodeURIComponent(noticia.titulo + " - " + location.href)}">WhatsApp</a><a class="btn-share" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}">Facebook</a><button class="btn-share" id="copy-link" type="button">Copiar link</button></div>
      <section class="related-news" id="related-news" aria-label="Notícias relacionadas"></section>
    </article>`;
    document.getElementById("copy-link").addEventListener("click", async event => { await navigator.clipboard.writeText(location.href); event.currentTarget.textContent = "Link copiado"; });
    const relacionadas = await listarNoticiasRelacionadas(noticia.categoria_nome, noticia.slug);
    if (relacionadas.length) document.getElementById("related-news").innerHTML = `<h2>Continue lendo</h2><div class="related-grid">${relacionadas.map(item => `<a href="?slug=${encodeURIComponent(item.slug)}"><strong>${escapeHtml(item.titulo)}</strong><span>Ler notícia →</span></a>`).join("")}</div>`;
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar a notícia.</p>';
  }
}
carregarNoticia();
