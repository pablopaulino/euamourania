import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";
import { registrarEventoSite } from "../services/analyticsService.js";

const grid = document.getElementById("partners-grid");
const status = document.getElementById("partners-status");
const search = document.getElementById("partners-search");
const category = document.getElementById("partners-category");
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
  return "/assets/compartilhamento-logo.png";
};
let rows = [];

function track(tipo, metadados = {}) {
  registrarEventoSite(tipo, {
    pagina: "/pt/parceiros",
    recursoTipo: "app_parceiros",
    metadados
  }).catch(() => {});
}

function card(item) {
  const url = `/guia/${encodeURIComponent(item.slug || item.id)}`;
  return `<article class="partner-list-card">
    <a href="${url}" aria-label="Conhecer ${escapeHtml(item.nome)}">
      <img src="${safeImage(item.imagem_url)}" alt="${escapeHtml(item.nome)}" width="460" height="280" loading="lazy" decoding="async">
    </a>
    <div>
      <small>${escapeHtml(item.categoria_nome || "Guia Comercial")}</small>
      <h2>${escapeHtml(item.nome)}</h2>
      ${item.descricao ? `<p>${escapeHtml(item.descricao)}</p>` : ""}
      <a href="${url}">Conhecer empresa →</a>
    </div>
  </article>`;
}

function fillCategories() {
  const categories = [...new Set(rows.map(item => item.categoria_nome).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  category.innerHTML = `<option value="">Todas as categorias</option>${categories.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}`;
}

function render() {
  const term = normalize(search.value);
  const selected = normalize(category.value);
  const filtered = rows.filter(item => {
    const itemCategory = item.categoria_nome || "";
    const haystack = normalize(`${item.nome} ${item.descricao || ""} ${itemCategory}`);
    return (!term || haystack.includes(term)) && (!selected || normalize(itemCategory) === selected);
  });
  grid.innerHTML = filtered.map(card).join("");
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
      order: "recomendado.desc,nome.asc"
    }, { ttl: 180000 });
    fillCategories();
    render();
  } catch (error) {
    console.warn("Parceiros:", error.message);
    status.textContent = "Não foi possível carregar os parceiros agora.";
  }
}

search?.addEventListener("input", render);
category?.addEventListener("change", render);
grid?.addEventListener("click", event => {
  const link = event.target.closest("a");
  if (link) track("app_parceiro_clique", { href: link.href });
});

init();
