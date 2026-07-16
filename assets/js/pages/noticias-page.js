import { formatarData, textoPuro } from "../utils.js";
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
const PAGE_SIZE = 8;

let feed = [];
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

function secondaryCard(item) {
  const url = newsUrl(item.slug);
  return `<article class="news-secondary"><a class="news-secondary-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="eager" decoding="async"></a><div class="news-secondary-content"><p class="news-secondary-meta"><span>${esc(item.categoria_nome || "Urânia")}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3><a class="news-secondary-action" href="${url}">Ler notícia <span aria-hidden="true">→</span></a></div></article>`;
}

function leadCard(item, index = 0) {
  const text = summary(item);
  const url = newsUrl(item.slug);
  return `<article class="news-lead ${index === 0 ? "primary" : ""}"><a class="news-lead-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="eager"'} decoding="async"></a><div class="news-lead-content"><span class="news-lead-label">${index === 0 ? "Manchete principal" : "Também em destaque"}</span><p class="eyebrow">${esc(item.categoria_nome || "Urânia")}</p><h2><a href="${url}">${esc(item.titulo)}</a></h2><p class="news-lead-date">${esc(formatarData(item.publicado_em))}</p>${text ? `<p class="news-lead-summary">${esc(text.slice(0, 180))}${text.length > 180 ? "…" : ""}</p>` : ""}<a class="news-lead-action" href="${url}"><span>Ler notícia</span><span aria-hidden="true">→</span></a></div></article>`;
}

function renderFeatured(items = []) {
  const leads = items.slice(0, 2);
  const secondary = items.slice(2, 5);
  const breaking = items.slice(0, 4);
  featured.innerHTML = `<section class="news-top-stories" aria-labelledby="top-stories-title"><div class="news-breaking-strip"><span>Plantão local</span><div>${breaking.map((item) => `<a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a>`).join("")}</div></div><div class="news-top-heading"><div><p class="eyebrow">Redação Eu Amo Urânia</p><h2 id="top-stories-title">O que movimenta Urânia agora</h2></div><a href="#news-feed-title" class="news-top-link">Ver todas as matérias</a></div><div class="news-portal-grid"><div class="news-featured-main">${leads.map(leadCard).join("")}</div>${secondary.length ? `<div class="news-secondary-stack">${secondary.map(secondaryCard).join("")}</div>` : ""}</div></section>`;
}

function weatherDescription(code) {
  if (code === 0) return ["Céu limpo", "☀️"];
  if ([1, 2].includes(code)) return ["Parcialmente nublado", "🌤️"];
  if (code === 3) return ["Nublado", "☁️"];
  if ([45, 48].includes(code)) return ["Neblina", "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Garoa", "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Chuva", "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Precipitação gelada", "🌨️"];
  if ([95, 96, 99].includes(code)) return ["Trovoadas", "⛈️"];
  return ["Condição variável", "🌤️"];
}

function buildLocalServiceBar() {
  const masthead = document.querySelector(".news-masthead");
  if (!masthead || document.querySelector(".news-service-bar")) return null;
  masthead.insertAdjacentHTML("afterend", `<section class="news-service-bar" aria-label="Informações locais"><div class="container news-service-layout"><div class="news-today"><span>Agora em Urânia</span><time id="news-current-date"></time></div><div id="news-weather" class="news-weather" role="status" aria-live="polite"><span class="weather-icon" aria-hidden="true">☀️</span><span class="weather-copy"><strong>Previsão local</strong><small>Carregando clima…</small></span></div></div></section>`);
  const date = document.getElementById("news-current-date");
  date.textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());
  return document.getElementById("news-weather");
}

async function loadWeather() {
  const widget = buildLocalServiceBar();
  if (!widget) return;
  const cacheKey = "euamourania-weather-v1";
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    let data = cached?.expires > Date.now() ? cached.data : null;
    if (!data) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=-20.24611&longitude=-50.64306&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FSao_Paulo&forecast_days=1", { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error("weather-unavailable");
      data = await response.json();
      sessionStorage.setItem(cacheKey, JSON.stringify({ expires: Date.now() + 15 * 60 * 1000, data }));
    }
    const [description, icon] = weatherDescription(data.current?.weather_code);
    const current = Math.round(data.current?.temperature_2m);
    const minimum = Math.round(data.daily?.temperature_2m_min?.[0]);
    const maximum = Math.round(data.daily?.temperature_2m_max?.[0]);
    widget.innerHTML = `<span class="weather-icon" aria-hidden="true">${icon}</span><span class="weather-copy"><strong>${Number.isFinite(current) ? `${current}° em Urânia` : "Clima em Urânia"}</strong><small>${description}${Number.isFinite(minimum) && Number.isFinite(maximum) ? ` · mín. ${minimum}° / máx. ${maximum}°` : ""}</small></span>`;
  } catch {
    widget.innerHTML = '<span class="weather-icon" aria-hidden="true">🌤️</span><span class="weather-copy"><strong>Clima em Urânia</strong><small>Previsão indisponível agora</small></span>';
  }
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

function card(item) {
  const text = summary(item);
  const url = newsUrl(item.slug);
  return `<article class="news-item"><a class="news-item-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="lazy" decoding="async"></a><div class="content"><p class="news-item-meta"><span>${esc(item.categoria_nome || "Urânia")}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3>${text ? `<p class="news-item-summary">${esc(text.slice(0, 155))}${text.length > 155 ? "…" : ""}</p>` : ""}<a href="${url}" class="news-item-action"><span>Ler notícia</span><span aria-hidden="true">→</span></a></div></article>`;
}

function streamCard(item, index = 0) {
  const text = summary(item);
  const url = newsUrl(item.slug);
  const label = index === 0 ? "Mais recente" : (item.categoria_nome || "Urânia");
  const limit = index === 0 ? 210 : 125;
  return `<article class="news-stream-card ${index === 0 ? "is-latest" : ""}"><a class="news-stream-media" href="${url}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="lazy" decoding="async"></a><div class="news-stream-content"><p class="news-stream-meta"><span>${esc(label)}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${url}">${esc(item.titulo)}</a></h3>${text ? `<p>${esc(text.slice(0, limit))}${text.length > limit ? "…" : ""}</p>` : ""}<a class="news-stream-action" href="${url}">Abrir matéria <span aria-hidden="true">→</span></a></div></article>`;
}

function renderFeed() {
  const items = filteredNews();
  const visible = items.slice(0, visibleCount);
  resultsCount.textContent = items.length === 1 ? "1 notícia encontrada" : `${items.length} notícias encontradas`;
  const streamItems = visible.slice(0, 5);
  const regularCards = visible.slice(5);
  container.innerHTML = visible.length ? `<div class="news-stream">${streamItems.map(streamCard).join("")}</div>${regularCards.length ? `<div class="news-card-grid">${regularCards.map(card).join("")}</div>` : ""}` : '<div class="empty-state news-empty"><strong>Nenhuma notícia encontrada.</strong><p>Tente outro termo ou escolha uma categoria diferente.</p></div>';
  loadMore.hidden = visible.length >= items.length;
  clearFilters.hidden = !selectedCategory && !search.value.trim();
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
      select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque",
      status: "eq.publicado",
      publicado_em: `lte.${new Date().toISOString()}`,
      order: "publicado_em.desc",
    });
    if (!news.length) {
      status.textContent = "Nenhuma notícia publicada.";
      return;
    }
    const lead = news.find((item) => item.destaque) || news[0];
    const featuredItems = [lead, ...news.filter((item) => item.id !== lead.id)].slice(0, 5);
    const highlightedIds = new Set(featuredItems.map((item) => item.id));
    feed = news.filter((item) => !highlightedIds.has(item.id));
    renderFeatured(featuredItems);
    renderFilters(feed);
    renderFeed();
    status.hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar as notícias. Tente novamente mais tarde.";
  }
}

loadWeather();
carregarNoticias();
