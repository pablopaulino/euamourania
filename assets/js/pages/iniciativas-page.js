import { listarIniciativas } from "../services/iniciativasService.js";

const root = document.querySelector("#iniciativas-lista");
const filters = document.querySelectorAll("[data-filter]");
const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&#39;"
}[char]));

const typeLabel = item => item.tipo === "projeto" ? "Projeto permanente" : "Ação da comunidade";
const image = item => item.imagem_capa_url || "/assets/compartilhamento-logo.png";

let initiatives = [];
let activeFilter = "all";

function card(item) {
  const destaque = item.destaque ? "<em>Destaque</em>" : "";
  return `
    <a class="initiatives-public-card" href="/iniciativas/${encodeURIComponent(item.slug)}" data-type="${esc(item.tipo)}">
      <span class="initiative-card-media">
        <img src="${esc(image(item))}" alt="${esc(item.titulo || "Iniciativa da comunidade")}" width="640" height="400" loading="lazy" decoding="async">
        <span class="initiative-card-type">${esc(typeLabel(item))}</span>
      </span>
      <span class="initiative-card-body">
        <h3>${esc(item.titulo || "Iniciativa sem título")}</h3>
        <p>${esc(item.resumo || "Conheça esta iniciativa divulgada pelo Eu Amo Urânia.")}</p>
        <span class="initiative-card-footer">
          <span>Conhecer iniciativa →</span>
          ${destaque}
        </span>
      </span>
    </a>
  `;
}

function render() {
  if (!root) return;
  const visible = activeFilter === "all"
    ? initiatives
    : initiatives.filter(item => item.tipo === activeFilter);

  root.innerHTML = visible.length
    ? visible.map(card).join("")
    : `<p class="initiatives-empty-state">Nenhuma iniciativa publicada nesta categoria no momento.</p>`;
}

function bindFilters() {
  filters.forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";
    filters.forEach(item => item.classList.toggle("active", item === button));
    render();
  }));
}

async function init() {
  if (!root) return;
  bindFilters();
  try {
    initiatives = await listarIniciativas();
    render();
  } catch (error) {
    console.warn("Iniciativas:", error.message);
    root.innerHTML = `<p class="initiatives-empty-state">Não foi possível carregar as iniciativas agora.</p>`;
  }
}

init();
