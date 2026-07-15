import { definirMeta, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("guia-details");
const params = new URLSearchParams(location.search);
const pathSlug = location.pathname.match(/^\/guia\/([^/]+)/)?.[1];
const slug = params.get("slug") || (pathSlug ? decodeURIComponent(pathSlug) : "");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "";
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? escapeHtml(value) : "";
const fallbackImage = "/assets/1505 - Urania - Logo Horizontal - 1.png";
const icons = {
  pin:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  instagram:'<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.2"/><path d="M17.3 6.8h.01"/></svg>',
  whatsapp:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>'
};

function instagramUrl(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^https?:\/\//i.test(text)) return safeUrl(text);
  const user = text.replace(/^@/, "").replace(/[^a-z0-9._]/gi, "");
  return user ? `https://instagram.com/${escapeHtml(user)}` : "";
}

async function carregar() {
  if (!publicSupabaseConfigured()) { container.innerHTML = '<p class="not-found-message">Configure o Supabase para carregar esta empresa.</p>'; return; }
  if (!slug) { container.innerHTML = '<p class="not-found-message">Empresa não encontrada.</p>'; return; }
  try {
    const query = /^[0-9a-f-]{20,}$/i.test(slug) ? { id: `eq.${slug}` } : { slug: `eq.${slug}` };
    const [item] = await fetchPublicRows("guia_comercial", {
      select: "*",
      ...query,
      status: "eq.publicado",
      limit: "1"
    });
    if (!item || item.status !== "publicado") { container.innerHTML = '<p class="not-found-message">Empresa não encontrada.</p>'; return; }
    const imagem = safeImage(item.imagem_url) || fallbackImage;
    const canonical = `${location.origin}/guia/${encodeURIComponent(item.slug || slug)}`;
    const description = item.seo_descricao || item.descricao || `${item.nome} no Guia do Eu Amo Urânia.`;
    definirMeta({
      titulo: `${item.seo_titulo || item.nome} | Guia Eu Amo Urânia`,
      descricao: textoPuro(description).slice(0, 160),
      imagem: new URL(imagem, location.origin).href,
      url: canonical
    });
    const insta = instagramUrl(item.instagram);
    const whatsapp = item.whatsapp ? `https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}` : "";
    container.innerHTML = `<article class="tourism-detail guide-detail" data-guide-id="${escapeHtml(item.id)}">
      <a class="tourism-detail-back" href="/guia.html"><span aria-hidden="true">←</span> Voltar ao Guia</a>
      <section class="tourism-detail-hero guide-detail-hero">
        <figure><img src="${imagem}" alt="${escapeHtml(item.nome)}" decoding="async" fetchpriority="high"></figure>
        <header class="tourism-detail-header"><p class="eyebrow">Guia de Urânia</p><h1>${escapeHtml(item.nome)}</h1>${item.descricao ? `<p class="tourism-detail-summary">${escapeHtml(item.descricao)}</p>` : ""}<span class="tourism-detail-label">${escapeHtml(item.categoria_nome || "Comércio local")}</span></header>
      </section>
      <div class="tourism-detail-layout">
        <section class="tourism-detail-copy" aria-labelledby="guide-about-title"><p class="eyebrow">Sobre a empresa</p><h2 id="guide-about-title">Informações do estabelecimento</h2><div class="article-copy"><p>${escapeHtml(item.descricao || "Empresa cadastrada no Guia do Eu Amo Urânia.")}</p></div></section>
        <aside class="tourism-planner" aria-labelledby="guide-contact-title"><p class="eyebrow">Contato e atendimento</p><h2 id="guide-contact-title">Fale com a empresa</h2>
          <div class="tourism-detail-facts">
            ${item.endereco ? `<div>${icons.pin}<p><small>Endereço</small>${escapeHtml(item.endereco)}</p></div>` : ""}
            ${item.horario ? `<div>${icons.clock}<p><small>Horário</small>${escapeHtml(item.horario)}</p></div>` : ""}
          </div>
          <div class="tourism-detail-actions">
            ${whatsapp ? `<a class="tourism-action whatsapp" target="_blank" rel="noopener" href="${whatsapp}">${icons.whatsapp}<span>Chamar no WhatsApp</span></a>` : ""}
            ${insta ? `<a class="tourism-action instagram" target="_blank" rel="noopener" href="${insta}">${icons.instagram}<span>Ver Instagram</span></a>` : ""}
            <a class="tourism-action secondary" href="/guia.html"><span aria-hidden="true">←</span><span>Ver outras empresas</span></a>
          </div>
        </aside>
      </div>
    </article>`;
    window.dispatchEvent(new CustomEvent("guia:renderizado", { detail: { id: item.id } }));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar esta empresa.</p>';
  }
}
carregar();
