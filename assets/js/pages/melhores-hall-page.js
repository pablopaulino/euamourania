import { awardPath } from "../melhoresRoutes.mjs";
import { listarEdicoesPublicas, listarResultadosPublicos } from "../services/melhoresPublicService.js";
import { categoryName, esc, nomineeData, resultsArePublished, resultsPageUrl, winnerCard, winnerKey } from "./melhores-resultados-page.js";

const hasResultsPhase = edition => ["apuracao", "resultado_publicado", "arquivada"].includes(edition.status);

function categoriesFor(edition, results, winsByKey) {
  const groups = new Map();
  results.forEach(row => {
    if (!groups.has(row.categoria_id)) groups.set(row.categoria_id, []);
    groups.get(row.categoria_id).push(row);
  });
  return [...groups.values()].map(rows => {
    const winners = rows.filter(row => row.vencedor);
    const nominees = edition.status === "apuracao" ? [] : rows.filter(row => !row.vencedor);
    return `<section class="award-archive-category">
      <h3 class="award-archive-label">${esc(categoryName(rows[0]))}</h3>
      <div class="award-archive-entries">
        ${winners.map(row => winnerCard(row, winsByKey, edition, false, true)).join("")}
        ${nominees.length ? `<div class="award-archive-nominees"><h4>Demais indicados</h4><ul>${nominees.map(row => `<li>${esc(nomineeData(row).name)}</li>`).join("")}</ul></div>` : ""}
      </div>
    </section>`;
  }).join("");
}

function setMeta() {
  const title = "Hall dos vencedores | Melhores de Urânia";
  const description = "Conheça os vencedores oficiais de cada edição do Melhores de Urânia.";
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${location.origin}${awardPath("hall")}`);
}

async function init() {
  const copy = document.getElementById("hall-copy");
  const panel = document.getElementById("hall-panel");
  const list = document.getElementById("hall-list");
  if (!copy || !panel || !list) return;

  setMeta();
  copy.innerHTML = `<span class="awards-public-badge">Histórico oficial</span><h1>Hall dos <em class="award-accent">vencedores</em></h1><p>Revisite quem foi reconhecido em cada edição do Melhores de Urânia.</p><div class="hero-actions"><a class="button button-secondary" href="${awardPath()}">Ver premiação</a></div>`;
  panel.innerHTML = '<img src="/assets/melhores/hall-2026.png" width="3510" height="1770" alt="Arte oficial do Prêmio Melhores de Urânia 2026">';

  try {
    const editions = (await listarEdicoesPublicas()).filter(hasResultsPhase).sort((a, b) => Number(b.ano) - Number(a.ano));
    const loaded = await Promise.all(editions.map(async edition => ({ edition, results: await listarResultadosPublicos(edition.id) })));
    const published = loaded.filter(({ edition, results }) => resultsArePublished(edition, results));
    const allWinners = published.flatMap(({ edition, results }) => results.filter(row => row.vencedor).map(row => ({ ...row, melhores_edicoes: { ano: edition.ano } })));
    const winsByKey = new Map();
    allWinners.forEach(row => {
      const key = winnerKey(row);
      if (!key) return;
      if (!winsByKey.has(key)) winsByKey.set(key, []);
      winsByKey.get(key).push(row);
    });

    if (!allWinners.length) {
      list.innerHTML = '<div class="awards-empty">Ainda não há vencedores publicados. O Hall será aberto após a divulgação oficial dos resultados.</div>';
      return;
    }

    list.addEventListener("error", event => {
      if (event.target.matches?.(".award-year-cover img") && !event.target.src.endsWith("/simbolo.png")) event.target.src = "/assets/melhores/simbolo.png";
      if (event.target.matches?.(".awards-winner-photo img")) event.target.remove();
    }, true);
    const buttons = published.map(({ edition }, index) =>
      `<button type="button" data-award-year="${edition.ano}" aria-controls="award-year-${edition.ano}" aria-pressed="${index === 0}"><span class="award-year-cover"><img src="${esc(edition.imagem_capa_url || (Number(edition.ano) === 2026 ? "/assets/melhores/hall-2026.png" : "/assets/melhores/simbolo.png"))}" alt=""></span><span><strong>${edition.ano}</strong><small>${Number(edition.ano) === 2026 ? "Primeira edição" : esc(edition.nome)}</small></span></button>`).join("");
    const years = published.map(({ edition, results }, index) => {
      return `<section class="awards-hall-year" id="award-year-${edition.ano}" aria-labelledby="awards-hall-${edition.ano}"${index ? " hidden" : ""}>
        <header class="awards-hall-year-head">
          <div><p class="eyebrow">Edição oficial</p><h2 id="awards-hall-${edition.ano}">${esc(String(edition.ano))}</h2></div>
          <a class="button button-secondary" href="${resultsPageUrl(edition)}">Ver resultados da edição <span aria-hidden="true">→</span></a>
        </header>
        <div class="award-hall-grid">${categoriesFor(edition, results, winsByKey)}</div>
      </section>`;
    }).join("");
    list.innerHTML = `<div class="award-year-select" role="group" aria-label="Ano da edição">${buttons}</div>${years}`;
    list.querySelector(".award-year-select").addEventListener("click", event => {
      const selected = event.target.closest("[data-award-year]");
      if (!selected) return;
      list.querySelectorAll("[data-award-year]").forEach(button => {
        const active = button === selected;
        button.setAttribute("aria-pressed", String(active));
        document.getElementById(button.getAttribute("aria-controls")).hidden = !active;
      });
    });
  } catch (error) {
    console.error("Hall dos vencedores:", error);
    list.innerHTML = '<div class="awards-empty">Não foi possível carregar o Hall agora. Tente novamente mais tarde.</div>';
  }
}

init();
