import { definirMeta } from "../utils.js";
import { publicSupabaseConfigured } from "../services/publicDataService.js";
import { DOMAIN, clamp, editionCard, esc, fact, fmtDate, gallery, relatedNews, relatedNewsHtml, safeImage, safeRows, strip } from "./eventos-helpers.js";

const container = document.getElementById("evento-principal");

function getEventSlug() {
  const querySlug = new URLSearchParams(location.search).get("slug");
  if (querySlug) return querySlug;
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[0] === "eventos" && parts[1] && !["index.html", "evento.html", "edicao.html", "detalhes.html"].includes(parts[1])
    ? decodeURIComponent(parts[1])
    : "";
}

const slug = getEventSlug();

function statusEdition(edicoes) {
  const now = Date.now();
  return edicoes
    .filter(item => item.status !== "cancelado")
    .sort((a, b) => {
      const da = a.data_inicio ? new Date(a.data_inicio).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.data_inicio ? new Date(b.data_inicio).getTime() : Number.MAX_SAFE_INTEGER;
      return Math.abs(da - now) - Math.abs(db - now);
    })[0];
}

function jsonLd(evento, proxima) {
  const data = {
    "@context": "https://schema.org",
    "@type": proxima ? "Event" : "WebPage",
    name: proxima?.titulo || evento.nome,
    description: evento.seo_descricao || evento.descricao_curta || strip(evento.historia_html),
    url: `${DOMAIN}/eventos/${evento.slug}`,
    image: safeImage(evento.imagem_capa_url) ? new URL(evento.imagem_capa_url, `${DOMAIN}/`).href : undefined,
    organizer: evento.organizador ? { "@type": "Organization", name: evento.organizador } : undefined,
    location: (proxima?.local || evento.local_tradicional) ? { "@type": "Place", name: proxima?.local || evento.local_tradicional } : undefined,
    startDate: proxima?.data_inicio || undefined,
    endDate: proxima?.data_fim || undefined
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

async function init() {
  if (!publicSupabaseConfigured() || !slug) {
    container.innerHTML = '<p class="not-found-message">Evento não encontrado.</p>';
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

  const [edicoes, noticias] = await Promise.all([
    safeRows("eventos_edicoes", { select: "*", evento_id: `eq.${evento.id}`, order: "ano.desc,data_inicio.desc" }),
    relatedNews(evento, 4)
  ]);

  const proxima = statusEdition(edicoes);
  const heroImage = safeImage(evento.imagem_capa_url);
  const canonical = `${DOMAIN}/eventos/${evento.slug}`;

  definirMeta({
    titulo: evento.seo_titulo || `${evento.nome} | Eventos em Urânia`,
    descricao: evento.seo_descricao || evento.descricao_curta || `História, edições e informações sobre ${evento.nome} em Urânia.`,
    imagem: heroImage,
    url: canonical
  });
  document.head.insertAdjacentHTML("beforeend", jsonLd(evento, proxima));

  container.innerHTML = `
    <article class="event-public-shell">
      <section class="event-public-hero">
        <div class="container event-public-hero-grid">
          <div>
            <p class="eyebrow">${esc(evento.categoria || "Evento tradicional de Urânia")}</p>
            <h1>${esc(evento.nome)}</h1>
            <p>${esc(evento.descricao_curta || clamp(evento.historia_html, 220))}</p>
            <div class="event-hero-actions">
              ${proxima ? `<a class="button button-primary" href="/eventos/${encodeURIComponent(evento.slug)}/${proxima.ano}">Ver edição ${esc(proxima.ano)}</a>` : ""}
              <a class="button button-secondary" href="#edicoes">Ver edições</a>
            </div>
          </div>
          ${heroImage ? `<img src="${esc(heroImage)}" alt="${esc(evento.nome)}" decoding="async" fetchpriority="high">` : '<div class="event-hero-placeholder">Eu Amo Urânia</div>'}
        </div>
      </section>

      <div class="container event-public-content">
        <section class="event-facts-grid" aria-label="Informações principais do evento">
          ${fact("Recorrência", evento.recorrencia)}
          ${fact("Período", evento.periodo_aproximado)}
          ${fact("Local tradicional", evento.local_tradicional)}
          ${fact("Organização", evento.organizador)}
        </section>

        <section class="event-section">
          <div class="event-section-title">
            <p class="eyebrow">Sobre o evento</p>
            <h2>História e importância</h2>
          </div>
          <div class="event-copy">
            ${evento.historia_html || `<p>${esc(evento.descricao_curta || "As informações históricas deste evento serão atualizadas em breve.")}</p>`}
          </div>
        </section>

        ${proxima ? `<section class="event-next-edition">
          <div>
            <p class="eyebrow">Próxima edição</p>
            <h2>${esc(proxima.titulo)}</h2>
            <p>${esc(proxima.subtitulo || `${fmtDate(proxima.data_inicio)}${proxima.local ? ` · ${proxima.local}` : ""}`)}</p>
          </div>
          <a class="button button-primary" href="/eventos/${encodeURIComponent(evento.slug)}/${proxima.ano}">Abrir edição</a>
        </section>` : ""}

        <section id="edicoes" class="event-section">
          <div class="event-section-title">
            <p class="eyebrow">Histórico</p>
            <h2>Edições do evento</h2>
          </div>
          ${edicoes.length ? `<div class="event-editions-grid">${edicoes.map(item => editionCard(evento, item)).join("")}</div>` : '<div class="empty-state">As edições deste evento ainda serão cadastradas.</div>'}
        </section>

        ${gallery(evento.galeria_historica, "Galeria histórica")}
        ${relatedNewsHtml(noticias)}
      </div>
    </article>`;
}

init().catch(error => {
  console.error("Evento principal:", error);
  container.innerHTML = '<p class="not-found-message">Evento não encontrado.</p>';
});
