import { definirMeta } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("evento-details");
const params = new URLSearchParams(location.search);
const pathParts = location.pathname.split("/").filter(Boolean);
const slug = params.get("slug") || (pathParts[0] === "eventos" && pathParts[1] === "agenda" ? pathParts[2] : "");
const DOMAIN = "https://euamourania.com.br";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const strip = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const safe = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? value : "";
const whatsappNumber = value => String(value || "").replace(/\D/g, "");
const fmtDate = value => value ? new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo"
}).format(new Date(value)) : "Data a confirmar";
const fmtTime = value => value ? new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo"
}).format(new Date(value)) : "";
const recurrenceLabel = value => ({ semanal: "Evento semanal", mensal: "Evento mensal", anual: "Evento anual" })[value] || "";

function eventUrl(evento) {
  return `${DOMAIN}/eventos/agenda/${encodeURIComponent(evento.slug)}`;
}

function mapLink(evento) {
  const target = evento.mapa_url || evento.endereco || evento.local;
  return target ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}` : "";
}

function fact(label, value) {
  if (!value) return "";
  return `<div class="simple-event-fact"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function render(evento) {
  const image = safe(evento.imagem_url);
  const canonical = eventUrl(evento);
  const date = fmtDate(evento.data_inicio);
  const time = fmtTime(evento.data_inicio);
  const recurrence = recurrenceLabel(evento.recorrencia_tipo);
  const maps = mapLink(evento);
  const phone = whatsappNumber(evento.whatsapp);

  definirMeta({
    titulo: `${evento.titulo} | Eu Amo Urânia`,
    descricao: strip(evento.descricao) || "Evento em Urânia",
    imagem: image || "/assets/compartilhamento-logo.png",
    url: canonical
  });

  if (location.pathname.includes("/eventos/detalhes.html")) {
    history.replaceState({}, "", `/eventos/agenda/${encodeURIComponent(evento.slug)}`);
  }

  container.innerHTML = `<article class="simple-event-detail">
    <a class="simple-event-back" href="/eventos/">← Voltar para eventos</a>
    <section class="simple-event-hero">
      <div class="simple-event-media">
        ${image ? `<img src="${esc(image)}" alt="${esc(evento.titulo)}" width="1200" height="675" decoding="async" fetchpriority="high">` : `<div class="simple-event-placeholder">Eu Amo Urânia</div>`}
      </div>
      <div class="simple-event-intro">
        <p class="eyebrow">Agenda de Urânia</p>
        <h1>${esc(evento.titulo)}</h1>
        <p class="simple-event-lead">${esc(strip(evento.descricao) || "Informações do evento disponíveis no Eu Amo Urânia.")}</p>
        <div class="simple-event-chips">
          <span>${esc(date)}${time ? ` · ${esc(time)}` : ""}</span>
          ${recurrence ? `<span>${esc(recurrence)}</span>` : ""}
          ${evento.destaque ? `<span>Destaque</span>` : ""}
        </div>
        <div class="simple-event-actions">
          ${phone ? `<a class="button button-primary" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Vim pelo Eu Amo Urânia e quero saber mais sobre ${evento.titulo}.`)}">Falar com a organização</a>` : ""}
          ${maps ? `<a class="button button-secondary" target="_blank" rel="noopener" href="${maps}">Como chegar</a>` : ""}
          <button class="button button-secondary simple-event-share" type="button">Compartilhar</button>
        </div>
      </div>
    </section>

    <section class="simple-event-content">
      <div class="simple-event-copy">
        <p class="eyebrow">Sobre o evento</p>
        <h2>Informações principais</h2>
        <p>${esc(strip(evento.descricao) || "A programação completa será atualizada em breve.")}</p>
      </div>
      <aside class="simple-event-panel" aria-label="Detalhes do evento">
        ${fact("Data", date)}
        ${fact("Horário", time)}
        ${fact("Local", evento.local)}
        ${fact("Endereço", evento.endereco)}
        ${fact("Organização", evento.organizador)}
        ${fact("Repetição", recurrence)}
      </aside>
    </section>
  </article>`;

  container.querySelector(".simple-event-share")?.addEventListener("click", async () => {
    const shareData = { title: evento.titulo, text: strip(evento.descricao), url: canonical };
    if (navigator.share) {
      try { await navigator.share(shareData); return; } catch {}
    }
    await navigator.clipboard?.writeText(canonical);
    const button = container.querySelector(".simple-event-share");
    if (button) {
      const previous = button.textContent;
      button.textContent = "Link copiado";
      setTimeout(() => { button.textContent = previous; }, 1800);
    }
  });

  window.dispatchEvent(new CustomEvent("evento:renderizado", { detail: { id: evento.id } }));
}

async function init() {
  if (!publicSupabaseConfigured() || !slug) {
    container.innerHTML = '<p class="not-found-message">Evento não encontrado.</p>';
    return;
  }
  try {
    const [evento] = await fetchPublicRows("eventos", { select: "*", slug: `eq.${slug}`, status: "eq.publicado", limit: "1" });
    if (!evento) throw new Error("not-found");
    render(evento);
  } catch (error) {
    console.error("Evento simples:", error);
    container.innerHTML = '<p class="not-found-message">Evento não encontrado.</p>';
  }
}

init();
