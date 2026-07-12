import { obterEdicaoPorAno, obterCategoriaPublica, listarIndicadosPorCategoria } from "../services/melhoresPublicService.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const image = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";

function params() {
  const path = location.pathname.match(/melhores-de-urania\/(\d{4})\/categorias\/([^/]+)/);
  const query = new URLSearchParams(location.search);
  return { ano: Number(path?.[1] || query.get("ano") || new Date().getFullYear()), slug: path?.[2] || query.get("categoria") || "" };
}

function card(item) {
  const img = image(item.imagem_url);
  return `<article class="awards-nominee-card">
    ${img ? `<img src="${img}" alt="${esc(item.nome)}" loading="lazy">` : ""}
    <div class="awards-card-body">
      <h3>${esc(item.nome)}</h3>
      <p>${esc(item.descricao_curta || "Finalista do Melhores de Urânia.")}</p>
    </div>
  </article>`;
}

async function init() {
  const { ano, slug } = params();
  const edition = await obterEdicaoPorAno(ano);
  if (!edition) {
    document.getElementById("category-nominees").innerHTML = '<div class="awards-empty">Edição não encontrada.</div>';
    return;
  }
  const category = await obterCategoriaPublica(edition.id, slug);
  if (!category) {
    document.getElementById("category-nominees").innerHTML = '<div class="awards-empty">Categoria não encontrada.</div>';
    return;
  }
  const canonical = `${location.origin}/melhores-de-urania/${edition.ano}/categorias/${category.slug}/`;
  document.title = `${category.nome} | Melhores de Urânia | Eu Amo Urânia`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", (category.descricao || `Finalistas da categoria ${category.nome}.`).slice(0, 155));
  document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", `${category.nome} | Melhores de Urânia`);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", (category.descricao || "Conheça os finalistas desta categoria.").slice(0, 155));
  if (category.imagem_url) document.querySelector('meta[property="og:image"]')?.setAttribute("content", new URL(category.imagem_url, location.origin).href);
  document.getElementById("category-copy").innerHTML = `<span class="awards-public-badge">Categoria ${esc(edition.ano)}</span><h1>${esc(category.nome)}</h1><p>${esc(category.descricao || "Conheça os finalistas desta categoria.")}</p>`;
  document.getElementById("category-panel").innerHTML = `<h2>Regras</h2><p>Finalistas: até ${Number(category.limite_indicados || 4)}.</p><p>Escolhas por voto: ${Number(category.max_escolhas || 1)}.</p><p>${category.permite_indicacao_publica ? "Recebe indicações públicas." : "Indicações públicas fechadas nesta categoria."}</p>`;
  const nominees = await listarIndicadosPorCategoria(edition.id, category.id);
  document.getElementById("category-nominees").innerHTML = nominees.length
    ? `<div class="awards-nominee-grid">${nominees.map(card).join("")}</div>`
    : '<div class="awards-empty">Nenhum finalista publicado nesta categoria.</div>';
}

init().catch(error => {
  console.error("Categoria Melhores:", error);
  document.getElementById("category-nominees").innerHTML = '<div class="awards-empty">Não foi possível carregar esta categoria.</div>';
});
