import { winnerProfileUrl, obterEdicaoPorAno, listarResultadosPublicos, listarHistoricoVencedoresPublicos, listarComprovantesPublicos } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { sharePage } from "../services/shareService.js";
import { montarCentralTransparencia } from "./melhores-transparencia.js";
export { winnerProfileUrl, resultsPageUrl } from "../services/melhoresPublicService.js";

export const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
export const resultsArePublished = (edition, results) =>
  ((edition?.status === "resultado_publicado" || edition?.status === "arquivada") && results.some(row => row.vencedor))
  || (edition?.status === "apuracao" && results.some(row => row.vencedor && row.publicado === true));
const localPreview = () => typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const hallUrl = () => localPreview() ? "/melhores-de-urania/hall.html" : "/melhores-de-urania/hall/";


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

export function formatDate(value) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Data não informada";
}

export function formatAnnouncement(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Data a ser informada";
  const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
  return `${day}, às ${time} (horário de Brasília)`;
}

function setMeta(edition, published) {
  const title = `${published ? "Resultados" : "Edição"} ${edition.ano} | Melhores de Urânia`;
  const description = (published
    ? edition.metodologia || edition.descricao || "Conheça os vencedores do Melhores de Urânia."
    : `Os resultados da edição ${edition.ano} ainda não foram publicados.`).slice(0, 155);
  const imageUrl = new URL(edition.imagem_capa_url || "/assets/compartilhamento-logo.png", location.origin).href;
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", imageUrl);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute("content", imageUrl);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${location.origin}/melhores-de-urania/${edition.ano}/resultados/`);
}

export function categoryName(row) {
  return row?.melhores_categorias?.nome || "Categoria";
}

export function nomineeData(row) {
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

export function winnerKey(row) {
  const nominee = row.melhores_indicados || {};
  return nominee.guia_comercial_id || row.indicado_id || "";
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

export function winnerCard(row, winsByKey, edition, demo = false) {
  const data = nomineeData(row);
  const initial = esc(data.name.trim().charAt(0).toLocaleUpperCase("pt-BR") || "U");
  const profileUrl = !demo && row.indicado_id ? winnerProfileUrl(edition, row) : "";
  const cardTag = profileUrl ? "a" : "article";
  const cardHref = profileUrl ? ` href="${esc(profileUrl)}" aria-label="Conhecer ${esc(data.name)}, vencedor de ${esc(categoryName(row))} em ${edition.ano}"` : "";
  const cardClass = `awards-winner-card${profileUrl ? " is-clickable" : ""}`;
  const historyHint = demo ? "Prévia ilustrativa" : "Conhecer vencedor";

  return `<${cardTag} class="${cardClass}"${cardHref}>
    <div class="awards-winner-media">
      <div class="awards-winner-photo"><span class="awards-winner-initial" aria-hidden="true">${initial}</span>${data.img ? `<img src="${data.img}" alt="${esc(data.name)}" loading="lazy" decoding="async" width="640" height="480">` : ""}</div>
      <span>Vencedor</span>
    </div>
    <div class="awards-winner-body">
      <p class="awards-winner-category">${esc(categoryName(row))}</p>
      <h3>${esc(data.name)}</h3>
      <div class="awards-winner-history">
        <strong>${demo ? "Exemplo de vencedor" : esc(winnerHistoryLabel(row, winsByKey, edition.ano))}</strong>
        <span>${esc(historyHint)}</span>
      </div>
    </div>
  </${cardTag}>`;
}

function rankingItem(row, showVotes, demo = false) {
  const data = nomineeData(row);
  return `<li class="awards-ranking-item ${row.vencedor ? "is-winner" : ""}">
    <span class="awards-ranking-position">${Number(row.colocacao)}º</span>
    <div>
      <strong>${esc(data.name)}</strong>
      <small>${row.vencedor ? "Vencedor" : "Indicado"} ${demo ? "na prévia" : "no resultado oficial"}</small>
    </div>
    ${showVotes ? `<span class="awards-ranking-score">${votesLabel(row)}</span>` : ""}
  </li>`;
}

function rankingSection(rows, showVotes, demo = false) {
  return `<section class="awards-ranking-group">
    <header>
      <div>
        <p class="eyebrow">Categoria</p>
        <h3>${esc(categoryName(rows[0]))}</h3>
      </div>
      <span>${rows.length} indicado${rows.length === 1 ? "" : "s"}</span>
    </header>
    <ol class="awards-ranking-list">${rows.map(row => rankingItem(row, showVotes, demo)).join("")}</ol>
  </section>`;
}

export function renderResults(results, edition, history = [], { demo = false } = {}) {
  const winners = results.filter(row => row.vencedor);
  const historicalWinners = history.length ? history : winners;
  const winsByKey = groupBy(historicalWinners, winnerKey);
  const grouped = groupBy(results, row => row.categoria_id);
  const publishedAt = results.find(row => row.publicado_em)?.publicado_em || edition.resultado_publicado_em;
  const partial = edition.status === "apuracao" && !demo;
  const showVotes = !partial && edition.mostrar_votos_publicamente === true;

  return `<section class="awards-results-summary" aria-label="Resumo dos resultados">
    <div>
      <p class="eyebrow">${demo ? "Prévia ilustrativa" : "Resultado oficial"}</p>
      <h2>Hall dos vencedores ${demo ? "— exemplo" : esc(String(edition.ano))}</h2>
      <p>Um registro histórico das empresas, profissionais e projetos reconhecidos pela comunidade em cada categoria.</p>
    </div>
    <dl>
      <div><dt>Vencedores</dt><dd>${winners.length}</dd></div>
      <div><dt>Categorias</dt><dd>${grouped.size}</dd></div>
      <div><dt>${demo ? "Data" : "Publicado"}</dt><dd>${demo ? "Ilustrativa" : esc(formatDate(publishedAt))}</dd></div>
    </dl>
  </section>
  <section class="awards-winners-hall" id="hall-dos-vencedores">
    ${winners.length ? winners.map(row => winnerCard(row, winsByKey, edition, demo)).join("") : '<div class="awards-empty">Nenhum vencedor publicado ainda.</div>'}
  </section>
  ${partial ? "" : `<section class="awards-results-ranking">
    <div class="awards-section-head compact">
      <div>
        <p class="eyebrow">Apuração</p>
        <h2>${partial ? "Categorias já anunciadas" : "Resultado completo por categoria"}</h2>
      </div>
      <p>${demo ? "Nomes e números fictícios para visualizar o formato." : partial ? "Novos vencedores serão anunciados ao longo dos próximos dias." : "Ranking oficial preservado como snapshot histórico da edição."}</p>
    </div>
    <div class="awards-ranking-grid">${[...grouped.values()].map(rows => rankingSection(rows, showVotes, demo)).join("")}</div>
  </section>`}
  ${!demo ? `<p class="awards-results-more"><a href="${hallUrl()}">Ver o Hall de todas as edições →</a></p>` : ""}`;
}

let resultsRefreshInProgress = false;
async function init(refresh = false) {
  if (resultsRefreshInProgress) return;
  resultsRefreshInProgress = true;
  try {
    const year = getYear();
    const edition = await obterEdicaoPorAno(year);
    if (!edition) {
      document.getElementById("results-list").innerHTML = '<div class="awards-empty">Edição não encontrada ou ainda não publicada.</div>';
      return;
    }

    if (!refresh) registrarEventoMelhores("melhores_results_view", {
      edicaoId: edition.id,
      metadados: { ano: edition.ano, status: edition.status }
    });

    const results = await listarResultadosPublicos(edition.id);
    const published = resultsArePublished(edition, results);
    setMeta(edition, published);
    if (!published) {
      const phase = {
        indicacoes_abertas: "Indicações abertas",
        indicacoes_encerradas: "Indicações encerradas",
        votacao_aberta: "Votação aberta",
        votacao_encerrada: "Votação encerrada",
        apuracao: "Apuração"
      }[edition.status] || "Edição em andamento";
      document.getElementById("results-copy").innerHTML = `<span class="awards-public-badge">${esc(phase)}</span><h1>${esc(edition.nome)}</h1><p>Os resultados desta edição ainda não estão disponíveis. A divulgação oficial acontecerá depois da apuração.</p><div class="hero-actions"><a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/">Acompanhar edição</a></div>`;
      document.getElementById("results-panel").innerHTML = `<h2>Edição ${esc(String(edition.ano))}</h2><p>Assim que os resultados forem publicados, os vencedores de cada categoria aparecerão aqui.</p><div class="awards-status-line"><span class="awards-chip">${esc(phase)}</span></div>`;
      document.getElementById("results-list").innerHTML = '<div class="awards-empty">Nenhum resultado oficial publicado para esta edição.</div>';
      if (["votacao_encerrada", "apuracao"].includes(edition.status)) {
        const gradual = Number(edition.ano) === 2026 && new Date(edition.divulgacao_em).getTime() === Date.parse("2026-11-23T13:00:00Z");
        const announcement = gradual ? "De 23 a 29 de novembro, às 10h, 15h e 20h" : formatAnnouncement(edition.divulgacao_em);
        document.getElementById("results-copy").innerHTML = `<span class="awards-public-badge">Votação encerrada</span><h1>Obrigado por fazer parte.</h1><p>A votação do ${esc(edition.nome)} terminou. Nossa equipe está conferindo os votos e preparando a divulgação dos vencedores.</p><div class="hero-actions"><a class="button button-secondary" href="/melhores-de-urania/${encodeURIComponent(edition.ano)}/">Acompanhar a edição</a></div>`;
        document.getElementById("results-panel").innerHTML = `<p class="eyebrow">Divulgação prevista</p><h2>${esc(announcement)}</h2><p>${gradual ? "Horário de Brasília. Os vencedores serão apresentados nesta página, um por vez." : "Os vencedores serão apresentados nesta página após a publicação oficial."}</p><div class="awards-status-line"><span class="awards-chip">Apuração em andamento</span></div>`;
        document.getElementById("results-list").innerHTML = '<div class="awards-empty">Agradecemos a todos que participaram e valorizaram quem faz Urânia acontecer.</div>';
      }
      if (edition.ano === 2026) montarCentralTransparencia(document.getElementById("results-list"), edition, []);
      return;
    }

    const partial = edition.status === "apuracao";
    const [history, comprovantes] = await Promise.all([
      listarHistoricoVencedoresPublicos().catch(error => {
        console.warn("Histórico público de vencedores indisponível:", error);
        return [];
      }),
      !partial && edition.ano === 2026 && edition.mostrar_votos_publicamente === true
        ? listarComprovantesPublicos(edition.id).catch(error => { console.warn("Imagens das enquetes indisponíveis:", error); return null; })
        : Promise.resolve(null)
    ]);
    const publishedAt = results.find(row => row.publicado_em)?.publicado_em || edition.resultado_publicado_em;
    document.getElementById("results-copy").innerHTML = `<span class="awards-public-badge">${partial ? "Divulgação em andamento" : "Resultado oficial"}</span><h1>${esc(edition.nome)}</h1><p>${partial ? "Os vencedores são anunciados aos poucos, nos horários oficiais. Confira as categorias já divulgadas." : esc(edition.descricao || "Conheça os nomes reconhecidos pela comunidade nesta edição do Melhores de Urânia.")}</p><div class="hero-actions"><button class="button button-primary" type="button" data-share-results>Compartilhar resultados</button><a class="button button-secondary" href="/melhores-de-urania/${edition.ano}/">Ver edição</a></div>`;
    document.getElementById("results-panel").innerHTML = `<h2>Edição ${esc(String(edition.ano))}</h2><p>${partial ? "Acompanhe as novas categorias anunciadas a cada dia." : "Resultado oficial preservado no histórico da premiação."}</p><div class="awards-status-line"><span class="awards-chip open">${partial ? "Divulgação em andamento" : "Resultado publicado"}</span>${!partial && publishedAt ? `<span class="awards-chip">Publicado em ${esc(formatDate(publishedAt))}</span>` : ""}</div>`;
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

    const resultsList = document.getElementById("results-list");
    if (!resultsList.dataset.winnerErrorHandler) {
      resultsList.addEventListener("error", event => {
        if (event.target.matches?.(".awards-winner-photo img")) event.target.remove();
      }, true);
      resultsList.dataset.winnerErrorHandler = "1";
    }
    resultsList.innerHTML = renderResults(results, edition, history);
    if (!partial && edition.ano === 2026) montarCentralTransparencia(resultsList, edition, results, comprovantes);
  } catch (error) {
    console.error("Resultados Melhores de Urânia:", error);
    if (!refresh) document.getElementById("results-list").innerHTML = '<div class="awards-empty">Não foi possível carregar os resultados agora.</div>';
  } finally {
    resultsRefreshInProgress = false;
  }
}

if (typeof document !== "undefined" && document.body?.dataset.awardsPage === "results" && !(location.pathname.startsWith("/preview/melhores/") && new URLSearchParams(location.search).get("demo") === "1")) {
  init();
  if (getYear() === 2026) setInterval(() => { if (!document.hidden) init(true); }, 30000);
}
