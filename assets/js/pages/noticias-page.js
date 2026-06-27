import { listarNoticias } from "../services/noticiasService.js";
import { formatarData, textoPuro } from "../utils.js";
import { supabaseConfigurado } from "../services/supabaseClient.js";

const container = document.getElementById("news-container");
const status = document.getElementById("news-status");

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
    container.innerHTML = noticias.map(noticia => `
      <article class="news-item">
        <img src="${noticia.imagem_url || '../assets/Design sem nome (9).png'}" alt="${noticia.titulo}" loading="lazy">
        <div class="content">
          <p class="eyebrow">${noticia.categoria_nome || 'Urânia'} · ${formatarData(noticia.publicado_em)}</p>
          <h2><a href="../news-details.html?slug=${encodeURIComponent(noticia.slug)}">${noticia.titulo}</a></h2>
          <p>${noticia.resumo || textoPuro(noticia.conteudo_html).substring(0, 145)}...</p>
          <a href="../news-details.html?slug=${encodeURIComponent(noticia.slug)}" class="read-more">Ler notícia <span aria-hidden="true">→</span></a>
        </div>
      </article>`).join("");
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar as notícias. Tente novamente mais tarde.";
  }
}
carregarNoticias();
