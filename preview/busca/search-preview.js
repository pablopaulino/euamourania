import { searchPortal, searchTypeCounts } from "/assets/js/services/searchService.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

const form = document.getElementById("portal-search-form");
const input = document.getElementById("portal-search-input");
const filters = document.getElementById("portal-search-filters");
const count = document.getElementById("portal-search-count");
const results = document.getElementById("portal-search-results");
const loadMore = document.getElementById("portal-search-more");
const title = document.getElementById("search-title");
const intro = document.getElementById("search-intro");
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const types = [["", "Tudo"], ["noticia", "Notícias"], ["guia", "Guia"], ["turismo", "Turismo"], ["evento", "Eventos"], ["pagina", "Páginas"]];
const PAGE_SIZE = 20;
let allResults = [], selectedType = "", visible = PAGE_SIZE, currentQuery = "";

function dateLabel(value) {
  if (!value) return "";
  try { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
  catch { return ""; }
}

function previewUrl(item) {
  const parts = String(item.url || "").split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
  if (item.type === "noticia" && parts[0] === "noticias" && parts[1]) return `/preview/noticias/materia/?slug=${encodeURIComponent(parts[1])}`;
  if (item.type === "guia" && parts[0] === "guia" && parts[1]) return `/preview/guia/empresa/?slug=${encodeURIComponent(parts[1])}`;
  if (item.type === "turismo" && parts[0] === "turismo" && parts[1]) return `/preview/turismo/local/?slug=${encodeURIComponent(parts[1])}`;
  if (item.type === "evento" && parts[0] === "eventos" && parts[1] === "agenda" && parts[2]) return `/preview/agenda/evento/?slug=${encodeURIComponent(parts[2])}`;
  if (item.type === "evento" && parts[0] === "eventos" && parts[1] && parts[2]) return `/preview/agenda/edicao/?slug=${encodeURIComponent(parts[1])}&ano=${encodeURIComponent(parts[2])}`;
  if (item.type === "evento" && parts[0] === "eventos" && parts[1]) return `/preview/agenda/tradicao/?slug=${encodeURIComponent(parts[1])}`;
  if (item.url === "/urania/") return "/preview/urania/";
  if (item.url === "/melhores-de-urania/") return "/preview/melhores/";
  if (item.url === "/quem-somos.html") return "/preview/quem-somos/";
  if (item.url === "/colabore/") return "/preview/colabore/";
  if (item.url === "/divulgue" || item.url === "/divulgue/") return "/preview/divulgue/";
  return item.url;
}

function card(item) {
  const meta = [item.typeLabel, item.category, dateLabel(item.date)].filter(Boolean).join(" · ");
  return `<a class="search-result" href="${esc(previewUrl(item))}"><span class="search-result-media">${item.image ? `<img src="${esc(item.image)}" alt="" width="260" height="210" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='/assets/compartilhamento-logo.png';this.classList.add('is-fallback')">` : esc(item.typeLabel)}</span><span class="search-result-copy"><span class="search-result-kind">${esc(meta)}</span><h3>${esc(item.title)}</h3>${item.description ? `<span class="search-result-description">${esc(item.description)}</span>` : ""}</span><span class="search-result-arrow">→</span></a>`;
}

function filtered() { return selectedType ? allResults.filter(item => item.type === selectedType) : allResults; }
function renderFilters() {
  const counts = searchTypeCounts(allResults);
  filters.innerHTML = types.map(([value, label]) => `<button class="search-filter ${selectedType === value ? "active" : ""}" type="button" data-search-type="${value}" aria-pressed="${selectedType === value}">${label} <span>${value ? counts[value] || 0 : allResults.length}</span></button>`).join("");
}
function render() {
  const items = filtered();
  const shown = items.slice(0, visible);
  count.textContent = items.length === 1 ? "1 resultado encontrado" : `${items.length} resultados encontrados`;
  results.innerHTML = shown.length ? shown.map(card).join("") : '<div class="search-empty"><h3>Nada encontrado por aqui.</h3><p>Tente uma palavra mais curta, outro nome ou selecione “Tudo”.</p></div>';
  loadMore.hidden = shown.length >= items.length;
}

async function runSearch(query, updateUrl = true) {
  currentQuery = query.trim(); visible = PAGE_SIZE; selectedType = "";
  if (currentQuery.length < 2) {
    title.textContent = "O que você procura?";
    intro.textContent = "Notícias, empresas, lugares, eventos e informações da cidade em uma única busca.";
    filters.innerHTML = ""; count.textContent = "";
    results.innerHTML = '<div class="search-empty"><h3>Comece pela cidade.</h3><p>Digite pelo menos duas letras para encontrar tudo o que o Eu Amo Urânia reúne.</p></div>';
    loadMore.hidden = true; input.focus(); return;
  }
  if (updateUrl) history.replaceState({}, "", `/preview/busca/?q=${encodeURIComponent(currentQuery)}`);
  title.innerHTML = `Resultados para <span>“${esc(currentQuery)}”</span>`;
  intro.textContent = "Pesquisando notícias, empresas, lugares, eventos e páginas da plataforma.";
  document.title = `${currentQuery} — Busca | Eu Amo Urânia`;
  count.textContent = "Buscando em todo o portal…";
  results.setAttribute("aria-busy", "true");
  results.innerHTML = '<div class="search-empty"><p>Consultando o Eu Amo Urânia…</p></div>';
  try { allResults = await searchPortal(currentQuery, { limit: 500 }); renderFilters(); render(); }
  catch (error) { console.error("Busca:", error); filters.innerHTML = ""; count.textContent = ""; results.innerHTML = '<div class="search-empty"><h3>Busca temporariamente indisponível.</h3><p>Tente novamente em alguns instantes.</p></div>'; }
  finally { results.removeAttribute("aria-busy"); }
}

filters.addEventListener("click", event => { const button = event.target.closest("[data-search-type]"); if (!button) return; selectedType = button.dataset.searchType; visible = PAGE_SIZE; renderFilters(); render(); });
form.addEventListener("submit", event => { event.preventDefault(); runSearch(input.value); });
loadMore.addEventListener("click", () => { visible += PAGE_SIZE; render(); });

function setupChrome() {
  const header = document.querySelector(".site-header"), menu = document.getElementById("menu-principal"), toggle = header?.querySelector(".menu-toggle"), trigger = header?.querySelector(".search-trigger"), headerInput = document.getElementById("header-search-input");
  const close = () => { header?.classList.remove("search-open"); trigger?.setAttribute("aria-expanded", "false"); };
  trigger?.addEventListener("click", () => { menu?.classList.remove("is-open"); toggle?.setAttribute("aria-expanded", "false"); header?.classList.add("search-open"); trigger.setAttribute("aria-expanded", "true"); setTimeout(() => headerInput?.focus(), 180); });
  toggle?.addEventListener("click", () => { close(); const open = toggle.getAttribute("aria-expanded") !== "true"; toggle.setAttribute("aria-expanded", String(open)); menu?.classList.toggle("is-open", open); });
  header?.querySelector(".header-search-close")?.addEventListener("click", close);
  document.getElementById("year").textContent = new Date().getFullYear();
  getAppDownloadConfig().then(app => document.querySelectorAll("[data-app-download]").forEach(link => { link.href = app.googlePlayUrl || app.appStoreUrl || app.appPageUrl || "/app.html"; })).catch(() => {});
}

setupChrome();
const initialQuery = new URLSearchParams(location.search).get("q") || "";
input.value = initialQuery;
runSearch(initialQuery, false);
Promise.allSettled([import("/assets/js/pages/site-config-page.js"), import("/assets/js/pages/analytics-page.js"), import("/assets/js/pages/google-analytics-page.js"), import("/assets/js/pages/error-monitor.js")]);
