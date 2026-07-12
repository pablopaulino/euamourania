import { obterEdicaoPorAno, listarResultadosPublicos } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";

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
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", `${location.origin}/melhores-de-urania/${edition.ano}/resultados/`);
}

function resultCard(row) {
  const nominee = row.melhores_indicados || {};
  const img = image(nominee.imagem_url);
  return `<article class="awards-nominee-card ${row.vencedor ? "awards-voted" : ""}">
    ${img ? `<img src="${img}" alt="${esc(nominee.nome)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      <span class="awards-chip ${row.vencedor ? "open" : ""}">${row.vencedor ? "Vencedor" : "Finalista"} · ${Number(row.colocacao)}º</span>
      <h3>${esc(nominee.nome || "Indicado")}</h3>
      <p>${esc(nominee.descricao_curta || row.criterio_aplicado || "Resultado oficial da categoria.")}</p>
      <p><small>Site: ${Number(row.percentual_site || 0).toFixed(2)}% · Instagram: ${Number(row.percentual_instagram || 0).toFixed(2)}%</small></p>
      <p><strong>Pontuação final:</strong> ${Number(row.pontuacao_final || 0).toFixed(4)}</p>
    </div>
  </article>`;
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
    document.getElementById("results-copy").innerHTML = `<span class="awards-public-badge">Resultado oficial</span><h1>${esc(edition.nome)}</h1><p>${esc(edition.metodologia || edition.descricao || "Confira os vencedores e finalistas oficiais.")}</p>`;
    document.getElementById("results-panel").innerHTML = `<h2>Metodologia</h2><p>${esc(edition.metodologia || "Resultado calculado conforme regulamento e pesos da edição.")}</p><div class="awards-status-line"><span class="awards-chip open">${esc(edition.status.replaceAll("_", " "))}</span><span class="awards-chip">Publicado em ${esc(formatDate(edition.resultado_publicado_em || edition.divulgacao_em))}</span></div>`;
    const results = await listarResultadosPublicos(edition.id);
    if (!results.length) {
      document.getElementById("results-list").innerHTML = '<div class="awards-empty">Resultado oficial ainda não publicado para esta edição.</div>';
      return;
    }
    const grouped = groupBy(results, row => row.categoria_id);
    document.getElementById("results-list").innerHTML = [...grouped.values()].map(rows => `<section class="awards-nominee-group"><header><h3>${esc(rows[0]?.melhores_categorias?.nome || "Categoria")}</h3><p>Resultado oficial publicado pela organização.</p></header><div class="awards-nominee-grid">${rows.map(resultCard).join("")}</div></section>`).join("");
  } catch (error) {
    console.error("Resultados Melhores de Urânia:", error);
    document.getElementById("results-list").innerHTML = '<div class="awards-empty">Não foi possível carregar os resultados agora.</div>';
  }
}

init();
