import { searchPortal } from "../services/searchService.js";

const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
})[char]);
const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m16.5 16.5 4 4"></path></svg>';
let lastTrigger;
let debounceTimer;
let requestNumber = 0;

function ensureStyles() {
  if (document.querySelector('link[href*="global-search.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/global-search.css";
  document.head.appendChild(link);
}

function ensureTrigger() {
  const list = document.querySelector(".main-nav ul");
  if (list) {
    if (list.querySelector("[data-open-global-search]")) return;
    list.insertAdjacentHTML("beforeend", `<li class="global-search-nav"><button class="global-search-trigger" type="button" data-open-global-search aria-haspopup="dialog" aria-controls="global-search-dialog" aria-expanded="false">${searchIcon}<span>Buscar</span></button></li>`);
    return;
  }
  const linksPage = document.querySelector(".links-container");
  if (linksPage && !linksPage.querySelector("[data-open-global-search]")) {
    const back = linksPage.querySelector(".links-back");
    back?.insertAdjacentHTML("beforebegin", `<button class="global-search-trigger" type="button" data-open-global-search aria-haspopup="dialog" aria-controls="global-search-dialog" aria-expanded="false">${searchIcon}<span>Buscar no portal</span></button>`);
  }
}

function createDialog() {
  if (document.getElementById("global-search-dialog")) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="global-search-dialog" id="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title" hidden><div class="global-search-backdrop" data-close-global-search></div><section class="global-search-panel"><div class="global-search-head"><p id="global-search-title">Buscar no Eu Amo Urânia</p><button class="global-search-close" type="button" data-close-global-search aria-label="Fechar busca">×</button></div><form class="global-search-form" action="/buscar" method="get" role="search"><div class="global-search-input-wrap">${searchIcon}<label class="sr-only" for="global-search-input">O que você procura?</label><input id="global-search-input" name="q" type="search" placeholder="Notícia, empresa, lugar, evento ou página…" autocomplete="off" minlength="2" required aria-controls="global-search-results"></div><button class="button button-primary" type="submit">Buscar</button></form><div class="global-search-results" id="global-search-results" aria-live="polite"><p class="global-search-message">Digite pelo menos duas letras para começar.</p></div></section></div>`);
}

function resultMeta(item) {
  if (item.date) {
    try {
      return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(item.date));
    } catch {}
  }
  return item.category || item.meta || "";
}

function renderResults(results, query) {
  const container = document.getElementById("global-search-results");
  if (!results.length) {
    container.innerHTML = `<p class="global-search-message">Nenhum resultado para “${esc(query)}”. Tente outra palavra.</p>`;
    return;
  }
  container.innerHTML = `${results.slice(0, 8).map((item) => `<a class="global-search-suggestion" href="${esc(item.url)}"><span class="global-search-thumb">${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" decoding="async">` : esc(item.typeLabel)}</span><span class="global-search-copy"><span class="global-search-kind">${esc(item.typeLabel)}</span><span class="global-search-title">${esc(item.title)}</span><span class="global-search-meta">${esc(resultMeta(item))}</span></span><span class="global-search-arrow" aria-hidden="true">→</span></a>`).join("")}<a class="global-search-all" href="/buscar?q=${encodeURIComponent(query)}"><span>Ver todos os ${results.length} resultados</span><span aria-hidden="true">→</span></a>`;
}

async function updateSuggestions(input) {
  const query = input.value.trim();
  const container = document.getElementById("global-search-results");
  if (query.length < 2) {
    container.innerHTML = '<p class="global-search-message">Digite pelo menos duas letras para começar.</p>';
    return;
  }
  const currentRequest = ++requestNumber;
  container.setAttribute("aria-busy", "true");
  container.innerHTML = '<p class="global-search-message">Buscando em notícias, guia, turismo, eventos e páginas…</p>';
  try {
    const results = await searchPortal(query, { limit: 30 });
    if (currentRequest === requestNumber) renderResults(results, query);
  } catch (error) {
    console.error("Busca global:", error);
    if (currentRequest === requestNumber) container.innerHTML = '<p class="global-search-message">A busca está temporariamente indisponível. Tente novamente.</p>';
  } finally {
    if (currentRequest === requestNumber) container.removeAttribute("aria-busy");
  }
}

function openSearch(trigger) {
  const dialog = document.getElementById("global-search-dialog");
  lastTrigger = trigger;
  dialog.hidden = false;
  document.body.classList.add("global-search-open");
  document.querySelectorAll("[data-open-global-search]").forEach((button) => button.setAttribute("aria-expanded", "true"));
  document.querySelector(".main-nav")?.classList.remove("is-open");
  document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
  requestAnimationFrame(() => document.getElementById("global-search-input")?.focus());
}

function closeSearch() {
  const dialog = document.getElementById("global-search-dialog");
  if (!dialog || dialog.hidden) return;
  dialog.hidden = true;
  document.body.classList.remove("global-search-open");
  document.querySelectorAll("[data-open-global-search]").forEach((button) => button.setAttribute("aria-expanded", "false"));
  lastTrigger?.focus();
}

function init() {
  ensureStyles();
  ensureTrigger();
  createDialog();
  window.addEventListener("siteconfig:ready", ensureTrigger);
  const navigation = document.querySelector(".main-nav");
  if (navigation) new MutationObserver(ensureTrigger).observe(navigation, { childList: true, subtree: true });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-global-search]");
    if (trigger) {
      openSearch(trigger);
      return;
    }
    if (event.target.closest("[data-close-global-search]")) closeSearch();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSearch();
  });
  const input = document.getElementById("global-search-input");
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => updateSuggestions(input), 180);
  });
  document.querySelector(".global-search-form").addEventListener("submit", (event) => {
    if (input.value.trim().length < 2) {
      event.preventDefault();
      input.focus();
    }
  });
}

init();
