import { awardPath, awardLocal } from "../melhoresRoutes.mjs";
import { edicaoEmDestaque, listarEdicoesPublicas, consultarPeriodoVotacao, listarResultadosPublicos, mencaoPublica, winnerProfileUrl, resultsPageUrl as resultsUrl } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { sharePage } from "../services/shareService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const img = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const statusLabel = value => ({
  indicacoes_encerradas: "Indicações encerradas",
  votacao_encerrada: "Votação encerrada",
  apuracao: "Apuração"
}[value] || String(value || "").replaceAll("_", " "));
const editionUrl = edition => awardPath("edition", { year: edition.ano, local: awardLocal() });
const indicationUrl = edition => `${editionUrl(edition)}#indicacoes`;
const votingUrl = edition => awardPath("voting", { year: edition.ano, local: awardLocal() });
let clock = null;
const serverNow = () => clock ? clock.time + (performance.now() - clock.received) : 0;
const withinPeriod = (start, end) => (!start || serverNow() >= new Date(start).getTime())
  && (!end || serverNow() <= new Date(end).getTime());
const phaseDetails = edition => {
  if (edition.status === "indicacoes_abertas") return {
    label: withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim) ? "Indicações abertas" : "Período de indicações",
    period: `Indicações: ${period(edition.indicacoes_inicio, edition.indicacoes_fim)}`,
    action: withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim) ? "Indicar agora" : "Ver edição",
    href: withinPeriod(edition.indicacoes_inicio, edition.indicacoes_fim) ? indicationUrl(edition) : editionUrl(edition)
  };
  if (edition.status === "votacao_aberta") return {
    label: edition.votacao_inicio_site && withinPeriod(edition.votacao_inicio_site, edition.votacao_fim) ? "Votação no site aberta" : "Votação no aplicativo",
    period: `Site: ${period(edition.votacao_inicio_site, edition.votacao_fim)}`,
    action: edition.votacao_inicio_site && withinPeriod(edition.votacao_inicio_site, edition.votacao_fim) ? "Votar agora" : "Ver edição",
    href: edition.votacao_inicio_site && withinPeriod(edition.votacao_inicio_site, edition.votacao_fim) ? votingUrl(edition) : editionUrl(edition)
  };
  if (edition.status === "apuracao" && edition.temVencedoresPublicos) return {
    label: "Divulgação em andamento", period: "", action: "Ver vencedores", href: resultsUrl(edition)
  };
  if (edition.status === "resultado_publicado" || (edition.status === "arquivada" && edition.resultado_publicado_em)) return {
    label: edition.status === "arquivada" ? "Edição arquivada" : "Resultado publicado",
    period: "",
    action: "Ver resultados",
    href: resultsUrl(edition)
  };
  return { label: statusLabel(edition.status), period: "", action: "Ver edição", href: editionUrl(edition) };
};

function period(start, end) {
  if (!start && !end) return "Período a confirmar";
  const format = value => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "a confirmar";
  return `${format(start)} — ${format(end)}`;
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

const title = document.getElementById("award-home-title");
const status = document.getElementById("award-home-status");
const actions = document.getElementById("award-home-actions");
const winnersSection = document.getElementById("awards-home-winners");

function renderPhase(edition) {
  const phase = phaseDetails(edition);
  status.textContent = [phase.label, phase.period].filter(Boolean).join(" · ");
  const primary = phase.action === "Ver vencedores" ? "Ver resultados da edição" : phase.action;
  const secondary = phase.href === editionUrl(edition) ? "" :
    `<a class="award-link" href="${editionUrl(edition)}">Sobre a edição</a>`;
  actions.innerHTML = `<a class="award-home-primary" data-awards-cta href="${phase.href}">${esc(primary)}</a>
    ${secondary}<button class="award-home-share" type="button" data-share-awards-home>Compartilhar</button>`;
}

async function init() {
  registrarEventoMelhores("melhores_index_view");
  try {
    const editions = await listarEdicoesPublicas();
    if (!editions.length) {
      status.textContent = "A próxima edição será anunciada em breve.";
      return;
    }
    const active = edicaoEmDestaque(editions);
    title.replaceChildren();
    const name = String(active.nome || "Melhores de Urânia");
    const emphasis = /Melhores/i.exec(name);
    if (emphasis) {
      const accent = document.createElement("em");
      accent.className = "award-accent";
      accent.textContent = emphasis[0];
      title.append(name.slice(0, emphasis.index), accent, name.slice(emphasis.index + emphasis[0].length));
    } else {
      title.textContent = name;
    }
    setImageMeta(active);
    const cover = document.getElementById("award-home-cover");
    const image = img(active.imagem_capa_url);
    if (image) {
      cover.innerHTML = `<img src="${image}" width="1600" height="807" alt="">`;
      cover.hidden = false;
    }
    const past = editions.filter(item => item.id !== active.id);
    if (past.length) {
      document.getElementById("awards-editions").innerHTML = past.map(editionCard).join("");
      document.getElementById("award-past").hidden = false;
    }
    if (["indicacoes_abertas", "votacao_aberta"].includes(active.status)) {
      const periodState = await consultarPeriodoVotacao(active.id);
      clock = { time: new Date(periodState.agora).getTime(), received: performance.now() };
      active.status = periodState.status;
      active.votacao_inicio_site = periodState.votacao_inicio_site;
      active.votacao_fim = periodState.votacao_fim;
    }
    renderPhase(active);
    document.getElementById("conteudo").addEventListener("click", event => {
      const cta = event.target.closest("[data-awards-cta]");
      if (cta) registrarEventoMelhores("melhores_cta_click", {
        edicaoId: cta.dataset.editionId || active.id, destino: cta.href, metadados: { origem_cta: "home_melhores" }
      });
      if (event.target.closest("[data-share-awards-home]")) {
        sharePage({ title: "Melhores de Urânia", text: `Acompanhe o ${active.nome}.`, url: awardPath() });
        registrarEventoMelhores("melhores_share_click", { edicaoId: active.id, destino: location.href, metadados: { origem: "home_melhores" } });
      }
    });
    if (!["apuracao", "resultado_publicado", "arquivada"].includes(active.status)) return;

    const list = winnersSection.querySelector("ul");
    let pending = false;
    let previousMarkup = null;
    async function refreshWinners() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const rows = await listarResultadosPublicos(active.id);
        const winners = rows.filter(row => row.vencedor && row.publicado)
          .sort((a, b) => String(b.publicado_em || "").localeCompare(String(a.publicado_em || "")) ||
            String(a.melhores_categorias?.nome || "").localeCompare(String(b.melhores_categorias?.nome || ""), "pt-BR"));
        const markup = winners.map(row => {
          const mention = mencaoPublica(row);
          return `<li><a href="${winnerProfileUrl(active, row)}">
            <span>${esc(row.melhores_categorias?.nome)}</span><strong>${esc(row.melhores_indicados?.nome)}</strong>
            ${mention ? `<em>${esc(mention)}</em>` : ""}
          </a></li>`;
        }).join("");
        const firstResponse = previousMarkup === null;
        if (markup !== previousMarkup) {
          list.innerHTML = markup;
          previousMarkup = markup;
        }
        winnersSection.hidden = !winners.length;
        if (firstResponse || Boolean(active.temVencedoresPublicos) !== Boolean(winners.length)) {
          active.temVencedoresPublicos = Boolean(winners.length);
          renderPhase(active);
        }
      } catch (error) {
        console.error("Vencedores da edição:", error);
        if (previousMarkup === null) {
          status.textContent = "Não foi possível carregar os vencedores agora.";
          actions.querySelector("[data-awards-cta]").href = resultsUrl(active);
          actions.querySelector("[data-awards-cta]").textContent = "Consultar resultados";
        }
      } finally {
        pending = false;
      }
    }
    if (active.status === "apuracao") {
      setInterval(refreshWinners, 30000);
      document.addEventListener("visibilitychange", refreshWinners);
    }
    await refreshWinners();
  } catch (error) {
    console.error("Melhores de Urânia:", error);
    status.textContent = "Não foi possível carregar a edição.";
    actions.innerHTML = '<button class="award-home-primary" type="button">Tentar novamente</button>';
    actions.querySelector("button").onclick = () => location.reload();
  }
}

init();
