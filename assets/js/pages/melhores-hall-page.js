import { listarEdicoesPublicas, listarResultadosPublicos } from "../services/melhoresPublicService.js";
import { esc, resultsArePublished, resultsPageUrl, winnerCard, winnerKey } from "./melhores-resultados-page.js";

const complete = edition => edition.status === "resultado_publicado" || edition.status === "arquivada";

function setMeta() {
  const title = "Hall dos vencedores | Melhores de Urânia";
  const description = "Conheça os vencedores oficiais de cada edição do Melhores de Urânia.";
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${location.origin}/melhores-de-urania/hall/`);
}

async function init() {
  const copy = document.getElementById("hall-copy");
  const panel = document.getElementById("hall-panel");
  const list = document.getElementById("hall-list");
  if (!copy || !panel || !list) return;

  setMeta();
  copy.innerHTML = '<span class="awards-public-badge">Histórico oficial</span><h1>Hall dos vencedores</h1><p>Um lugar para revisitar quem foi reconhecido em cada edição do Melhores de Urânia.</p><div class="hero-actions"><a class="button button-secondary" href="/melhores-de-urania/">Ver premiação</a></div>';
  panel.innerHTML = '<h2>Uma história feita pela cidade</h2><p>Os vencedores aparecem aqui somente após a divulgação oficial de cada edição.</p>';

  try {
    const editions = (await listarEdicoesPublicas()).filter(complete).sort((a, b) => Number(b.ano) - Number(a.ano));
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
      if (event.target.matches?.(".awards-winner-photo img")) event.target.remove();
    }, true);
    list.innerHTML = published.map(({ edition, results }) => {
      const winners = results.filter(row => row.vencedor);
      if (!winners.length) return "";
      return `<section class="awards-hall-year" aria-labelledby="awards-hall-${edition.ano}">
        <header class="awards-hall-year-head">
          <div><p class="eyebrow">Edição oficial</p><h2 id="awards-hall-${edition.ano}">${esc(String(edition.ano))}</h2></div>
          <a href="${resultsPageUrl(edition)}">Ver resultado completo <span aria-hidden="true">→</span></a>
        </header>
        <div class="awards-winners-hall">${winners.map(row => winnerCard(row, winsByKey, edition)).join("")}</div>
      </section>`;
    }).join("");
  } catch (error) {
    console.error("Hall dos vencedores:", error);
    list.innerHTML = '<div class="awards-empty">Não foi possível carregar o Hall agora. Tente novamente mais tarde.</div>';
  }
}

init();
