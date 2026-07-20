import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("turismo-container");
const status = document.getElementById("turismo-status");
const search = document.getElementById("turismo-busca");
const total = document.getElementById("turismo-total");
const results = document.getElementById("turismo-results");
const empty = document.getElementById("turismo-empty");
const PAGE_SIZE = 4;
const loadStatus = document.createElement("p");
const loadMore = document.createElement("button");
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeImage = value => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return escapeHtml(raw);
  if (/^\/?assets\//i.test(raw)) return escapeHtml(raw.startsWith("/") ? raw : `/${raw}`);
  return "/assets/Design sem nome (9).png";
};
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const icons = {
  pin:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};
let allItems = [];
let visibleCount = PAGE_SIZE;
let filteredItems = [];
let isLoadingMore = false;

loadMore.id = "turismo-ver-mais";
loadMore.className = "news-load-more tourism-load-more";
loadMore.type = "button";
loadMore.textContent = "Ver mais lugares";
loadMore.hidden = true;
loadStatus.className = "load-more-status tourism-load-status";
loadStatus.setAttribute("aria-live", "polite");
container?.insertAdjacentElement("afterend", loadMore);
loadMore.insertAdjacentElement("afterend", loadStatus);

function updateLoadState(visibleLength) {
  loadMore.hidden = visibleLength >= filteredItems.length;
  loadStatus.textContent = !filteredItems.length
    ? ""
    : loadMore.hidden
      ? "Você chegou ao fim da lista."
      : "";
}

function tourismCard(item,index) {
  const url = `/turismo/${encodeURIComponent(item.slug)}`;
  const description = String(item.descricao || "").trim();
  const category = String(item.categoria_nome || item.categoria || "Turismo").trim();
  const mapsUrl = item.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.endereco)}` : "";
  return `<article class="card-guia tourism-card" data-tourism-id="${escapeHtml(item.id)}"${item.destaque ? ' data-tourism-featured="true"' : ""}>
    <a class="tourism-card-media" href="${url}" aria-label="Conhecer ${escapeHtml(item.nome)}">
      <img src="${safeImage(item.imagem_url)}" class="card-img-top" alt="${escapeHtml(item.nome)}" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
      ${item.destaque ? '<span class="badge-destaque">Destaque</span>' : ""}
    </a>
    <div class="tourism-card-body">
      <p class="tourism-card-kicker">${escapeHtml(category)}</p>
      <h2 class="tourism-card-title"><a href="${url}">${escapeHtml(item.nome)}</a></h2>
      ${description ? `<p class="card-text">${escapeHtml(description)}</p>` : ""}
      <div class="tourism-card-details">
        ${item.endereco ? `<p>${icons.pin}<span><small>Localização</small>${escapeHtml(item.endereco)}</span></p>` : ""}
        ${item.horario ? `<p>${icons.clock}<span><small>Quando visitar</small>${escapeHtml(item.horario)}</span></p>` : ""}
      </div>
      <div class="tourism-card-actions">
        <a href="${url}" class="tourism-card-action primary"><span>Ver detalhes</span><span aria-hidden="true">→</span></a>
        ${mapsUrl ? `<a href="${mapsUrl}" class="tourism-card-action secondary" target="_blank" rel="noopener noreferrer"><span>Como chegar</span></a>` : ""}
      </div>
    </div>
  </article>`;
}

function renderTourism() {
  const term = normalize(search?.value);
  filteredItems = allItems.filter(item => !term || normalize(`${item.nome} ${item.descricao} ${item.endereco} ${item.horario} ${item.categoria_nome || item.categoria || ""}`).includes(term));
  const visible = filteredItems.slice(0, visibleCount);
  container.innerHTML = visible.map(tourismCard).join("");
  empty.hidden = Boolean(filteredItems.length);
  results.textContent = term ? `${filteredItems.length} ${filteredItems.length === 1 ? "lugar encontrado" : "lugares encontrados"} para sua busca.` : "";
  updateLoadState(visible.length);
  document.dispatchEvent(new CustomEvent("turismo:renderizado"));
}

function loadNextTourism(scroll = false) {
  if (loadMore.hidden || isLoadingMore) return;
  isLoadingMore = true;
  document.body.classList.add("tourism-auto-load", "is-loading-more");
  loadStatus.textContent = "Carregando mais lugares...";
  window.setTimeout(() => {
    const previousCount = visibleCount;
    visibleCount = Math.min(visibleCount + PAGE_SIZE, filteredItems.length);
    const nextItems = filteredItems.slice(previousCount, visibleCount);
    if (nextItems.length) {
      container.insertAdjacentHTML("beforeend", nextItems.map((item, index) => tourismCard(item, previousCount + index)).join(""));
    }
    updateLoadState(visibleCount);
    document.dispatchEvent(new CustomEvent("turismo:renderizado"));
    document.body.classList.remove("is-loading-more");
    isLoadingMore = false;
    if (scroll) {
      container.querySelector(".tourism-card:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, 140);
}

search?.addEventListener("input", () => {
  visibleCount = PAGE_SIZE;
  renderTourism();
});
loadMore.addEventListener("click", () => loadNextTourism(true));

if ("IntersectionObserver" in window) {
  document.body.classList.add("tourism-auto-load");
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || isLoadingMore || loadMore.hidden) return;
    loadNextTourism(false);
  }, { rootMargin: "260px 0px" });
  observer.observe(loadMore);
}

async function carregarTurismo() {
  if (!publicSupabaseConfigured()) { status.textContent = "Configure o Supabase para carregar os pontos turísticos."; return; }
  try {
    const itens = await fetchPublicRows("turismo", {
      select: "id,nome,slug,descricao,imagem_url,endereco,horario,destaque,categoria_nome",
      status: "eq.publicado",
      order: "destaque.desc,nome.asc"
    });
    if (!itens.length) { status.textContent = "Nenhum ponto turístico publicado."; return; }
    allItems = itens;
    total.textContent = String(itens.length);
    visibleCount = PAGE_SIZE;
    status.hidden = true;
    renderTourism();
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar os pontos turísticos.";
  }
}
carregarTurismo();
