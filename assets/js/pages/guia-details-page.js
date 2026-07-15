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
  whatsapp:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  share:'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>',
  map:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  star:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6-4.4-4.3 6.1-.9L12 3Z"/></svg>'
};

function instagramUrl(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^https?:\/\//i.test(text)) return safeUrl(text);
  const user = text.replace(/^@/, "").replace(/[^a-z0-9._]/gi, "");
  return user ? `https://instagram.com/${escapeHtml(user)}` : "";
}

function mapsUrl(item) {
  const query = [item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function addStructuredData(item, image, url) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: item.nome,
    image,
    url,
    description: textoPuro(item.descricao || ""),
    address: item.endereco || undefined,
    telephone: item.whatsapp || undefined,
    sameAs: item.instagram ? [instagramUrl(item.instagram)].filter(Boolean) : undefined
  };
  let script = document.getElementById("guide-structured-data");
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "guide-structured-data";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
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
    const absoluteImage = new URL(imagem, location.origin).href;
    definirMeta({
      titulo: `${item.seo_titulo || item.nome} | Guia Eu Amo Urânia`,
      descricao: textoPuro(description).slice(0, 160),
      imagem: absoluteImage,
      url: canonical
    });
    addStructuredData(item, absoluteImage, canonical);
    const insta = instagramUrl(item.instagram);
    const whatsapp = item.whatsapp ? `https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}` : "";
    const mapa = mapsUrl(item);
    const mapaQuery = [item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" ");
    container.innerHTML = `<article class="guide-business" data-guide-id="${escapeHtml(item.id)}">
      <a class="guide-business-back" href="/guia.html"><span aria-hidden="true">←</span> Voltar ao Guia</a>
      <section class="guide-business-hero">
        <div class="guide-business-media"><img src="${imagem}" alt="${escapeHtml(item.nome)}" decoding="async" fetchpriority="high"></div>
        <div class="guide-business-intro">
          <div class="guide-business-badges">
            <span>${escapeHtml(item.categoria_nome || "Comércio local")}</span>
            ${item.recomendado ? `<strong>${icons.star} Recomendado</strong>` : ""}
          </div>
          <p class="eyebrow">Guia comercial de Urânia</p>
          <h1>${escapeHtml(item.nome)}</h1>
          ${item.descricao ? `<p class="guide-business-summary">${escapeHtml(item.descricao)}</p>` : `<p class="guide-business-summary">Empresa cadastrada no Guia do Eu Amo Urânia para facilitar o contato com moradores e visitantes.</p>`}
          <div class="guide-business-actions">
            ${whatsapp ? `<a class="guide-business-action whatsapp" target="_blank" rel="noopener" href="${whatsapp}">${icons.whatsapp}<span>Chamar no WhatsApp</span></a>` : ""}
            ${insta ? `<a class="guide-business-action instagram" target="_blank" rel="noopener" href="${insta}">${icons.instagram}<span>Instagram</span></a>` : ""}
            <button class="guide-business-action secondary" type="button" id="copy-guide-link">${icons.share}<span>Compartilhar</span></button>
          </div>
        </div>
      </section>
      <section class="guide-business-layout">
        <div class="guide-business-main">
          ${item.recomendado ? `<article class="guide-highlight-card">${icons.star}<div><p class="eyebrow">Destaque no Guia</p><h2>Empresa recomendada</h2><p>Este estabelecimento aparece em destaque no Guia do Eu Amo Urânia, facilitando a descoberta por quem procura opções locais.</p></div></article>` : ""}
          <article class="guide-info-card"><p class="eyebrow">Sobre o estabelecimento</p><h2>O que você encontra aqui</h2><p>${escapeHtml(item.descricao || "Informações comerciais cadastradas para ajudar você a conhecer e entrar em contato com esta empresa.")}</p></article>
          <article class="guide-info-card"><p class="eyebrow">Localização</p><h2>Como encontrar</h2>${item.endereco ? `<p>${escapeHtml(item.endereco)}</p>` : "<p>Endereço ainda não informado.</p>"}${mapa ? `<a class="guide-map-link" target="_blank" rel="noopener" href="${mapa}" data-map-query="${escapeHtml(mapaQuery)}" data-map-fallback="${mapa}">${icons.map}<span>Abrir rota no mapa</span></a>` : ""}</article>
        </div>
        <aside class="guide-contact-card" aria-labelledby="guide-contact-title">
          <p class="eyebrow">Contato rápido</p>
          <h2 id="guide-contact-title">Informações úteis</h2>
          <div class="guide-contact-list">
            ${item.endereco ? `<div>${icons.pin}<p><small>Endereço</small>${escapeHtml(item.endereco)}</p></div>` : ""}
            ${item.horario ? `<div>${icons.clock}<p><small>Horário</small>${escapeHtml(item.horario)}</p></div>` : ""}
            ${item.categoria_nome ? `<div>${icons.star}<p><small>Categoria</small>${escapeHtml(item.categoria_nome)}</p></div>` : ""}
          </div>
          <div class="guide-contact-actions">
            ${whatsapp ? `<a class="guide-business-action whatsapp" target="_blank" rel="noopener" href="${whatsapp}">${icons.whatsapp}<span>WhatsApp</span></a>` : ""}
            ${insta ? `<a class="guide-business-action instagram" target="_blank" rel="noopener" href="${insta}">${icons.instagram}<span>Instagram</span></a>` : ""}
            ${mapa ? `<a class="guide-business-action secondary" target="_blank" rel="noopener" href="${mapa}" data-map-query="${escapeHtml(mapaQuery)}" data-map-fallback="${mapa}">${icons.map}<span>Mapa</span></a>` : ""}
          </div>
        </aside>
      </section>
    </article>`;
    document.getElementById("copy-guide-link")?.addEventListener("click", async event => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: `${item.nome} | Guia Eu Amo Urânia`,
            text: item.descricao || `Veja ${item.nome} no Guia Eu Amo Urânia.`,
            url: canonical
          });
          return;
        }
        await navigator.clipboard.writeText(canonical);
        event.currentTarget.querySelector("span").textContent = "Link copiado";
      } catch {
        location.href = `https://wa.me/?text=${encodeURIComponent(`${item.nome} no Guia Eu Amo Urânia: ${canonical}`)}`;
      }
    });
    window.dispatchEvent(new CustomEvent("guia:renderizado", { detail: { id: item.id } }));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar esta empresa.</p>';
  }
}
carregar();
