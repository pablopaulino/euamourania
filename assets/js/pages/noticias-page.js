import { listarNoticias } from "../services/noticiasService.js";
import { formatarData, textoPuro } from "../utils.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";

const container = document.getElementById("news-container");
const status = document.getElementById("news-status");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\.\.\/assets\//.test(value || "") ? escapeHtml(value) : "../assets/Design sem nome (9).png";

async function carregarNoticias() {
  if (!supabaseConfigurado()) {
    status.textContent = "Configure o Supabase para carregar as notícias.";
    return;
  }
  status.textContent = "Carregando notícias…";
  try {
    const noticias = await listarNoticias();
    if (!noticias.length) { status.textContent = "Nenhuma notícia publicada."; return; }
    status.hidden = true;
    container.innerHTML = noticias.map(noticia => {
      const resumo = noticia.resumo || textoPuro(noticia.conteudo_html).substring(0, 145);
      const url = `../news-details.html?slug=${encodeURIComponent(noticia.slug)}`;
      return `<article class="news-item">
        <img src="${safeImage(noticia.imagem_url)}" alt="${escapeHtml(noticia.titulo)}" loading="lazy">
        <div class="content">
          <p class="eyebrow">${escapeHtml(noticia.categoria_nome || "Urânia")} · ${escapeHtml(formatarData(noticia.publicado_em))}</p>
          <h2><a href="${url}">${escapeHtml(noticia.titulo)}</a></h2>
          <p>${escapeHtml(resumo)}...</p>
          <a href="${url}" class="read-more">Ler notícia <span aria-hidden="true">→</span></a>
        </div>
      </article>`;
    }).join("");
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar as notícias. Tente novamente mais tarde.";
  }
}
carregarNoticias();
