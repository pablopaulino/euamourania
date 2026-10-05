import { listarEdicoesPublicas } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { sharePage } from "../services/shareService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const img = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const statusLabel = value => String(value || "").replaceAll("_", " ");
const editionUrl = edition => /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? `/melhores-de-urania/edicao.html?ano=${encodeURIComponent(edition.ano)}`
  : `/melhores-de-urania/${encodeURIComponent(edition.ano)}/`;
const indicationUrl = edition => `${editionUrl(edition)}#indicacoes`;
const votingUrl = edition => /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? `/melhores-de-urania/votacao.html?ano=${encodeURIComponent(edition.ano)}`
  : `${editionUrl(edition)}votacao/`;
const withinPeriod = (start, end) => (!start || Date.now() >= new Date(start).getTime())
  && (!end || Date.now() <= new Date(end).getTime());
const phaseDetails = edition => {
  if (edition.status === "indicacoes_abertas") return {
    label: withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim) ? "Indicações abertas" : "Período de indicações",
    period: `Indicações: ${period(edition.indicacoes_inicio, edition.indicacoes_fim)}`,
    action: withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim) ? "Indicar agora" : "Ver edição",
    href: withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim) ? indicationUrl(edition) : editionUrl(edition)
  };
  if (edition.status === "votacao_aberta") return {
    label: withinPeriod(edition.votacao_inicio, edition.votacao_fim) ? "Votação aberta" : "Período de votação",
    period: `Votação: ${period(edition.votacao_inicio, edition.votacao_fim)}`,
    action: withinPeriod(edition.votacao_inicio, edition.votacao_fim) ? "Votar agora" : "Ver edição",
    href: withinPeriod(edition.votacao_inicio, edition.votacao_fim) ? votingUrl(edition) : editionUrl(edition)
  };
  return { label: statusLabel(edition.status), period: "", action: "Ver edição", href: editionUrl(edition) };
};

function period(start, end) {
  if (!start && !end) return "Período a confirmar";
  const format = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "a confirmar";
  return `${format(start)} — ${format(end)}`;
}

function activeEdition(editions) {
  return editions.find(item => item.status === "indicacoes_abertas" || item.status === "votacao_aberta") || editions[0];
}

function setImageMeta(edition) {
  const image = img(edition?.imagem_capa_url);
  if (!image) return;
  const absolute = new URL(image, location.origin).href;
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", absolute);
  let twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (!twitterImage) {
    twitterImage = document.createElement("meta");
    twitterImage.setAttribute("name", "twitter:image");
    document.head.append(twitterImage);
  }
  twitterImage.setAttribute("content", absolute);
}

function editionCard(edition) {
  const image = img(edition.imagem_capa_url);
  const phase = phaseDetails(edition);
  const indicating = edition.status === "indicacoes_abertas" && withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim);
  return `<article class="awards-edition-card">
    ${image ? `<img src="${image}" alt="${esc(edition.nome)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      ${indicating ? "" : `<span class="awards-chip ${edition.status === "votacao_aberta" ? "open" : ""}">${esc(phase.label)}</span>`}
      <h3>${esc(edition.nome)}</h3>
      <p>${esc(edition.descricao || "Edição oficial da premiação Melhores de Urânia.")}</p>
      ${phase.period ? `<p><small>${esc(phase.period)}</small></p>` : ""}
      <a class="button button-primary" href="${phase.href}" data-awards-cta data-edition-id="${edition.id}">${phase.action}</a>
    </div>
  </article>`;
}

function setupFaqAccordion() {
  const items = [...document.querySelectorAll(".awards-faq-item")];
  if (!items.length) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  const openItem = (item, summary, panel) => {
    item.open = true;
    summary.setAttribute("aria-expanded", "true");
    if (reduceMotion) {
      panel.style.height = "auto";
      return;
    }
    panel.style.height = "0px";
    requestAnimationFrame(() => {
      panel.style.height = `${panel.scrollHeight}px`;
    });
  };

  const closeItem = (item, summary, panel) => {
    summary.setAttribute("aria-expanded", "false");
    if (reduceMotion) {
      panel.style.height = "0px";
      item.open = false;
      return;
    }
    panel.style.height = `${panel.scrollHeight}px`;
    requestAnimationFrame(() => {
      panel.style.height = "0px";
    });
    window.setTimeout(() => {
      if (summary.getAttribute("aria-expanded") === "false") item.open = false;
    }, 320);
  };

  items.forEach((item) => {
    const summary = item.querySelector("summary");
    const panel = item.querySelector(".awards-faq-panel");
    if (!summary || !panel) return;
    summary.setAttribute("role", "button");
    summary.setAttribute("aria-expanded", "false");
    panel.style.height = "0px";

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const isExpanded = summary.getAttribute("aria-expanded") === "true";
      if (isExpanded) closeItem(item, summary, panel);
      else openItem(item, summary, panel);
    });

    panel.addEventListener("transitionend", () => {
      if (summary.getAttribute("aria-expanded") === "true") panel.style.height = "auto";
    });
  });

  window.addEventListener("resize", () => {
    items.filter((item) => item.open).forEach((item) => {
      const panel = item.querySelector(".awards-faq-panel");
      if (!panel) return;
      panel.style.height = "auto";
    });
  }, { passive: true });
}

async function init() {
  setupFaqAccordion();
  try {
    registrarEventoMelhores("melhores_index_view");
    const editions = await listarEdicoesPublicas();
    const list = document.getElementById("awards-editions");
    const hero = document.getElementById("active-edition-card");
    if (!editions.length) {
      if (list) list.innerHTML = '<div class="awards-empty">Nenhuma edição pública no momento.</div>';
      if (hero) hero.innerHTML = '<div class="awards-empty">A próxima edição será anunciada em breve.</div>';
      return;
    }
    const active = activeEdition(editions);
    const activePhase = phaseDetails(active);
    const indicating = active.status === "indicacoes_abertas" && withinPeriod(active.indicacoes_inicio, active.indicacoes_fim);
    const homePrimary = document.getElementById("awards-home-primary");
    if (homePrimary && indicating) {
      homePrimary.href = activePhase.href;
      homePrimary.textContent = "Indicar agora";
    }
    setImageMeta(active);
    if (hero) {
      const image = img(active.imagem_capa_url);
      hero.innerHTML = `${image ? `<img src="${image}" alt="${esc(active.nome)}">` : ""}
        <h2>${esc(active.nome)}</h2>
        <p>${esc(active.descricao || "Acompanhe a edição atual da premiação.")}</p>
        <div class="awards-status-line">
          ${indicating ? "" : `<span class="awards-chip ${active.status === "votacao_aberta" ? "open" : ""}">${esc(activePhase.label)}</span>`}
          ${activePhase.period ? `<span class="awards-chip">${esc(activePhase.period)}</span>` : ""}
        </div>
        <p style="margin-top:1rem" class="hero-actions"><a class="button button-primary" href="${activePhase.href}" data-awards-cta data-edition-id="${active.id}">${activePhase.action}</a><button class="button button-secondary" type="button" data-share-awards-home>Compartilhar</button></p>`;
    }
    if (list) list.innerHTML = editions.map(editionCard).join("");
    document.querySelector("[data-share-awards-home]")?.addEventListener("click", async () => {
      await sharePage({
        title: "Melhores de Urânia | Eu Amo Urânia",
        text: `Acompanhe o ${active.nome}.`,
        url: "/melhores-de-urania/"
      });
      registrarEventoMelhores("melhores_share_click", {
        edicaoId: active.id,
        destino: `${location.origin}/melhores-de-urania/`,
        metadados: { canal: "native", origem: "home_melhores" }
      });
    });
    document.querySelectorAll("[data-awards-cta]").forEach(link => {
      link.addEventListener("click", () => registrarEventoMelhores("melhores_cta_click", {
        edicaoId: link.dataset.editionId || null,
        destino: link.href,
        metadados: { origem_cta: "lista_edicoes" }
      }));
    });
  } catch (error) {
    console.error("Melhores de Urânia:", error);
    document.getElementById("awards-editions").innerHTML = '<div class="awards-empty">Não foi possível carregar as edições agora.</div>';
    document.getElementById("active-edition-card").innerHTML = '<div class="awards-empty">Não foi possível carregar a edição atual agora.</div>';
  }
}

init();
