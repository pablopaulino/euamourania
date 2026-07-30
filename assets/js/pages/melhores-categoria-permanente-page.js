import { listarCategoriasHistoricasPorSlug } from "../services/melhoresPublicService.js";
import { registrarEventoMelhores } from "../services/melhoresAnalyticsService.js";
import { sharePage } from "../services/shareService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";

function getSlug() {
  const match = location.pathname.match(/melhores-de-urania\/categorias\/([^/]+)/);
  const query = new URLSearchParams(location.search).get("categoria");
  return match?.[1] ? decodeURIComponent(match[1]) : (query || "");
}

function statusLabel(status = "") {
  const labels = {
    indicacoes_abertas: "Indicações abertas",
    votacao_aberta: "Votação aberta",
    votacao_encerrada: "Votação encerrada",
    resultado_publicado: "Resultado publicado"
  };
  return labels[status] || String(status || "Status a confirmar").replaceAll("_", " ");
}

function setMeta(category, rows) {
  const edition = rows[0]?.melhores_edicoes || {};
  const title = `${category.nome} | Melhores de Urânia`;
  const description = (category.descricao || `Confira o histórico da categoria ${category.nome} e acompanhe os nomes que ajudam a movimentar Urânia.`).slice(0, 155);
  const canonical = `${location.origin}/melhores-de-urania/categorias/${category.slug}/`;
  document.title = `${title} | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(category.imagem_url || edition.imagem_capa_url || "/assets/compartilhamento-logo.png", location.origin).href);
}

function yearCard(row) {
  const edition = row.melhores_edicoes || {};
  const img = image(row.imagem_url || edition.imagem_capa_url);
  const href = `/melhores-de-urania/${edition.ano}/categorias/${encodeURIComponent(row.slug)}/`;
  return `<article class="awards-edition-card">
    ${img ? `<img src="${img}" alt="${esc(row.nome)} ${esc(edition.ano)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      <span class="awards-chip ${edition.status === "votacao_aberta" ? "open" : ""}">${esc(statusLabel(edition.status))}</span>
      <h3>${esc(edition.nome || `Edição ${edition.ano}`)}</h3>
      <p>${esc(row.descricao || edition.descricao || "Categoria publicada nesta edição do Melhores de Urânia.")}</p>
      <a class="button button-primary" href="${href}">Abrir categoria ${esc(edition.ano)}</a>
    </div>
  </article>`;
}

async function init() {
  const slug = getSlug();
  const years = document.getElementById("permanent-category-years");
  try {
    const rows = (await listarCategoriasHistoricasPorSlug(slug))
      .sort((a, b) => Number(b.melhores_edicoes?.ano || 0) - Number(a.melhores_edicoes?.ano || 0));
    if (!rows.length) {
      years.innerHTML = '<div class="awards-empty">Categoria não encontrada.</div>';
      return;
    }
    const category = rows[0];
    setMeta(category, rows);
    registrarEventoMelhores("melhores_permanent_category_view", {
      metadados: { categoria_slug: category.slug, edicoes: rows.length }
    });
    document.getElementById("permanent-category-copy").innerHTML = `
      <span class="awards-public-badge">Histórico da categoria</span>
      <h1>${esc(category.nome)}</h1>
      <p>${esc(category.descricao || "Confira o histórico desta categoria e acompanhe os nomes que ajudam a movimentar Urânia.")}</p>
      <div class="hero-actions">
        <button class="button button-primary" type="button" data-share-category>Compartilhar categoria</button>
        <a class="button button-secondary" href="/melhores-de-urania/">Ver prêmio</a>
      </div>`;
    document.getElementById("permanent-category-panel").innerHTML = `
      <h2>${esc(rows.length)} edição${rows.length === 1 ? "" : "es"}</h2>
      <p>Histórico público e organizado para acompanhar a evolução desta categoria ao longo dos anos.</p>
      <div class="awards-status-line">
        <span class="awards-chip">Mais recente: ${esc(rows[0]?.melhores_edicoes?.ano || "")}</span>
        <span class="awards-chip">Categoria permanente</span>
      </div>`;
    years.innerHTML = rows.map(yearCard).join("");
    document.querySelector("[data-share-category]")?.addEventListener("click", async () => {
      await sharePage({
        title: `${category.nome} | Melhores de Urânia`,
        text: `Veja o histórico da categoria ${category.nome} no Melhores de Urânia.`,
        url: location.href
      });
    });
  } catch (error) {
    console.error("Categoria permanente Melhores:", error);
    years.innerHTML = '<div class="awards-empty">Não foi possível carregar esta categoria agora.</div>';
  }
}

init();
