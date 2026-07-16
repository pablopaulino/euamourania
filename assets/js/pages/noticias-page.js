import { formatarData, gerarSlug, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("news-container");
const featured = document.getElementById("news-featured");
const status = document.getElementById("news-status");
const filters = document.getElementById("news-category-filters");
const search = document.getElementById("news-search");
const searchForm = document.getElementById("news-search-form");
const resultsCount = document.getElementById("news-results-count");
const loadMore = document.getElementById("news-load-more");
const clearFilters = document.getElementById("news-clear-filters");
const PAGE_SIZE = 10;

let feed = [];
let allNews = [];
let selectedCategory = "";
let visibleCount = PAGE_SIZE;

const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;",
})[char]);

const safeImage = (value) => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "../assets/Design sem nome (9).png";
const newsUrl = (slug) => `/noticias/${encodeURIComponent(slug)}`;
const summary = (item) => (item.resumo || textoPuro(item.conteudo_html || "")).trim();
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const categoryUrl = (category) => `/${encodeURIComponent(gerarSlug(category || "urania"))}/`;

function categoryLink(category, className = "news-category-link") {
  const label = category || "Urânia";
  return `<a class="${className}" href="${categoryUrl(label)}">${esc(label)}</a>`;
}

function shortText(text = "", limit = 150) {
  const clean = String(text || "").trim();
  return clean.length > limit ? `${clean.slice(0, limit).trim()}…` : clean;
}

function leadCard(item) {
  const url = newsUrl(item.slug);
  const text = summary(item);
  return `<article class="news-cover-lead">
    <a class="news-cover-media" href="${url}" aria-label="${esc(item.titulo)}">
      <img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" fetchpriority="high" decoding="async">
    </a>
    <div class="news-cover-copy">
      <p class="news-cover-meta"><span>Manchete local</span>${categoryLink(item.categoria_nome)}</p>
      <h2><a href="${url}">${esc(item.titulo)}</a></h2>
      ${text ? `<p>${esc(shortText(text, 220))}</p>` : ""}
      <div class="news-cover-footer">
        <time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time>
        <a href="${url}">Ler notícia <span aria-hidden="true">→</span></a>
      </div>
    </div>
  </article>`;
}

function compactCard(item, label = "Última") {
  const url = newsUrl(item.slug);
  return `<article class="news-compact-card">
    <a class="news-compact-media" href="${url}" aria-label="${esc(item.titulo)}">
      <img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="eager" decoding="async">
    </a>
    <div>
      <p>${esc(label)}</p>
      <h3><a href="${url}">${esc(item.titulo)}</a></h3>
      <time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time>
    </div>
  </article>`;
}

function headlineItem(item, index) {
  return `<a class="news-headline-item" href="${newsUrl(item.slug)}">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <strong>${esc(item.titulo)}</strong>
  </a>`;
}

function popularItem(item, index) {
  return `<a class="news-popular-item" href="${newsUrl(item.slug)}">
    <span>${index + 1}</span>
    <strong>${esc(item.titulo)}</strong>
  </a>`;
}

function renderBreaking(items) {
  const breaking = items.slice(0, 6);
  const links = breaking.map((item) => `<a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a>`).join("");
  return `<div class="news-breaking-strip" aria-label="Plantão local">
    <span>Plantão local</span>
    <div class="news-breaking-viewport"><div class="news-breaking-track">${links}${links}</div></div>
  </div>`;
}

function renderFeatured(items = []) {
  const lead = items[0];
  if (!lead) return;
  const supporting = items.slice(1, 3);
  const headlines = items.slice(0, 5);
  const popular = [...allNews].sort((a, b) => (Number(b.visualizacoes || 0) - Number(a.visualizacoes || 0)) || new Date(b.publicado_em) - new Date(a.publicado_em)).slice(0, 5);

  featured.innerHTML = `<section class="news-cover" aria-labelledby="news-cover-title">
    ${renderBreaking(allNews)}
    <div class="news-cover-heading">
      <div>
        <p class="eyebrow">Capa editorial</p>
        <h2 id="news-cover-title">O que movimenta Urânia agora</h2>
      </div>
      <a href="#news-feed-title">Ver todas as notícias</a>
    </div>
    <div class="news-cover-grid">
      <div class="news-cover-main">
        ${leadCard(lead)}
        ${supporting.length ? `<div class="news-cover-support">${supporting.map((item) => compactCard(item, "Atualização recente")).join("")}</div>` : ""}
      </div>
      <aside class="news-cover-sidebar" aria-label="Resumo da capa de notícias">
        <section class="news-sidebar-block news-digest-card">
          <p class="eyebrow">Agora na redação</p>
          <h3>Resumo rápido</h3>
          <div class="news-headline-list">${headlines.map(headlineItem).join("")}</div>
        </section>
        <section class="news-sidebar-block news-popular-card">
          <p class="eyebrow">Mais lidas</p>
          <h3>Em alta</h3>
          <div class="news-popular-list">${popular.map(popularItem).join("")}</div>
        </section>
      </aside>
    </div>
  </section>`;
}

function renderFilters(items) {
  const categories = [...new Set(items.map((item) => item.categoria_nome).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  filters.innerHTML = [["", "Todas"], ...categories.map((category) => [category, category])].map(([value, label], index) => `<button type="button" class="news-filter ${index === 0 ? "active" : ""}" data-category="${esc(value)}" aria-pressed="${index === 0 ? "true" : "false"}">${esc(label)}</button>`).join("");
}

function filteredNews() {
  const term = normalize(search.value.trim());
  return feed.filter((item) => {
    const categoryMatch = !selectedCategory || item.categoria_nome === selectedCategory;
    const contentMatch = !term || normalize(`${item.titulo} ${item.resumo || ""} ${item.categoria_nome || ""}`).includes(term);
    return categoryMatch && contentMatch;
  });
}

function newsCard(item) {
  const text = summary(item);
  const url = newsUrl(item.slug);
  return `<article class="news-item">
    <a class="news-item-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="lazy" decoding="async"></a>
    <div class="content">
      <p class="news-item-meta"><span>${categoryLink(item.categoria_nome)}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p>
      <h3><a href="${url}">${esc(item.titulo)}</a></h3>
      ${text ? `<p class="news-item-summary">${esc(shortText(text, 160))}</p>` : ""}
      <a href="${url}" class="news-item-action"><span>Ler notícia</span><span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function renderFeed() {
  const items = filteredNews();
  const visible = items.slice(0, visibleCount);
  resultsCount.textContent = items.length === 1 ? "1 notícia encontrada" : `${items.length} notícias encontradas`;
  container.innerHTML = visible.length ? `<div class="news-card-grid">${visible.map(newsCard).join("")}</div>` : '<div class="empty-state news-empty"><strong>Nenhuma notícia encontrada.</strong><p>Tente outro termo ou escolha uma categoria diferente.</p></div>';
  loadMore.hidden = visible.length >= items.length;
  clearFilters.hidden = !selectedCategory && !search.value.trim();
}

function renderPolicyLinks() {
  if (document.querySelector(".news-policy-links")) return;
  const feedSection = document.querySelector(".news-feed");
  if (!feedSection?.parentElement) return;
  feedSection.insertAdjacentHTML("afterend", `
    <section class="news-policy-links" aria-labelledby="news-policy-title">
      <p class="eyebrow">Transparência</p>
      <h2 id="news-policy-title">Como publicamos informações</h2>
      <p>Consulte nossos critérios editoriais, políticas de correção, direito de resposta, publicidade, fontes e canais de contato.</p>
      <div class="policy-links-grid">
        <a href="/news/sobre-publicacoes/">Sobre nossas publicações</a>
        <a href="/news/politica-editorial/">Política Editorial</a>
        <a href="/news/correcoes-transparencia-contato/">Correções e transparência</a>
      </div>
    </section>
  `);
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  visibleCount = PAGE_SIZE;
  filters.querySelectorAll("[data-category]").forEach((item) => {
    const active = item === button;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderFeed();
});

search.addEventListener("input", () => { visibleCount = PAGE_SIZE; renderFeed(); });
searchForm.addEventListener("submit", (event) => { event.preventDefault(); renderFeed(); });
loadMore.addEventListener("click", () => { visibleCount += PAGE_SIZE; renderFeed(); });
document.addEventListener("click", (event) => {
  if (!event.target.closest("#news-clear-filters")) return;
  selectedCategory = "";
  search.value = "";
  visibleCount = PAGE_SIZE;
  filters.querySelectorAll("[data-category]").forEach((item) => {
    const active = !item.dataset.category;
    item.classList.toggle("active", active);
    item.setAttribute("aria-pressed", String(active));
  });
  renderFeed();
  search.focus();
});

async function carregarNoticias() {
  if (!publicSupabaseConfigured()) {
    status.textContent = "Configure o Supabase para carregar as notícias.";
    return;
  }
  try {
    const news = await fetchPublicRows("noticias", {
      select: "id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em,destaque,visualizacoes",
      status: "eq.publicado",
      publicado_em: `lte.${new Date().toISOString()}`,
      order: "publicado_em.desc",
    });
    if (!news.length) {
      status.textContent = "Nenhuma notícia publicada.";
      return;
    }
    allNews = news;
    const lead = news.find((item) => item.destaque) || news[0];
    const featuredItems = [lead, ...news.filter((item) => item.id !== lead.id)].slice(0, 6);
    const highlightedIds = new Set(featuredItems.slice(0, 3).map((item) => item.id));
    feed = news.filter((item) => !highlightedIds.has(item.id));
    renderFeatured(featuredItems);
    renderFilters(news);
    renderFeed();
    renderPolicyLinks();
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar as notícias. Tente novamente mais tarde.";
  }
}

carregarNoticias();
