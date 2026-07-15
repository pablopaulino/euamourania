import { definirMeta, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("turismo-details");
const slug = new URLSearchParams(location.search).get("slug");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "";
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? escapeHtml(value) : "";
const fallbackImage = "assets/AD3A1763-min (1).jpg";
const today = () => new Date().toISOString();
const icons = {
  pin:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  map:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  whatsapp:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>'
};

const truncate = (value = "", size = 105) => {
  const text = textoPuro(value || "");
  return text.length > size ? `${text.slice(0, size).trim()}…` : text;
};

const dateLabel = value => {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  } catch {
    return "";
  }
};

function relationSection({ eyebrow, title, text, items, className = "" }) {
  if (!items?.length) return "";
  return `<section class="tourism-related-section ${className}" aria-label="${escapeHtml(title)}">
    <div class="tourism-related-heading">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(title)}</h2>
      ${text ? `<p>${escapeHtml(text)}</p>` : ""}
    </div>
    <div class="tourism-related-grid">${items.join("")}</div>
  </section>`;
}

function companyCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="tourism-related-card compact" href="/guia/${encodeURIComponent(item.slug || item.id)}">
    ${image ? `<img src="${image}" alt="${escapeHtml(item.nome)}" loading="lazy" decoding="async">` : `<div class="tourism-related-placeholder">Guia</div>`}
    <div><small>${escapeHtml(item.categoria_nome || "Guia")}</small><h3>${escapeHtml(item.nome)}</h3><p>${escapeHtml(truncate(item.descricao || item.endereco))}</p><span>Ver empresa →</span></div>
  </a>`;
}

function tourismCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="tourism-related-card compact" href="/turismo-details.html?slug=${encodeURIComponent(item.slug)}">
    ${image ? `<img src="${image}" alt="${escapeHtml(item.nome)}" loading="lazy" decoding="async">` : `<div class="tourism-related-placeholder">Turismo</div>`}
    <div><small>Turismo local</small><h3>${escapeHtml(item.nome)}</h3><p>${escapeHtml(truncate(item.descricao))}</p><span>Conhecer lugar →</span></div>
  </a>`;
}

function newsCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="tourism-related-card" href="/noticias/${encodeURIComponent(item.slug)}">
    ${image ? `<img src="${image}" alt="${escapeHtml(item.titulo)}" loading="lazy" decoding="async">` : `<div class="tourism-related-placeholder">Notícia</div>`}
    <div><small>${escapeHtml(item.categoria_nome || "Notícias")}${item.publicado_em ? ` · ${escapeHtml(dateLabel(item.publicado_em))}` : ""}</small><h3>${escapeHtml(item.titulo)}</h3><p>${escapeHtml(truncate(item.resumo || item.conteudo_html))}</p><span>Ler notícia →</span></div>
  </a>`;
}

async function relatedBlocks(item) {
  const [food, stay, attractions, news] = await Promise.all([
    fetchPublicRows("guia_comercial", { select: "id,nome,slug,descricao,imagem_url,categoria_nome,endereco", status: "eq.publicado", or: "(categoria_nome.ilike.*aliment*,categoria_nome.ilike.*restaurante*,categoria_nome.ilike.*pizz*,categoria_nome.ilike.*lanche*,categoria_nome.ilike.*bar*,nome.ilike.*restaurante*,nome.ilike.*pizz*)", order: "recomendado.desc,nome.asc", limit: "3" }, { ttl: 180000 }).catch(() => []),
    fetchPublicRows("guia_comercial", { select: "id,nome,slug,descricao,imagem_url,categoria_nome,endereco", status: "eq.publicado", or: "(categoria_nome.ilike.*hotel*,categoria_nome.ilike.*hosped*,categoria_nome.ilike.*pousada*,nome.ilike.*hotel*,nome.ilike.*pousada*)", order: "recomendado.desc,nome.asc", limit: "3" }, { ttl: 180000 }).catch(() => []),
    fetchPublicRows("turismo", { select: "id,nome,slug,descricao,imagem_url", status: "eq.publicado", id: `neq.${item.id}`, order: "destaque.desc,nome.asc", limit: "3" }, { ttl: 180000 }).catch(() => []),
    fetchPublicRows("noticias", { select: "id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em", status: "eq.publicado", publicado_em: `lte.${today()}`, order: "publicado_em.desc", limit: "3" }, { ttl: 180000 }).catch(() => [])
  ]);
  return [
    relationSection({ eyebrow: "Guia da cidade", title: "Onde comer por perto", text: "Empresas do guia para complementar o passeio.", items: food.map(companyCard) }),
    relationSection({ eyebrow: "Planeje sua visita", title: "Onde se hospedar", text: "Opções cadastradas no Guia quando houver hospedagens disponíveis.", items: stay.map(companyCard) }),
    relationSection({ eyebrow: "Continue explorando", title: "Outros atrativos", text: "Mais lugares para conhecer em Urânia.", items: attractions.map(tourismCard) }),
    relationSection({ eyebrow: "Informação local", title: "Notícias relacionadas à cidade", text: "Acompanhe também as novidades de Urânia.", items: news.map(newsCard) })
  ].join("");
}

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
    const mapQuery = [item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" ");
    const relacionamentos = await relatedBlocks(item);
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
            ${mapUrl ? `<a class="tourism-action primary" target="_blank" rel="noopener" href="${mapUrl}" data-map-query="${escapeHtml(mapQuery)}" data-map-fallback="${mapUrl}">${icons.map}<span>Abrir no mapa</span></a>` : ""}
            ${item.whatsapp ? `<a class="tourism-action whatsapp" target="_blank" rel="noopener" href="https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}">${icons.whatsapp}<span>Falar pelo WhatsApp</span></a>` : ""}
            <a class="tourism-action secondary" href="turismo.html"><span aria-hidden="true">←</span><span>Ver outros lugares</span></a>
          </div>
        </aside>
      </div>
      ${relacionamentos ? `<section class="tourism-related-area">${relacionamentos}</section>` : ""}
    </article>`;
    window.dispatchEvent(new CustomEvent("turismo:renderizado",{detail:{id:item.id}}));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar este ponto turístico.</p>';
  }
}
carregar();
