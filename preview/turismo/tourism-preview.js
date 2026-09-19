import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";
import "/preview/guia/banners-preview.js";

const container = document.getElementById("turismo-container");
const status = document.getElementById("turismo-status");
const results = document.getElementById("turismo-results");
const empty = document.getElementById("turismo-empty");
const search = document.getElementById("turismo-busca");
const loadMore = document.getElementById("turismo-ver-mais");
const loadStatus = document.getElementById("tourism-load-status");
const sentinel = document.getElementById("tourism-load-sentinel");
const heroImage = document.getElementById("tourism-hero-image");
const PAGE_SIZE = 6;
let allItems = [];
let filteredItems = [];
let visibleCount = PAGE_SIZE;
let loadingMore = false;
let categoryNames = new Map();

const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const safeImage = value => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return esc(raw);
  if (/^\/?assets\//i.test(raw)) return esc(raw.startsWith("/") ? raw : `/${raw}`);
  return "/assets/Design sem nome (9).png";
};
const safeHttp = value => /^https?:\/\//i.test(value || "") ? esc(value) : "";
const compact = (value = "", length = 112) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
const icons = {
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.8"></circle><path d="m16 16 4.2 4.2"></path></svg>',
  pin:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  route:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></svg>'
};

function mapUrl(item) {
  if (safeHttp(item.mapa_url)) return safeHttp(item.mapa_url);
  if (!item.endereco) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([item.nome, item.endereco, "Urânia SP"].filter(Boolean).join(" "))}`;
}

function categoryOf(item) {
  return String(categoryNames.get(item.categoria_id) || item.categoria_nome || item.categoria || "Turismo").trim();
}

function compactLocation(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  const parts = value.split(/[,·|-]/).map(part => part.trim()).filter(Boolean);
  return compact(parts.slice(0, 2).join(", ") || value, 48);
}

function cardMarkup(item, index) {
  const detail = `/preview/turismo/local/?slug=${encodeURIComponent(item.slug || item.id)}`;
  const image = safeImage(item.imagem_url);
  const description = compact(item.descricao, 118);
  const route = mapUrl(item);
  const location = compactLocation(item.endereco);
  const hours = compact(item.horario, 48);
  return `<article class="tourism-card-preview card-guia" data-tourism-id="${esc(item.id)}"${item.destaque ? ' data-tourism-featured="true"' : ""}>
    <a class="tourism-card-photo" href="${detail}" aria-label="Conhecer ${esc(item.nome)}">
      <img src="${image}" alt="${esc(item.nome)}" width="620" height="470" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      ${item.destaque ? '<span class="tourism-featured-badge">Destaque</span>' : ""}
    </a>
    <div class="tourism-card-content">
      <p class="tourism-card-category">${esc(categoryOf(item))}</p>
      <h3><a href="${detail}">${esc(item.nome)}</a></h3>
      ${description ? `<p class="tourism-card-description">${esc(description)}</p>` : ""}
      ${location || hours ? `<div class="tourism-quick-facts">${location ? `<span>${icons.pin}<b>${esc(location)}</b></span>` : ""}${hours ? `<span>${icons.clock}<b>${esc(hours)}</b></span>` : ""}</div>` : ""}
      <div class="tourism-card-actions"><a class="tourism-details-link" href="${detail}">Ver detalhes <span aria-hidden="true">→</span></a>${route ? `<a class="tourism-route-link" href="${route}" target="_blank" rel="noopener" aria-label="Como chegar a ${esc(item.nome)}" title="Como chegar">${icons.route}</a>` : ""}</div>
    </div>
  </article>`;
}

function skeletons() {
  container.innerHTML = Array.from({ length:PAGE_SIZE }, () => '<div class="tourism-skeleton" aria-hidden="true"><i></i><span></span><b></b><em></em></div>').join("");
}

function updateLoadState() {
  const finished = visibleCount >= filteredItems.length;
  loadMore.hidden = "IntersectionObserver" in window || finished;
  sentinel.hidden = finished;
  loadStatus.textContent = !filteredItems.length ? "" : finished ? "Você chegou ao fim dos lugares." : loadingMore ? "Carregando mais lugares…" : "";
}

function render() {
  const term = normalize(search?.value);
  filteredItems = allItems.filter(item => !term || normalize(`${item.nome} ${item.descricao || ""} ${item.endereco || ""} ${item.horario || ""} ${categoryOf(item)}`).includes(term));
  const visible = filteredItems.slice(0, visibleCount);
  container.innerHTML = visible.map(cardMarkup).join("");
  empty.hidden = Boolean(filteredItems.length);
  status.hidden = true;
  results.textContent = term ? `${filteredItems.length} ${filteredItems.length === 1 ? "lugar encontrado" : "lugares encontrados"}.` : "";
  updateLoadState();
  document.dispatchEvent(new CustomEvent("turismo:renderizado"));
}

function loadNext() {
  if (loadingMore || visibleCount >= filteredItems.length) return;
  loadingMore = true;
  updateLoadState();
  requestAnimationFrame(() => {
    const start = visibleCount;
    visibleCount = Math.min(visibleCount + PAGE_SIZE, filteredItems.length);
    const next = filteredItems.slice(start, visibleCount);
    container.insertAdjacentHTML("beforeend", next.map((item, index) => cardMarkup(item, start + index)).join(""));
    loadingMore = false;
    updateLoadState();
    document.dispatchEvent(new CustomEvent("turismo:renderizado"));
  });
}

search?.addEventListener("input", () => { visibleCount = PAGE_SIZE; render(); });
loadMore?.addEventListener("click", loadNext);
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) loadNext(); }, { rootMargin:"420px 0px" });
  observer.observe(sentinel);
}

async function loadTourism() {
  if (!publicSupabaseConfigured()) { status.textContent = "Configure o Supabase para carregar os lugares."; container.innerHTML = ""; return; }
  skeletons();
  try {
    const [items, categories] = await Promise.all([
      fetchPublicRows("turismo", { select:"id,nome,slug,descricao,imagem_url,endereco,horario,mapa_url,destaque,categoria_id,categoria_nome", status:"eq.publicado", order:"destaque.desc,nome.asc" }),
      fetchPublicRows("categorias", { select:"id,nome", tipo:"eq.turismo", status:"eq.ativo", order:"ordem.asc,nome.asc" }, { ttl:180000 }).catch(() => [])
    ]);
    categoryNames = new Map((categories || []).map(item => [item.id, item.nome]));
    allItems = items || [];
    if (!allItems.length) { container.innerHTML = ""; status.textContent = "Nenhum ponto turístico publicado."; return; }
    const visual = allItems.find(item => item.destaque && item.imagem_url) || allItems.find(item => item.imagem_url);
    if (visual && heroImage) { heroImage.src = safeImage(visual.imagem_url); heroImage.alt = visual.nome ? `Vista de ${visual.nome}, em Urânia` : "Turismo em Urânia"; }
    visibleCount = PAGE_SIZE;
    render();
  } catch (error) {
    console.error(error);
    container.innerHTML = "";
    status.textContent = "Não foi possível carregar os lugares agora.";
  }
}

const header = document.querySelector(".site-header");
const menu = document.getElementById("menu-principal");
const menuButton = header?.querySelector(".menu-toggle");
const searchTrigger = header?.querySelector(".search-trigger");
const headerSearch = header?.querySelector(".header-search-form");
const headerSearchInput = document.getElementById("header-search-input");
const closeHeaderSearch = () => { header?.classList.remove("search-open"); searchTrigger?.setAttribute("aria-expanded", "false"); };
searchTrigger?.addEventListener("click", () => { menu?.classList.remove("is-open"); menuButton?.setAttribute("aria-expanded", "false"); header?.classList.add("search-open"); searchTrigger.setAttribute("aria-expanded", "true"); setTimeout(() => headerSearchInput?.focus(), 180); });
menuButton?.addEventListener("click", () => { const open = menuButton.getAttribute("aria-expanded") !== "true"; menuButton.setAttribute("aria-expanded", String(open)); menu?.classList.toggle("is-open", open); });
header?.querySelector(".header-search-close")?.addEventListener("click", closeHeaderSearch);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeHeaderSearch(); });
document.querySelectorAll("#year").forEach(element => { element.textContent = new Date().getFullYear(); });
getAppDownloadConfig().then(app => document.querySelectorAll("[data-app-download]").forEach(link => { link.href = app.googlePlayUrl || app.appStoreUrl || app.appPageUrl || "/app.html"; })).catch(() => {});

function configureNewsletter() {
  const signup = document.querySelector(".newsletter-signup");
  if (!signup || signup.dataset.tourismReady === "true") return Boolean(signup);
  signup.dataset.tourismReady = "true";
  const title = signup.querySelector("h2"), description = signup.querySelector(".newsletter-box > div > p:last-child"), name = signup.querySelector('input[name="nome"]');
  if (title) title.textContent = "Urânia direto no seu e-mail.";
  if (description) description.textContent = "Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";
  if (name) { name.placeholder = "Seu nome"; name.required = true; }
  return true;
}

loadTourism().then(() => Promise.allSettled([
  import("/assets/js/pages/site-config-page.js"), import("/assets/js/pages/analytics-page.js"),
  import("/assets/js/pages/newsletter-public.js"), import("/assets/js/pages/google-analytics-page.js"),
  import("/assets/js/pages/smart-app-banner.js"), import("/assets/js/pages/error-monitor.js")
])).then(() => configureNewsletter());
