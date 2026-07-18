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
  const visible = allItems.filter(item => {
    if (activeFilter === "destaques" && !item.destaque) return false;
    if (!["todos","destaques"].includes(activeFilter) && normalize(item.categoria_nome || item.categoria) !== activeFilter) return false;
    return !term || normalize(`${item.nome} ${item.descricao} ${item.endereco} ${item.horario}`).includes(term);
  });
  container.innerHTML = visible.map(tourismCard).join("");
  empty.hidden = Boolean(visible.length);
  results.textContent = term ? `${visible.length} ${visible.length === 1 ? "resultado encontrado" : "resultados encontrados"} para sua busca.` : "";
  document.dispatchEvent(new CustomEvent("turismo:renderizado"));
}

search?.addEventListener("input",renderTourism);
function bindFilters() {
  [...document.querySelectorAll("[data-tourism-filter]")].forEach(button => button.addEventListener("click",() => {
  activeFilter = button.dataset.tourismFilter;
  document.querySelectorAll("[data-tourism-filter]").forEach(item => {
    const active = item === button;
    item.classList.toggle("active",active);
    item.setAttribute("aria-pressed",String(active));
  });
  renderTourism();
  }));
}

function renderFilters() {
  const wrapper = document.querySelector(".tourism-filters");
  if (!wrapper) return;
  const categories = [...new Set(allItems.map(item => String(item.categoria_nome || item.categoria || "").trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b,"pt-BR"));
  const buttons = [
    ["todos","Todos"],
    ["destaques","Destaques"],
    ...categories.map(name => [normalize(name), name])
  ];
  wrapper.innerHTML = buttons.map(([value,label],index) => `<button class="tourism-filter${index ? "" : " active"}" type="button" data-tourism-filter="${escapeHtml(value)}" aria-pressed="${index ? "false" : "true"}">${escapeHtml(label)}</button>`).join("");
  bindFilters();
}

bindFilters();

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
    renderFilters();
    status.hidden = true;
    renderTourism();
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar os pontos turísticos.";
  }
}
carregarTurismo();
