import { definirMeta } from "../utils.js";
import { publicSupabaseConfigured } from "../services/publicDataService.js";
import { DOMAIN, esc, fact, fmtDateTime, gallery, parseJsonList, relatedNews, relatedNewsHtml, safeImage, safeRows, strip } from "./eventos-helpers.js";

const container = document.getElementById("evento-edicao");
const params = new URLSearchParams(location.search);

function getRouteParams() {
  const querySlug = params.get("slug");
  const queryAno = params.get("ano");
  if (querySlug && queryAno) return { slug: querySlug, ano: queryAno };
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts[0] === "eventos" && parts[1] && parts[2]) {
    return { slug: decodeURIComponent(parts[1]), ano: decodeURIComponent(parts[2]) };
  }
  return { slug: querySlug || "", ano: queryAno || "" };
}

const { slug, ano } = getRouteParams();

function htmlList(items, title) {
  const list = parseJsonList(items);
  if (!list.length) return "";
  return `<section class="event-section">
    <div class="event-section-title"><p class="eyebrow">${esc(title)}</p><h2>${esc(title)}</h2></div>
    <div class="event-pill-list">${list.map(item => `<span>${esc(item.nome || item.titulo || item.label || item)}</span>`).join("")}</div>
  </section>`;
}

function sponsors(items) {
  const list = parseJsonList(items);
  if (!list.length) return "";
  return `<section class="event-section">
    <div class="event-section-title"><p class="eyebrow">Apoio</p><h2>Patrocinadores e parceiros</h2></div>
    <div class="event-sponsors">${list.map(item => {
      const logo = safeImage(item.logo || item.imagem || item.url);
      return `<article>${logo ? `<img src="${esc(logo)}" alt="${esc(item.nome || "Patrocinador")}" loading="lazy">` : ""}<strong>${esc(item.nome || item)}</strong></article>`;
    }).join("")}</div>
  </section>`;
}

function jsonLd(evento, edicao) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: edicao.titulo,
    description: edicao.subtitulo || evento.descricao_curta || strip(edicao.programacao_html),
    url: `${DOMAIN}/eventos/${evento.slug}/${edicao.ano}`,
    image: safeImage(edicao.banner_url || edicao.cartaz_url || evento.imagem_capa_url) ? new URL(edicao.banner_url || edicao.cartaz_url || evento.imagem_capa_url, `${DOMAIN}/`).href : undefined,
    startDate: edicao.data_inicio || undefined,
    endDate: edicao.data_fim || undefined,
    eventStatus: edicao.status === "cancelado" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: evento.organizador ? { "@type": "Organization", name: evento.organizador } : undefined,
    location: (edicao.local || evento.local_tradicional) ? { "@type": "Place", name: edicao.local || evento.local_tradicional } : undefined
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

async function init() {
  if (!publicSupabaseConfigured() || !slug || !ano) {
    container.innerHTML = '<p class="not-found-message">Edição não encontrada.</p>';
    return;
  }

  const [evento] = await safeRows("eventos_principais", {
    select: "*",
    slug: `eq.${slug}`,
    ativo: "eq.true",
    limit: "1"
  });

  if (!evento) {
    container.innerHTML = '<p class="not-found-message">Evento não encontrado.</p>';
    return;
  }

  const [edicao] = await safeRows("eventos_edicoes", {
    select: "*",
    evento_id: `eq.${evento.id}`,
    ano: `eq.${ano}`,
    limit: "1"
  });

  if (!edicao) {
    container.innerHTML = '<p class="not-found-message">Edição não encontrada.</p>';
    return;
  }

  const noticias = await relatedNews(evento, 4);
  const image = safeImage(edicao.banner_url || edicao.cartaz_url || evento.imagem_capa_url);
  const canonical = `${DOMAIN}/eventos/${evento.slug}/${edicao.ano}`;
  const seoTitle = `${edicao.titulo || `${evento.nome} ${edicao.ano}`} | Eu Amo Urânia`;
  const seoDescription = edicao.subtitulo || evento.descricao_curta || `Veja programação, atrações e registros da edição ${edicao.ano} de ${evento.nome}.`;

  definirMeta({
    titulo: seoTitle,
    descricao: seoDescription,
    imagem: image,
    url: canonical
  });
  document.head.insertAdjacentHTML("beforeend", jsonLd(evento, edicao));

  container.innerHTML = `
    <article class="event-public-shell">
      <section class="event-public-hero edition">
        <div class="container event-public-hero-grid">
          <div>
            <p class="eyebrow">${esc(evento.nome)} · ${esc(edicao.status)}</p>
            <h1>${esc(edicao.titulo)}</h1>
            <p>${esc(edicao.subtitulo || evento.descricao_curta || "")}</p>
            <div class="event-hero-actions">
              <a class="button button-secondary" href="/eventos/${encodeURIComponent(evento.slug)}">Voltar ao evento</a>
              ${edicao.mapa_url ? `<a class="button button-primary" target="_blank" rel="noopener" href="${esc(edicao.mapa_url)}">Abrir mapa</a>` : ""}
            </div>
          </div>
          ${image ? `<img src="${esc(image)}" alt="${esc(edicao.titulo)}" decoding="async" fetchpriority="high">` : '<div class="event-hero-placeholder">Eu Amo Urânia</div>'}
        </div>
      </section>

      <div class="container event-public-content">
        <section class="event-facts-grid" aria-label="Informações da edição">
          ${fact("Início", fmtDateTime(edicao.data_inicio))}
          ${fact("Fim", edicao.data_fim ? fmtDateTime(edicao.data_fim) : "")}
          ${fact("Local", edicao.local || evento.local_tradicional)}
          ${fact("Público estimado", edicao.publico_estimado ? Number(edicao.publico_estimado).toLocaleString("pt-BR") : "")}
        </section>

        ${edicao.programacao_html ? `<section class="event-section"><div class="event-section-title"><p class="eyebrow">Programação</p><h2>O que acontece nesta edição</h2></div><div class="event-copy">${edicao.programacao_html}</div></section>` : ""}
        ${edicao.atracoes_html ? `<section class="event-section"><div class="event-section-title"><p class="eyebrow">Atrações</p><h2>Destaques confirmados</h2></div><div class="event-copy">${edicao.atracoes_html}</div></section>` : ""}
        ${edicao.cartaz_url ? `<section class="event-section"><div class="event-section-title"><p class="eyebrow">Cartaz oficial</p><h2>Divulgação da edição</h2></div><img class="event-poster" src="${esc(edicao.cartaz_url)}" alt="Cartaz oficial de ${esc(edicao.titulo)}" loading="lazy"></section>` : ""}
        ${gallery(edicao.galeria, "Galeria da edição")}
        ${htmlList(edicao.videos, "Vídeos")}
        ${sponsors(edicao.patrocinadores)}
        ${edicao.resumo_pos_evento_html ? `<section class="event-section"><div class="event-section-title"><p class="eyebrow">Após o evento</p><h2>Resumo da edição</h2></div><div class="event-copy">${edicao.resumo_pos_evento_html}</div></section>` : ""}
        ${relatedNewsHtml(noticias)}
      </div>
    </article>`;
}

init().catch(error => {
  console.error("Edição de evento:", error);
  container.innerHTML = '<p class="not-found-message">Edição não encontrada.</p>';
});
