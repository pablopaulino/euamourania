import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const container = document.getElementById("turismo-container");
const status = document.getElementById("turismo-status");
const search = document.getElementById("turismo-busca");
const total = document.getElementById("turismo-total");
const results = document.getElementById("turismo-results");
const empty = document.getElementById("turismo-empty");
const filters = [...document.querySelectorAll("[data-tourism-filter]")];
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? escapeHtml(value) : "assets/Design sem nome (9).png";
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const icons = {
  pin:'<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  clock:'<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};
let allItems = [];
let activeFilter = "todos";

function tourismCard(item,index) {
  const url = `/turismo/${encodeURIComponent(item.slug)}`;
  const description = String(item.descricao || "").trim();
  return `<article class="card-guia tourism-card" data-tourism-id="${escapeHtml(item.id)}">
    <a class="tourism-card-media" href="${url}" aria-label="Conhecer ${escapeHtml(item.nome)}">
      <img src="${safeImage(item.imagem_url)}" class="card-img-top" alt="${escapeHtml(item.nome)}" ${index ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">
      ${item.destaque ? '<span class="badge-destaque">Destaque</span>' : ""}
    </a>
    <div class="card-body tourism-card-body">
      <p class="tourism-card-kicker">Experiência local</p>
      <h2 class="card-title"><a href="${url}">${escapeHtml(item.nome)}</a></h2>
      ${description ? `<p class="card-text">${escapeHtml(description)}</p>` : ""}
      <div class="tourism-card-details">
        ${item.endereco ? `<p>${icons.pin}<span><small>Onde fica</small>${escapeHtml(item.endereco)}</span></p>` : ""}
        ${item.horario ? `<p>${icons.clock}<span><small>Quando visitar</small>${escapeHtml(item.horario)}</span></p>` : ""}
      </div>
      <a href="${url}" class="tourism-card-action"><span>Conhecer este lugar</span><span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function renderTourism() {
  const term = normalize(search?.value);
  const visible = allItems.filter(item => {
    if (activeFilter === "destaques" && !item.destaque) return false;
    return !term || normalize(`${item.nome} ${item.descricao} ${item.endereco} ${item.horario}`).includes(term);
  });
  container.innerHTML = visible.map(tourismCard).join("");
  empty.hidden = Boolean(visible.length);
  results.textContent = `${visible.length} ${visible.length === 1 ? "lugar encontrado" : "lugares encontrados"}`;
  document.dispatchEvent(new CustomEvent("turismo:renderizado"));
}

search?.addEventListener("input",renderTourism);
filters.forEach(button => button.addEventListener("click",() => {
  activeFilter = button.dataset.tourismFilter;
  filters.forEach(item => {
    const active = item === button;
    item.classList.toggle("active",active);
    item.setAttribute("aria-pressed",String(active));
  });
  renderTourism();
}));

async function carregarTurismo() {
  if (!publicSupabaseConfigured()) { status.textContent = "Configure o Supabase para carregar os pontos turísticos."; return; }
  try {
    const itens = await fetchPublicRows("turismo", {
      select: "id,nome,slug,descricao,imagem_url,endereco,horario,destaque",
      status: "eq.publicado",
      order: "destaque.desc,nome.asc"
    });
    if (!itens.length) { status.textContent = "Nenhum ponto turístico publicado."; return; }
    allItems = itens;
    total.textContent = String(itens.length);
    status.hidden = true;
    renderTourism();
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar os pontos turísticos.";
  }
}
carregarTurismo();
