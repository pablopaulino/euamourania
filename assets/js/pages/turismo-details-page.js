import { definirMeta, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("turismo-details");
const slug = new URLSearchParams(location.search).get("slug");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "";
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? escapeHtml(value) : "";
const fallbackImage = "assets/AD3A1763-min (1).jpg";
const icons = {
  pin:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  map:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  whatsapp:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>'
};

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
    const imagem = safeImage(item.imagem_url) || fallbackImage;
    definirMeta({
      titulo: `${item.seo_titulo || item.nome} | Eu Amo Urânia`,
      descricao: item.seo_descricao || item.descricao || textoPuro(item.conteudo_html).slice(0, 160),
      imagem: new URL(imagem, location.origin).href
    });
    const conteudo = window.DOMPurify
      ? window.DOMPurify.sanitize(item.conteudo_html || `<p>${escapeHtml(item.descricao)}</p>`, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allow", "allowfullscreen", "frameborder"] })
      : `<p>${escapeHtml(textoPuro(item.conteudo_html || item.descricao))}</p>`;
    const mapUrl = safeUrl(item.mapa_url);
    container.innerHTML = `<article class="tourism-detail" data-tourism-id="${escapeHtml(item.id)}">
      <a class="tourism-detail-back" href="turismo.html"><span aria-hidden="true">←</span> Voltar aos lugares</a>
      <section class="tourism-detail-hero">
        <figure><img src="${imagem}" alt="${escapeHtml(item.nome)}" decoding="async" fetchpriority="high"></figure>
        <header class="tourism-detail-header"><p class="eyebrow">Experiência em Urânia</p><h1>${escapeHtml(item.nome)}</h1>${item.descricao ? `<p class="tourism-detail-summary">${escapeHtml(item.descricao)}</p>` : ""}<span class="tourism-detail-label">Turismo local</span></header>
      </section>
      <div class="tourism-detail-layout">
        <section class="tourism-detail-copy" aria-labelledby="tourism-about-title"><p class="eyebrow">Sobre a experiência</p><h2 id="tourism-about-title">Conheça este lugar</h2><div class="article-copy">${conteudo}</div></section>
        <aside class="tourism-planner" aria-labelledby="tourism-planner-title"><p class="eyebrow">Informações úteis</p><h2 id="tourism-planner-title">Planeje sua visita</h2>
          <div class="tourism-detail-facts">
            ${item.endereco ? `<div>${icons.pin}<p><small>Endereço</small>${escapeHtml(item.endereco)}</p></div>` : ""}
            ${item.horario ? `<div>${icons.clock}<p><small>Horário</small>${escapeHtml(item.horario)}</p></div>` : ""}
          </div>
          <div class="tourism-detail-actions">
            ${mapUrl ? `<a class="tourism-action primary" target="_blank" rel="noopener" href="${mapUrl}">${icons.map}<span>Abrir no mapa</span></a>` : ""}
            ${item.whatsapp ? `<a class="tourism-action whatsapp" target="_blank" rel="noopener" href="https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}">${icons.whatsapp}<span>Falar pelo WhatsApp</span></a>` : ""}
            <a class="tourism-action secondary" href="turismo.html"><span aria-hidden="true">←</span><span>Ver outros lugares</span></a>
          </div>
        </aside>
      </div>
    </article>`;
    window.dispatchEvent(new CustomEvent("turismo:renderizado",{detail:{id:item.id}}));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar este ponto turístico.</p>';
  }
}
carregar();
