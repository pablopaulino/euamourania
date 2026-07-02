import { searchPortal, searchTypeCounts } from "../services/searchService.js";

const form = document.getElementById("portal-search-form");
const input = document.getElementById("portal-search-input");
const filters = document.getElementById("portal-search-filters");
const count = document.getElementById("portal-search-count");
const resultsContainer = document.getElementById("portal-search-results");
const loadMore = document.getElementById("portal-search-more");
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const types = [
  ["", "Tudo"],
  ["noticia", "Notícias"],
  ["guia", "Guia"],
  ["turismo", "Turismo"],
  ["evento", "Eventos"]
];
const PAGE_SIZE = 24;
let allResults = [];
let selectedType = "";
let visible = PAGE_SIZE;
let currentQuery = "";

function dateLabel(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value));
  } catch {
    return "";
  }
}

function resultCard(item) {
  const meta = [item.category, item.meta, dateLabel(item.date)].filter(Boolean).slice(0, 2).join(" · ");
  return `<a class="search-result-card" href="${esc(item.url)}"><span class="search-result-media">${item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy" decoding="async">` : esc(item.typeLabel)}</span><span class="search-result-body"><span class="search-result-kind">${esc(item.typeLabel)}${meta ? ` · ${esc(meta)}` : ""}</span><h2>${esc(item.title)}</h2>${item.description ? `<span class="search-result-description">${esc(item.description)}</span>` : ""}<span class="search-result-action">${esc(item.actionLabel)} <span aria-hidden="true">→</span></span></span></a>`;
}

function filtered() {
  return selectedType ? allResults.filter(item => item.type === selectedType) : allResults;
}

function renderFilters() {
  const counts = searchTypeCounts(allResults);
  filters.innerHTML = types.map(([value, label]) => {
    const total = value ? counts[value] : allResults.length;
    return `<button class="search-filter ${selectedType === value ? "active" : ""}" type="button" data-search-type="${value}" aria-pressed="${selectedType === value}">${esc(label)} <span>${total}</span></button>`;
  }).join("");
}

function render() {
  const items = filtered();
  const shown = items.slice(0, visible);
  count.textContent = items.length === 1 ? "1 resultado encontrado" : `${items.length} resultados encontrados`;
  if (!shown.length) {
    resultsContainer.innerHTML = `<div class="search-empty"><h2>Nenhum resultado encontrado</h2><p>Tente uma palavra mais curta, outro nome ou selecione “Tudo”.</p></div>`;
  } else {
    resultsContainer.innerHTML = shown.map(resultCard).join("");
  }
  loadMore.hidden = shown.length >= items.length;
}

async function runSearch(query, { updateUrl = true } = {}) {
  currentQuery = query.trim();
  visible = PAGE_SIZE;
  selectedType = "";
  if (currentQuery.length < 2) {
    document.title = "Busca | Eu Amo Urânia";
    filters.innerHTML = "";
    count.textContent = "";
    resultsContainer.innerHTML = '<div class="search-empty"><h2>O que você procura?</h2><p>Pesquise uma notícia, empresa, ponto turístico ou evento de Urânia.</p></div>';
    loadMore.hidden = true;
    return;
  }
  if (updateUrl) history.replaceState({}, "", `/buscar.html?q=${encodeURIComponent(currentQuery)}`);
  document.title = `${currentQuery} — Busca | Eu Amo Urânia`;
  count.textContent = "Buscando em todo o portal…";
  resultsContainer.setAttribute("aria-busy", "true");
  resultsContainer.innerHTML = '<div class="search-empty"><p>Consultando notícias, empresas, turismo e eventos…</p></div>';
  try {
    allResults = await searchPortal(currentQuery, { limit: 500 });
    renderFilters();
    render();
  } catch {
    filters.innerHTML = "";
    count.textContent = "";
    resultsContainer.innerHTML = '<div class="search-empty"><h2>Busca temporariamente indisponível</h2><p>Tente novamente em alguns instantes.</p></div>';
  } finally {
    resultsContainer.removeAttribute("aria-busy");
  }
}

filters.addEventListener("click", event => {
  const button = event.target.closest("[data-search-type]");
  if (!button) return;
  selectedType = button.dataset.searchType;
  visible = PAGE_SIZE;
  renderFilters();
  render();
});

form.addEventListener("submit", event => {
  event.preventDefault();
  runSearch(input.value);
});

loadMore.addEventListener("click", () => {
  visible += PAGE_SIZE;
  render();
});

const initialQuery = new URLSearchParams(location.search).get("q") || "";
input.value = initialQuery;
runSearch(initialQuery, { updateUrl: false });
