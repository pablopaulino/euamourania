import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";
import { registrarEventoSite } from "../services/analyticsService.js";

const compactGrid = document.getElementById("partners-grid");
const featuredGrid = document.getElementById("partners-featured-grid");
const featuredSection = document.getElementById("featured-partners");
const allSection = document.getElementById("all-partners");
const status = document.getElementById("partners-status");
const search = document.getElementById("partners-search");
const category = document.getElementById("partners-category");
const directory = document.querySelector(".viva-partners-directory");
const FALLBACK_IMAGE = "/assets/viva-origem-colorido.svg";
const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const safeImage = value => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return escapeHtml(raw);
  if (/^\/?assets\//i.test(raw)) return escapeHtml(raw.startsWith("/") ? raw : `/${raw}`);
  return FALLBACK_IMAGE;
};
let rows = [];

function track(tipo, metadados = {}) {
  registrarEventoSite(tipo, {
    pagina: "/app/parceiros",
    recursoTipo: "app_parceiros",
    metadados
  }).catch(() => {});
}

function partnerUrl(item) {
  return `/guia/${encodeURIComponent(item.slug || item.id)}`;
}

function featuredCard(item) {
  const url = partnerUrl(item);
  return `<article class="viva-featured-card">
    <a href="${url}" aria-label="Conhecer ${escapeHtml(item.nome)}">
      <img src="${safeImage(item.imagem_url)}" alt="${escapeHtml(item.nome)}" width="720" height="520" loading="lazy" decoding="async">
      <div class="viva-featured-card-copy">
        <small>${escapeHtml(item.categoria_nome || "Parceiro do Viva")}</small>
        <h3>${escapeHtml(item.nome)}</h3>
        ${item.descricao ? `<p>${escapeHtml(item.descricao)}</p>` : ""}
      </div>
    </a>
  </article>`;
}

function compactCard(item) {
  const url = partnerUrl(item);
  const name = escapeHtml(item.nome);
  return `<article class="viva-compact-card">
    <a href="${url}" aria-label="Conhecer ${name}" title="${name}">
      <img src="${safeImage(item.imagem_url)}" alt="${name}" width="360" height="360" loading="lazy" decoding="async">
    </a>
  </article>`;
}

function fillCategories() {
  const categories = [...new Set(rows.map(item => item.categoria_nome).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  category.innerHTML = `<option value="">Todas as categorias</option>${categories.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
}

function filteredRows() {
  const term = normalize(search.value);
  const selected = normalize(category.value);
  return rows.filter(item => {
    const itemCategory = item.categoria_nome || "";
    const haystack = normalize(`${item.nome} ${item.descricao || ""} ${itemCategory}`);
    return (!term || haystack.includes(term)) && (!selected || normalize(itemCategory) === selected);
  });
}

function render() {
  const filtered = filteredRows();
  const featured = filtered.filter(item => Boolean(item.recomendado));
  const regular = filtered.filter(item => !item.recomendado);

  featuredGrid.innerHTML = featured.map(featuredCard).join("");
  compactGrid.innerHTML = regular.map(compactCard).join("");
  featuredSection.hidden = featured.length === 0;
  allSection.hidden = regular.length === 0;

  status.textContent = filtered.length
    ? `${filtered.length} ${filtered.length === 1 ? "parceiro encontrado" : "parceiros encontrados"}.`
    : "Nenhum parceiro encontrado com esses filtros.";
}

async function init() {
  track("app_parceiros_acesso");
  if (!publicSupabaseConfigured()) {
    status.textContent = "Parceiros indisponíveis no momento.";
    return;
  }
  try {
    rows = await fetchPublicRows("guia_comercial", {
      select: "id,nome,slug,descricao,imagem_url,categoria_nome,recomendado",
      status: "eq.publicado",
      order: "recomendado.desc,nome.asc",
      limit: "200"
    }, { ttl: 300000, timeout: 6000 });
    fillCategories();
    render();
  } catch (error) {
    console.warn("Parceiros:", error.message);
    status.textContent = "Não foi possível carregar os parceiros agora.";
  }
}

search?.addEventListener("input", render);
category?.addEventListener("change", render);
directory?.addEventListener("click", event => {
  const link = event.target.closest("a");
  if (link) track("app_parceiro_clique", { href: link.href });
});
directory?.addEventListener("error", event => {
  const image = event.target;
  if (!image.matches?.("img") || image.getAttribute("src") === FALLBACK_IMAGE) return;
  image.src = FALLBACK_IMAGE;
}, true);

init();
