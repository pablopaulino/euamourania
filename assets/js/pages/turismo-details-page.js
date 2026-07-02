import { definirMeta, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("turismo-details");
const slug = new URLSearchParams(location.search).get("slug");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "";

async function carregar() {
  if (!publicSupabaseConfigured()) { container.innerHTML = '<p class="not-found-message">Configure o Supabase para carregar este ponto turístico.</p>'; return; }
  if (!slug) { container.innerHTML = '<p class="not-found-message">Ponto turístico não encontrado.</p>'; return; }
  try {
    const [item] = await fetchPublicRows("turismo", {
      select: "*",
      slug: `eq.${slug}`,
      status: "eq.publicado",
      limit: "1"
    });
    if (!item || item.status !== "publicado") { container.innerHTML = '<p class="not-found-message">Ponto turístico não encontrado.</p>'; return; }
    definirMeta({
      titulo: `${item.seo_titulo || item.nome} | Eu Amo Urânia`,
      descricao: item.seo_descricao || item.descricao || textoPuro(item.conteudo_html).slice(0, 160),
      imagem: item.imagem_url
    });
    const conteudo = window.DOMPurify
      ? window.DOMPurify.sanitize(item.conteudo_html || `<p>${escapeHtml(item.descricao)}</p>`, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allow", "allowfullscreen", "frameborder"] })
      : `<p>${escapeHtml(textoPuro(item.conteudo_html || item.descricao))}</p>`;
    const imagem = safeUrl(item.imagem_url) || (item.imagem_url?.startsWith("assets/") ? escapeHtml(item.imagem_url) : "");
    container.innerHTML = `<article class="news-detail-container"><p class="eyebrow">Turismo em Urânia</p><h1>${escapeHtml(item.nome)}</h1>${item.descricao ? `<p class="article-subtitle">${escapeHtml(item.descricao)}</p>` : ""}${imagem ? `<img src="${imagem}" alt="${escapeHtml(item.nome)}" class="main-image">` : ""}<div class="article-copy">${conteudo}</div><div class="tourism-info">${item.endereco ? `<p><strong>Endereço:</strong> ${escapeHtml(item.endereco)}</p>` : ""}${item.horario ? `<p><strong>Horário:</strong> ${escapeHtml(item.horario)}</p>` : ""}</div><div class="share-buttons"><p>Planeje sua visita</p>${item.whatsapp ? `<a class="btn-share" target="_blank" rel="noopener" href="https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}">WhatsApp</a>` : ""}${safeUrl(item.mapa_url) ? `<a class="btn-share" target="_blank" rel="noopener" href="${safeUrl(item.mapa_url)}">Abrir mapa</a>` : ""}<a class="btn-share" href="turismo.html">Ver outros lugares</a></div></article>`;
    window.dispatchEvent(new CustomEvent("turismo:renderizado",{detail:{id:item.id}}));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar este ponto turístico.</p>';
  }
}
carregar();
