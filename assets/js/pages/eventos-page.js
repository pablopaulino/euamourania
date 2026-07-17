import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? value : "";
const strip = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const clamp = (value, length = 150) => {
  const text = strip(value);
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
const dateParts = value => {
  if (!value) return { data: "Data a confirmar", hora: "" };
  const date = new Date(value);
  return {
    data: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date),
    hora: new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date)
  };
};

async function safeRows(table, params, options) {
  try { return await fetchPublicRows(table, params, options); }
  catch (error) {
    console.warn(`Eventos 2.0: ${table} indisponível`, error);
    return [];
  }
}

function agendaCard(evento) {
  const quando = dateParts(evento.data_inicio);
  const imagem = safeImage(evento.imagem_url);
  const url = `/eventos/detalhes.html?slug=${encodeURIComponent(evento.slug)}`;
  return `<article class="event-card" data-event-id="${esc(evento.id)}">
    ${imagem ? `<a href="${url}"><img src="${esc(imagem)}" alt="${esc(evento.titulo)}" loading="lazy"></a>` : '<div class="media-placeholder">Eu Amo Urânia</div>'}
    <div class="event-card-body">
      <p class="event-date">${esc(quando.data)}${quando.hora ? ` · ${esc(quando.hora)}` : ""}</p>
      <h3><a href="${url}">${esc(evento.titulo)}</a></h3>
      ${evento.local ? `<p class="event-local"><strong>Local:</strong> ${esc(evento.local)}</p>` : ""}
      <p>${esc(clamp(evento.descricao))}</p>
      <a class="button button-primary" href="${url}">Saiba mais</a>
    </div>
  </article>`;
}

function acervoCard(evento, edicoes = []) {
  const imagem = safeImage(evento.imagem_capa_url);
  const url = `/eventos/${encodeURIComponent(evento.slug)}`;
  const proxima = edicoes.find(item => ["anunciado", "confirmado", "acontecendo"].includes(item.status));
  return `<article class="event-archive-card">
    ${imagem ? `<a href="${url}"><img src="${esc(imagem)}" alt="${esc(evento.nome)}" loading="lazy"></a>` : '<a class="event-archive-placeholder" href="${url}">Eu Amo Urânia</a>'}
    <div>
      <p class="eyebrow">${esc(evento.categoria || "Evento de Urânia")}</p>
      <h3><a href="${url}">${esc(evento.nome)}</a></h3>
      <p>${esc(clamp(evento.descricao_curta || evento.historia_html, 170))}</p>
      <div class="event-facts-row">
        ${evento.recorrencia ? `<span>${esc(evento.recorrencia)}</span>` : ""}
        ${evento.periodo_aproximado ? `<span>${esc(evento.periodo_aproximado)}</span>` : ""}
        ${edicoes.length ? `<span>${edicoes.length} edição(ões)</span>` : ""}
      </div>
      ${proxima ? `<a class="event-mini-link" href="${url}/${proxima.ano}">Próxima edição: ${esc(proxima.ano)}</a>` : `<a class="event-mini-link" href="${url}">Ver histórico do evento</a>`}
    </div>
  </article>`;
}

function renderHomeEvents(eventos, principais, edicoes) {
  if (!(location.pathname === "/" || location.pathname === "/index.html")) return;
  const anchor = document.querySelector(".community");
  if (!anchor) return;
  const proximos = eventos.filter(e => e.destaque).slice(0, 2);
  const destaques = principais.filter(e => e.destaque).slice(0, 2);
  const byEvent = new Map(edicoes.map(item => [item.evento_id, [...(edicoes.filter(e => e.evento_id === item.evento_id))]]));
  const section = document.createElement("section");
  section.className = "events-section";
  section.setAttribute("aria-labelledby", "eventos-home-title");
  section.innerHTML = `<div class="container">
    <div class="section-heading">
      <p class="eyebrow">Agenda e tradição</p>
      <h2 id="eventos-home-title">Eventos de Urânia</h2>
      <p>Programação atual e acervo dos eventos que fazem parte da cidade.</p>
    </div>
    ${[...proximos.map(agendaCard), ...destaques.map(item => acervoCard(item, byEvent.get(item.id) || []))].length ? `<div class="events-grid">${[...proximos.map(agendaCard), ...destaques.map(item => acervoCard(item, byEvent.get(item.id) || []))].slice(0, 3).join("")}</div>` : '<div class="empty-state">Novos eventos serão publicados aqui em breve.</div>'}
    <p style="margin-top:1.5rem"><a class="button button-secondary" href="/eventos/">Ver eventos</a></p>
  </div>`;
  anchor.before(section);
}

async function init() {
  if (!publicSupabaseConfigured()) return;
  const now = new Date();
  const [eventos, principais, edicoes] = await Promise.all([
    safeRows("eventos", { select: "id,titulo,slug,descricao,imagem_url,data_inicio,data_fim,local,destaque", status: "eq.publicado", order: "data_inicio.asc" }),
    safeRows("eventos_principais", { select: "*", ativo: "eq.true", order: "destaque.desc,atualizado_em.desc" }),
    safeRows("eventos_edicoes", { select: "*", order: "ano.desc,data_inicio.desc" })
  ]);
  const ativos = eventos.filter(e => !e.data_fim || new Date(e.data_fim) >= now);
  const edicoesPorEvento = new Map();
  edicoes.forEach(edicao => edicoesPorEvento.set(edicao.evento_id, [...(edicoesPorEvento.get(edicao.evento_id) || []), edicao]));

  const list = document.getElementById("eventos-list");
  if (list) {
    const acervo = principais.map(evento => acervoCard(evento, edicoesPorEvento.get(evento.id) || []));
    list.className = "container eventos-landing";
    list.innerHTML = `
      <section class="eventos-featured">
        <div>
          <p class="eyebrow">Agenda atual</p>
          <h2>Próximos eventos</h2>
        </div>
        ${ativos.length ? `<div class="events-grid">${ativos.slice(0, 6).map(agendaCard).join("")}</div>` : '<div class="empty-state">Nenhum evento com data futura publicado no momento.</div>'}
      </section>
      <section class="eventos-featured">
        <div>
          <p class="eyebrow">Acervo permanente</p>
          <h2>Eventos tradicionais e anuais</h2>
          <p>História, edições, cartazes, programação e registros dos eventos de Urânia.</p>
        </div>
        ${acervo.length ? `<div class="event-archive-grid">${acervo.join("")}</div>` : '<div class="empty-state">Cadastre eventos principais no painel para montar o acervo permanente.</div>'}
      </section>`;
    document.getElementById("eventos-status")?.setAttribute("hidden", "");
  }

  renderHomeEvents(ativos, principais, edicoes);
}

init().catch(error => console.error("Eventos:", error));
