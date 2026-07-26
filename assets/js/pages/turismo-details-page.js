import { definirMeta, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";
import { sanitizeArticleHtml } from "../security/sanitize-html.js";

const container = document.getElementById("turismo-details");
const pathParts = location.pathname.split("/").filter(Boolean);
const slug = new URLSearchParams(location.search).get("slug") || (pathParts[0] === "turismo" ? decodeURIComponent(pathParts.at(-1) || "") : "");

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const safeUrl = value => /^https?:\/\//i.test(value || "") ? escapeHtml(value) : "";
const safeImage = value => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return escapeHtml(raw);
  if (/^\/?assets\//i.test(raw)) return escapeHtml(raw.startsWith("/") ? raw : `/${raw}`);
  return "";
};

const fallbackImage = "/assets/AD3A1763-min (1).jpg";
const today = () => new Date().toISOString();

const icons = {
  pin: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  map: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>',
  whatsapp: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z"/><path d="M9 8.5c.5 2.5 2 4 4.5 5"/></svg>',
  share: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/></svg>',
  spark: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 9.8 8.8 4 11l5.8 2.2L12 19l2.2-5.8L20 11l-5.8-2.2L12 3Z"/></svg>',
  route: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 19c4-8 10-6 14-14"/><path d="M7 5H4v3M17 19h3v-3"/></svg>'
};

const truncate = (value = "", size = 105) => {
  const text = textoPuro(value || "");
  return text.length > size ? `${text.slice(0, size).trim()}…` : text;
};

const firstLine = value => textoPuro(value || "").split(/[,\n]/).map(item => item.trim()).filter(Boolean)[0] || "";

const dateLabel = value => {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  } catch {
    return "";
  }
};

function quickFacts(item) {
  const facts = [
    item.endereco ? { icon: icons.pin, label: firstLine(item.endereco) || "Urânia/SP" } : null,
    item.horario ? { icon: icons.clock, label: item.horario } : null,
    item.destaque ? { icon: icons.spark, label: "Destaque local" } : null
  ].filter(Boolean).slice(0, 4);

  return facts.length ? `<div class="tourism-quick-facts" aria-label="Informações rápidas">${facts.map(fact => `<span>${fact.icon}<span>${escapeHtml(fact.label)}</span></span>`).join("")}</div>` : "";
}

function galleryImages(item, mainImage) {
  const raw = Array.isArray(item.galeria_urls) ? item.galeria_urls : [];
  return raw
    .map(value => safeImage(typeof value === "string" ? value : value?.url || value?.imagem_url))
    .filter(Boolean)
    .filter((url, index, list) => url !== mainImage && list.indexOf(url) === index)
    .slice(0, 8);
}

function gallerySection(item, mainImage) {
  const images = galleryImages(item, mainImage);
  if (!images.length) return "";

  return `<section class="tourism-gallery" aria-labelledby="tourism-gallery-title">
    <div class="tourism-section-title">
      <p class="eyebrow">Galeria</p>
      <h2 id="tourism-gallery-title">Registros do local</h2>
    </div>
    <div class="tourism-gallery-grid">
      ${images.map((image, index) => `<button class="tourism-gallery-item" type="button" data-gallery-index="${index}" aria-label="Ampliar foto ${index + 1} de ${escapeHtml(item.nome)}"><img src="${image}" alt="${escapeHtml(`${item.nome} - foto ${index + 1}`)}" loading="lazy" decoding="async"></button>`).join("")}
    </div>
  </section>`;
}

function plannerRow(icon, label, value) {
  return value ? `<div class="tourism-planner-row">${icon}<p><small>${escapeHtml(label)}</small>${escapeHtml(value)}</p></div>` : "";
}

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
    <div><small>${escapeHtml(item.categoria_nome || "Guia")}</small><h3>${escapeHtml(item.nome)}</h3><p>${escapeHtml(truncate(item.descricao || item.endereco, 92))}</p>${item.endereco ? `<em>${icons.pin}${escapeHtml(firstLine(item.endereco))}</em>` : ""}<span>Ver empresa</span></div>
  </a>`;
}

function tourismCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="tourism-related-card compact" href="/turismo/${encodeURIComponent(item.slug)}">
    ${image ? `<img src="${image}" alt="${escapeHtml(item.nome)}" loading="lazy" decoding="async">` : `<div class="tourism-related-placeholder">Turismo</div>`}
    <div><small>Turismo em Urânia</small><h3>${escapeHtml(item.nome)}</h3><p>${escapeHtml(truncate(item.descricao, 92))}</p><span>Conhecer lugar</span></div>
  </a>`;
}

function newsCard(item) {
  const image = safeImage(item.imagem_url);
  return `<a class="tourism-related-card" href="/noticias/${encodeURIComponent(item.slug)}">
    ${image ? `<img src="${image}" alt="${escapeHtml(item.titulo)}" loading="lazy" decoding="async">` : `<div class="tourism-related-placeholder">Notícia</div>`}
    <div><small>${escapeHtml(item.categoria_nome || "Notícias")}${item.publicado_em ? ` · ${escapeHtml(dateLabel(item.publicado_em))}` : ""}</small><h3>${escapeHtml(item.titulo)}</h3><p>${escapeHtml(truncate(item.resumo || item.conteudo_html, 92))}</p><span>Ler notícia</span></div>
  </a>`;
}

function readInitialTourism() {
  const node = document.getElementById("initial-tourism-data");
  if (!node?.textContent) return null;
  try {
    return JSON.parse(node.textContent);
  } catch {
    return null;
  }
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
  if (!publicSupabaseConfigured()) {
    container.innerHTML = '<p class="not-found-message">Configure o Supabase para carregar este ponto turístico.</p>';
    return;
  }
  if (!slug) {
    container.innerHTML = '<p class="not-found-message">Ponto turístico não encontrado.</p>';
    return;
  }

  try {
    let item = readInitialTourism();
    if (!item) {
      [item] = await fetchPublicRows("turismo", {
        select: "*",
        slug: `eq.${slug}`,
        status: "eq.publicado",
        limit: "1"
      });
    }

    if (!item || item.status !== "publicado") {
      container.innerHTML = '<p class="not-found-message">Ponto turístico não encontrado.</p>';
      return;
    }

    const imagem = safeImage(item.imagem_url) || fallbackImage;
    definirMeta({
      titulo: `${item.seo_titulo || item.nome} | Eu Amo Urânia`,
      descricao: item.seo_descricao || item.descricao || textoPuro(item.conteudo_html).slice(0, 160),
      imagem: new URL(imagem, location.origin).href
    });

    const conteudo = sanitizeArticleHtml(item.conteudo_html || `<p>${escapeHtml(item.descricao)}</p>`);
    const mapUrl = safeUrl(item.mapa_url);
    const mapQuery = [item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" ");
    const galeria = gallerySection(item, imagem);
    const relacionamentos = await relatedBlocks(item);

    container.innerHTML = `<article class="tourism-detail" data-tourism-id="${escapeHtml(item.id)}">
      <a class="tourism-detail-back" href="/turismo.html"><span aria-hidden="true">←</span> Voltar aos lugares</a>
      <section class="tourism-detail-hero">
        <figure><img src="${imagem}" alt="${escapeHtml(item.nome)}" decoding="async" fetchpriority="high"></figure>
        <header class="tourism-detail-header"><p class="eyebrow">Experiência em Urânia</p><h1>${escapeHtml(item.nome)}</h1>${item.descricao ? `<p class="tourism-detail-summary">${escapeHtml(item.descricao)}</p>` : ""}${quickFacts(item)}<span class="tourism-detail-label">Turismo local</span></header>
      </section>
      <div class="tourism-detail-layout">
        <section class="tourism-detail-copy" aria-labelledby="tourism-about-title"><p class="eyebrow">Sobre a experiência</p><h2 id="tourism-about-title">Conheça este lugar</h2><div class="article-copy">${conteudo}</div>${galeria}</section>
        <aside class="tourism-planner" aria-labelledby="tourism-planner-title"><p class="eyebrow">Informações úteis</p><h2 id="tourism-planner-title">Planeje sua visita</h2>
          <div class="tourism-detail-facts">
            ${plannerRow(icons.pin, "Endereço", item.endereco)}
            ${plannerRow(icons.clock, "Horário", item.horario)}
            ${mapUrl ? plannerRow(icons.route, "Localização", "Rota disponível no mapa") : ""}
          </div>
          <div class="tourism-detail-actions">
            ${mapUrl ? `<a class="tourism-action primary" target="_blank" rel="noopener" href="${mapUrl}" data-map-query="${escapeHtml(mapQuery)}" data-map-fallback="${mapUrl}">${icons.map}<span>Abrir no mapa</span></a>` : ""}
            ${item.whatsapp ? `<a class="tourism-action whatsapp" target="_blank" rel="noopener" href="https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}">${icons.whatsapp}<span>Falar pelo WhatsApp</span></a>` : ""}
            <button class="tourism-action share" type="button" data-share-tourism data-share-title="${escapeHtml(item.nome)}" data-share-text="${escapeHtml(item.descricao || `Conheça ${item.nome} em Urânia.`)}">${icons.share}<span>Compartilhar lugar</span></button>
            <a class="tourism-action secondary" href="/turismo.html"><span aria-hidden="true">←</span><span>Ver outros lugares</span></a>
          </div>
        </aside>
      </div>
      ${relacionamentos ? `<section class="tourism-related-area">${relacionamentos}</section>` : ""}
      <div class="tourism-lightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" hidden><button type="button" class="tourism-lightbox-close" aria-label="Fechar galeria">×</button><img alt=""></div>
    </article>`;

    window.dispatchEvent(new CustomEvent("turismo:renderizado", { detail: { id: item.id } }));
  } catch (error) {
    console.error(error);
    container.innerHTML = '<p class="not-found-message">Não foi possível carregar este ponto turístico.</p>';
  }
}

carregar();

container.addEventListener("click", async event => {
  const galleryButton = event.target.closest("[data-gallery-index]");
  if (galleryButton) {
    const lightbox = container.querySelector(".tourism-lightbox");
    const image = galleryButton.querySelector("img");
    const target = lightbox?.querySelector("img");
    if (lightbox && image && target) {
      target.src = image.src;
      target.alt = image.alt;
      lightbox.hidden = false;
      lightbox.querySelector("button")?.focus();
    }
    return;
  }

  if (event.target.closest(".tourism-lightbox-close") || event.target.classList.contains("tourism-lightbox")) {
    const lightbox = container.querySelector(".tourism-lightbox");
    if (lightbox) lightbox.hidden = true;
    return;
  }

  const button = event.target.closest("[data-share-tourism]");
  if (!button) return;

  const label = button.querySelector("span");
  const originalText = label?.textContent || "Compartilhar lugar";
  const shareData = {
    title: `${button.dataset.shareTitle || "Turismo"} | Eu Amo Urânia`,
    text: button.dataset.shareText || "Conheça este lugar em Urânia.",
    url: window.location.href
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(shareData.url);
    if (label) {
      label.textContent = "Link copiado";
      setTimeout(() => {
        label.textContent = originalText;
      }, 1800);
    }
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error("Não foi possível compartilhar o local:", error);
    }
  }
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  const lightbox = container.querySelector(".tourism-lightbox:not([hidden])");
  if (lightbox) lightbox.hidden = true;
});
