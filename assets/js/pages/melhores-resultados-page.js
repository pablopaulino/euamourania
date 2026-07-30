import { obterEdicaoPorAno, listarResultadosPublicos, listarHistoricoVencedoresPublicos } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { sharePage } from "../services/shareService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";

function getYear() {
  const match = location.pathname.match(/melhores-de-urania\/(\d{4})\/resultados/);
  const query = new URLSearchParams(location.search).get("ano");
  return Number(match?.[1] || query || new Date().getFullYear());
}

function groupBy(rows, getKey) {
  const map = new Map();
  rows.forEach(row => {
    const key = getKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Data não informada";
}

function setMeta(edition) {
  const title = `Resultados ${edition.ano} | Melhores de Urânia`;
  const description = (edition.metodologia || edition.descricao || "Resultados oficiais publicados do Melhores de Urânia.").slice(0, 155);
  const imageUrl = new URL(edition.imagem_capa_url || "/assets/compartilhamento-logo.png", location.origin).href;
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", imageUrl);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", imageUrl);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${location.origin}/melhores-de-urania/${edition.ano}/resultados/`);
}

function categoryName(row) {
  return row?.melhores_categorias?.nome || "Categoria";
}

function nomineeData(row) {
  const nominee = row.melhores_indicados || {};
  const guide = nominee.guia_comercial || {};
  return {
    nominee,
    guide,
    name: nominee.nome || guide.nome || "Indicado",
    description: nominee.descricao_curta || row.criterio_aplicado || guide.categoria_nome || "Resultado oficial da categoria.",
    img: image(nominee.imagem_url || guide.imagem_url),
    guideUrl: guide.slug && guide.status === "publicado" ? `/guia/${encodeURIComponent(guide.slug)}` : ""
  };
}

function winnerKey(row) {
  const nominee = row.melhores_indicados || {};
  return nominee.guia_comercial_id || row.indicado_id || (nominee.nome || "").toLowerCase().trim();
}

function winnerHistoryLabel(row, winsByKey, year) {
  const wins = winsByKey.get(winnerKey(row)) || [];
  const years = [...new Set(wins.map(win => Number(win?.melhores_edicoes?.ano || year)).filter(Boolean))].sort();
  if (years.length > 1) return `Vencedor em ${years.length} edições`;
  if (wins.length > 1) return `${wins.length} conquistas na edição ${year}`;
  return "Vencedor da primeira edição";
}

function totalVotes(row) {
  return Number(row.votos_site || 0) + Number(row.votos_instagram || 0);
}

function votesLabel(row) {
  const votes = totalVotes(row);
  return `${votes} voto${votes === 1 ? "" : "s"}`;
}

function winnerCard(row, winsByKey, edition) {
  const data = nomineeData(row);
  const img = data.img || "/assets/compartilhamento-logo.png";
  const cardTag = data.guideUrl ? "a" : "article";
  const cardHref = data.guideUrl ? ` href="${esc(data.guideUrl)}" aria-label="Ver ${esc(data.name)} no Guia Comercial"` : "";
  const cardClass = `awards-winner-card${data.guideUrl ? " is-clickable" : ""}`;
  const historyHint = data.guideUrl ? "Abrir no Guia Comercial" : "Reconhecimento oficial da comunidade";

  return `<${cardTag} class="${cardClass}"${cardHref}>
    <div class="awards-winner-media">
      <img src="${img}" alt="${esc(data.name)}" loading="lazy" decoding="async" width="640" height="480">
      <span>Vencedor</span>
    </div>
    <div class="awards-winner-body">
      <p class="awards-winner-category">${esc(categoryName(row))}</p>
      <h3>${esc(data.name)}</h3>
      <div class="awards-winner-history">
        <strong>${esc(winnerHistoryLabel(row, winsByKey, edition.ano))}</strong>
        <span>${esc(historyHint)}</span>
      </div>
    </div>
  </${cardTag}>`;
}

function rankingItem(row) {
  const data = nomineeData(row);
  return `<li class="awards-ranking-item ${row.vencedor ? "is-winner" : ""}">
    <span class="awards-ranking-position">${Number(row.colocacao)}º</span>
    <div>
      <strong>${esc(data.name)}</strong>
      <small>${row.vencedor ? "Vencedor" : "Indicado"} no resultado oficial</small>
    </div>
    <span class="awards-ranking-score">${votesLabel(row)}</span>
  </li>`;
}

function rankingSection(rows) {
  return `<section class="awards-ranking-group">
    <header>
      <div>
        <p class="eyebrow">Categoria</p>
        <h3>${esc(categoryName(rows[0]))}</h3>
      </div>
      <span>${rows.length} indicado${rows.length === 1 ? "" : "s"}</span>
    </header>
    <ol class="awards-ranking-list">${rows.map(rankingItem).join("")}</ol>
  </section>`;
}

function renderResults(results, edition, history = []) {
  const winners = results.filter(row => row.vencedor);
  const historicalWinners = history.length ? history : winners;
  const winsByKey = groupBy(historicalWinners, winnerKey);
  const grouped = groupBy(results, row => row.categoria_id);
  const publishedAt = results.find(row => row.publicado_em)?.publicado_em || edition.resultado_publicado_em || edition.divulgacao_em;

  return `<section class="awards-results-summary" aria-label="Resumo dos resultados">
    <div>
      <p class="eyebrow">Resultado oficial</p>
      <h2>Hall dos vencedores ${esc(String(edition.ano))}</h2>
      <p>Um registro histórico das empresas, profissionais e projetos reconhecidos pela comunidade em cada categoria.</p>
    </div>
    <dl>
      <div><dt>Vencedores</dt><dd>${winners.length}</dd></div>
      <div><dt>Categorias</dt><dd>${grouped.size}</dd></div>
      <div><dt>Publicado</dt><dd>${esc(formatDate(publishedAt))}</dd></div>
    </dl>
  </section>
  <section class="awards-winners-hall">
    ${winners.length ? winners.map(row => winnerCard(row, winsByKey, edition)).join("") : '<div class="awards-empty">Nenhum vencedor publicado ainda.</div>'}
  </section>
  <section class="awards-results-ranking">
    <div class="awards-section-head compact">
      <div>
        <p class="eyebrow">Apuração</p>
        <h2>Resultado completo por categoria</h2>
      </div>
      <p>Ranking oficial preservado como snapshot histórico da edição.</p>
    </div>
    <div class="awards-ranking-grid">${[...grouped.values()].map(rankingSection).join("")}</div>
  </section>`;
}

async function init() {
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      document.getElementById("results-list").innerHTML = '<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>';
      return;
    }

    registrarEventoMelhores("melhores_results_view", {
      edicaoId: edition.id,
      metadados: { ano: edition.ano, status: edition.status }
    });

    setMeta(edition);
    document.getElementById("results-copy").innerHTML = `<span class="awards-public-badge">Resultado oficial</span><h1>${esc(edition.nome)}</h1><p>${esc(edition.descricao || "Conheça os nomes reconhecidos pela comunidade nesta edição do Melhores de Urânia.")}</p><div class="hero-actions"><button class="button button-primary" type="button" data-share-results>Compartilhar resultados</button><a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/">Ver edição</a></div>`;
    document.getElementById("results-panel").innerHTML = `<h2>Edição ${esc(String(edition.ano))}</h2><p>Resultado oficial publicado e preservado como histórico da premiação.</p><div class="awards-status-line"><span class="awards-chip open">${esc(edition.status.replaceAll("_", " "))}</span><span class="awards-chip">Publicado em ${esc(formatDate(edition.resultado_publicado_em || edition.divulgacao_em))}</span></div>`;

    document.querySelector("[data-share-results]")?.addEventListener("click", async () => {
      await sharePage({
        title: `Resultados ${edition.ano} | Melhores de Urânia`,
        text: `Confira os resultados oficiais do ${edition.nome}.`,
        url: location.href
      });
      registrarEventoMelhores("melhores_share_click", {
        edicaoId: edition.id,
        destino: location.href,
        metadados: { canal: "native", origem: "resultados" }
      });
    });

    const [results, history] = await Promise.all([
      listarResultadosPublicos(edition.id),
      listarHistoricoVencedoresPublicos().catch(error => {
        console.warn("Histórico público de vencedores indisponível:", error);
        return [];
      })
    ]);
    if (!results.length) {
      document.getElementById("results-list").innerHTML = '<div class="awards-empty">Resultado oficial ainda não publicado para esta edição.</div>';
      return;
    }

    document.getElementById("results-list").innerHTML = renderResults(results, edition, history);
  } catch (error) {
    console.error("Resultados Melhores de Urânia:", error);
    document.getElementById("results-list").innerHTML = '<div class="awards-empty">Não foi possível carregar os resultados agora.</div>';
  }
}

init();
