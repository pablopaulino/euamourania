import { verifiedName } from "/assets/js/viva-verified.js";
import { fetchPublicRows, publicSupabaseConfigured } from "/assets/js/services/publicDataService.js";
import "./banners-preview.js";

const container = document.getElementById("guia-container");
const status = document.getElementById("guia-status");
const filters = document.getElementById("guia-filtros");
const loadMore = document.getElementById("guia-ver-mais");
const searchForm = document.getElementById("guia-busca-form");
const searchInput = document.getElementById("guia-busca");
const loadStatus = document.createElement("p");
const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[c]));
const safeImage = v => /^https?:\/\//i.test(v || "") || /^\/?assets\//.test(v || "") ? esc(v) : "";
const placeholder = '<div class="media-placeholder"><img src="/assets/1505 - Urania - Logo Horizontal - 1.png" alt="Eu Amo Urânia" width="190" height="56" loading="lazy" decoding="async"></div>';
const normalize = v => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const PAGE_SIZE = 6;
const LIST_SELECT = "id,nome,slug,categoria_nome,descricao,imagem_url,whatsapp,endereco,horario,recomendado,verificado";
const LIST_QUERY = { select: LIST_SELECT, status: "eq.publicado", order: "recomendado.desc,nome.asc" };
let initialData = null;
try { initialData = JSON.parse(document.getElementById("initial-guide-list-data")?.textContent || "null"); } catch {}
let itens = [];
let itensFiltrados = [];
let quantidadeVisivel = PAGE_SIZE;
let carregandoAutomatico = false;
let listaCompleta = false;
let temMaisPaginas = false;
let buscaCompleta = null;
let revisaoLista = 0;
let categoriasAtivas = [];
let categoriaAtual = "";
let termoAtual = normalize(new URLSearchParams(location.search).get("busca"));

loadStatus.className = "load-more-status guia-load-status";
loadStatus.setAttribute("aria-live", "polite");
loadMore?.closest(".guia-load-more-wrap")?.append(loadStatus);

function atualizarStatusDeCarga(restantes = 0) {
  if (!loadStatus) return;
  loadStatus.textContent = carregandoAutomatico
    ? "Carregando mais empresas..."
    : restantes
      ? "Continue rolando para ver mais empresas."
      : itensFiltrados.length > PAGE_SIZE
        ? "Você chegou ao fim do Guia."
        : "";
}

async function aplicarFiltros() {
  if (!listaCompleta && (categoriaAtual || termoAtual)) {
    try { await carregarTodos(); }
    catch (error) { console.error(error); loadStatus.textContent = "Não foi possível filtrar agora. Tente novamente."; return; }
  }
  const filtrados = itens.filter(item => {
    const categoriaCorresponde = !categoriaAtual || item.categoria_nome === categoriaAtual;
    const textoCorresponde = !termoAtual || normalize(`${item.nome} ${item.descricao || ""} ${item.categoria_nome || ""} ${item.endereco || ""}`).includes(termoAtual);
    return categoriaCorresponde && textoCorresponde;
  });
  quantidadeVisivel = PAGE_SIZE;
  renderizar(filtrados);
}

function mobileTags(item) {
  const tags = [];
  if (item.whatsapp) tags.push('<span class="tag-whatsapp">WhatsApp</span>');
  if (item.endereco) tags.push('<span>Endereço</span>');
  if (item.horario) tags.push('<span>Horário</span>');
  return tags.length ? `<div class="guide-mobile-tags">${tags.slice(0, 3).join("")}</div>` : "";
}

function cardMarkup(item) {
  const detalhes = `/guia/${encodeURIComponent(item.slug || item.id)}`;
  return `<article class="card-guia" id="guia-${esc(item.id)}" data-guide-id="${esc(item.id)}"${item.recomendado ? ' data-guide-featured="true"' : ""}>${item.recomendado ? '<span class="badge-destaque">Recomendado</span>' : ""}<a class="card-media guide-card-link" href="${detalhes}" aria-label="Ver detalhes de ${esc(item.nome)}">${safeImage(item.imagem_url) ? `<img src="${safeImage(item.imagem_url)}" class="card-img-top" alt="${esc(item.nome)}" width="420" height="320" loading="lazy" decoding="async">` : placeholder}</a><div class="card-body">${item.categoria_nome ? `<p class="guide-category">${esc(item.categoria_nome)}</p>` : ""}<h2 class="card-title"><a href="${detalhes}">${verifiedName(esc(item.nome), item.verificado)}</a></h2><p class="card-text">${esc(item.descricao || "Conheça este estabelecimento no Guia de Urânia.")}</p>${mobileTags(item)}<div class="guide-card-actions"><a href="${detalhes}" class="btn-guide-details">Ver detalhes <span aria-hidden="true">→</span></a>${item.whatsapp ? `<a href="https://wa.me/${String(item.whatsapp).replace(/\D/g, "")}" target="_blank" rel="noopener" class="btn-whatsapp" aria-label="Falar com ${esc(item.nome)} pelo WhatsApp">WhatsApp</a>` : ""}</div></div></article>`;
}

function prepararImagens(root = container) {
  root.querySelectorAll(".card-img-top").forEach(img => img.addEventListener("error", () => { img.parentElement.innerHTML = placeholder; }, { once: true }));
}

function atualizarControles(dados, visiveis) {
  const restantes = Math.max(0, dados.length - visiveis.length);
  loadMore.hidden = restantes === 0 && !temMaisPaginas;
  loadMore.textContent = restantes || temMaisPaginas ? "Ver mais estabelecimentos" : "Todos os estabelecimentos foram exibidos";
  atualizarStatusDeCarga(restantes || Number(temMaisPaginas));
  document.dispatchEvent(new CustomEvent("guia:renderizado"));
}

function renderizar(dados) {
  itensFiltrados = dados;
  if (!dados.length) {
    container.innerHTML = "";
    status.hidden = false;
    status.textContent = "Nenhum item cadastrado no guia.";
    loadMore.hidden = true;
    loadStatus.textContent = "";
    return;
  }
  status.hidden = true;
  const visiveis = dados.slice(0, quantidadeVisivel);
  container.innerHTML = visiveis.map(cardMarkup).join("");
  prepararImagens();
  atualizarControles(dados, visiveis);
}

function renderizarFiltros(categorias) {
  categoriasAtivas = categorias;
  const cadastradas = categorias.map(item => item.nome);
  const extras = [...new Set(itens.map(item => item.categoria_nome).filter(Boolean))]
    .filter(nome => !cadastradas.includes(nome))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const nomes = [...cadastradas, ...extras];
  filters.innerHTML = `<button class="btn-filtro${categoriaAtual ? "" : " ativo"}" type="button" data-category="">Todos</button>${nomes.map(nome => `<button class="btn-filtro${categoriaAtual === nome ? " ativo" : ""}" type="button" data-category="${esc(nome)}">${esc(nome)}</button>`).join("")}`;
}

filters?.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  filters.querySelectorAll(".btn-filtro").forEach(item => item.classList.toggle("ativo", item === button));
  categoriaAtual = button.dataset.category;
  aplicarFiltros();
});

searchForm?.addEventListener("submit", event => {
  event.preventDefault();
  termoAtual = normalize(searchInput.value);
  aplicarFiltros();
});

searchInput?.addEventListener("input", () => {
  if (searchInput.value.trim()) return;
  termoAtual = "";
  aplicarFiltros();
});

async function carregarMais(scroll = false) {
  if (loadMore.hidden || carregandoAutomatico) return;
  carregandoAutomatico = true;
  document.body.classList.add("is-loading-more");
  atualizarStatusDeCarga(Math.max(0, itensFiltrados.length - quantidadeVisivel));
  if (!listaCompleta && temMaisPaginas) {
    const revisao = revisaoLista;
    try {
      const page = await fetchPublicRows("guia_comercial", { ...LIST_QUERY, limit: String(PAGE_SIZE + 1), offset: String(itens.length) });
      if (revisao !== revisaoLista) {
        document.body.classList.remove("is-loading-more");
        carregandoAutomatico = false;
        return;
      }
      const novos = page.slice(0, PAGE_SIZE);
      temMaisPaginas = page.length > PAGE_SIZE;
      itens.push(...novos);
      itensFiltrados = itens;
    } catch (error) {
      console.error(error);
      loadStatus.textContent = "Não foi possível carregar mais empresas. Tente novamente.";
      document.body.classList.remove("is-loading-more");
      carregandoAutomatico = false;
      return;
    }
  }
  const inicio = quantidadeVisivel;
  quantidadeVisivel += PAGE_SIZE;
  requestAnimationFrame(() => {
    const novos = itensFiltrados.slice(inicio, quantidadeVisivel);
    container.insertAdjacentHTML("beforeend", novos.map(cardMarkup).join(""));
    prepararImagens();
    atualizarControles(itensFiltrados, itensFiltrados.slice(0, quantidadeVisivel));
    document.body.classList.remove("is-loading-more");
    carregandoAutomatico = false;
    atualizarStatusDeCarga(Math.max(0, itensFiltrados.length - quantidadeVisivel));
    if (scroll) container.querySelectorAll(".card-guia")[Math.max(0, inicio)]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

loadMore.addEventListener("click", () => carregarMais(true));

if ("IntersectionObserver" in window) {
  document.body.classList.add("guia-auto-load");
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting) || carregandoAutomatico || loadMore.hidden) return;
    carregarMais(false);
  }, { rootMargin: "420px 0px" });
  observer.observe(loadMore);
}

async function carregarTodos() {
  if (listaCompleta) return;
  revisaoLista += 1;
  if (!buscaCompleta) buscaCompleta = fetchPublicRows("guia_comercial", LIST_QUERY);
  try {
    itens = await buscaCompleta;
    listaCompleta = true;
    temMaisPaginas = false;
    renderizarFiltros(categoriasAtivas);
  } catch (error) {
    buscaCompleta = null;
    throw error;
  }
}

async function carregar() {
  if (initialData?.items && container?.dataset.serverRendered === "true") {
    itens = initialData.items;
    itensFiltrados = itens;
    temMaisPaginas = Boolean(initialData.hasMore);
    listaCompleta = !temMaisPaginas;
    renderizarFiltros(initialData.categories || []);
    if (!initialData.categories?.length && publicSupabaseConfigured()) {
      fetchPublicRows("categorias", { select:"nome,slug,ordem", tipo:"eq.guia", status:"eq.ativo", order:"ordem.asc,nome.asc" }, { ttl:180000 })
        .then(renderizarFiltros).catch(() => {});
    }
    prepararImagens();
    status.hidden = Boolean(itens.length);
    atualizarControles(itens, itens);
    if (termoAtual || location.hash.startsWith("#guia-")) {
      try {
        await carregarTodos();
        if (searchInput) searchInput.value = new URLSearchParams(location.search).get("busca") || "";
        const iniciais = termoAtual ? itens.filter(item => normalize(`${item.nome} ${item.descricao || ""} ${item.categoria_nome || ""} ${item.endereco || ""}`).includes(termoAtual)) : itens;
        const alvo = location.hash.startsWith("#guia-") ? itens.findIndex(item => `#guia-${item.id}` === location.hash) : -1;
        quantidadeVisivel = alvo >= 0 ? Math.max(PAGE_SIZE, alvo + 1) : PAGE_SIZE;
        renderizar(iniciais);
        if (alvo >= 0) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } catch (error) {
        console.error(error);
        loadStatus.textContent = "Não foi possível atualizar a busca agora. Tente novamente.";
      }
    }
    return;
  }
  if (!publicSupabaseConfigured()) {
    status.textContent = "Configure o Supabase para carregar o guia.";
    return;
  }
  try {
    const [dados, categorias] = await Promise.all([
      fetchPublicRows("guia_comercial", { ...LIST_QUERY, limit: String(PAGE_SIZE + 1) }),
      fetchPublicRows("categorias", {
        select: "nome,slug,ordem",
        tipo: "eq.guia",
        status: "eq.ativo",
        order: "ordem.asc,nome.asc"
      })
    ]);
    itens = dados.slice(0, PAGE_SIZE);
    temMaisPaginas = dados.length > PAGE_SIZE;
    listaCompleta = !temMaisPaginas;
    renderizarFiltros(categorias);
    if (searchInput) searchInput.value = new URLSearchParams(location.search).get("busca") || "";
    if (termoAtual || location.hash.startsWith("#guia-")) await carregarTodos();
    const iniciais = termoAtual ? itens.filter(item => normalize(`${item.nome} ${item.descricao || ""} ${item.categoria_nome || ""} ${item.endereco || ""}`).includes(termoAtual)) : itens;
    const alvo = location.hash.startsWith("#guia-") ? itens.findIndex(item => `#guia-${item.id}` === location.hash) : -1;
    quantidadeVisivel = alvo >= 0 ? Math.max(PAGE_SIZE, alvo + 1) : PAGE_SIZE;
    renderizar(iniciais);
    if (location.hash.startsWith("#guia-")) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar o guia.";
  }
}

carregar();
[1200, 3200, 6500].forEach(delay => window.setTimeout(() => {
  document.dispatchEvent(new CustomEvent("guia:renderizado"));
}, delay));



import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

const header = document.querySelector(".site-2026 .site-header");
const menu = document.getElementById("menu-principal");
const menuButton = header?.querySelector(".menu-toggle");
const searchTrigger = header?.querySelector(".search-trigger");
const headerSearchForm = header?.querySelector(".header-search-form");
const headerSearchInput = document.getElementById("header-search-input");

function closeSearch() {
  header?.classList.remove("search-open");
  searchTrigger?.setAttribute("aria-expanded", "false");
  headerSearchInput?.blur();
}

searchTrigger?.addEventListener("click", () => {
  menu?.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
  header?.classList.add("search-open");
  searchTrigger.setAttribute("aria-expanded", "true");
  window.setTimeout(() => headerSearchInput?.focus(), 180);
});

menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  menu?.classList.toggle("is-open", open);
});
menu?.addEventListener("click", event => {
  if (!event.target.closest("a")) return;
  menu.classList.remove("is-open");
  menuButton?.setAttribute("aria-expanded", "false");
});

header?.querySelector(".header-search-close")?.addEventListener("click", closeSearch);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && header?.classList.contains("search-open")) closeSearch();
});

document.querySelectorAll(".site-2026 #year").forEach(element => {
  element.textContent = String(new Date().getFullYear());
});

async function configureAppLinks() {
  try {
    const app = await getAppDownloadConfig();
    const href = app.googlePlayUrl || app.appStoreUrl || app.appPageUrl || "/app.html";
    document.querySelectorAll("[data-app-download]").forEach(link => { link.href = href; });
  } catch {}
}

function configureNewsletter() {
  const signup = document.querySelector(".site-2026 .newsletter-signup");
  if (!signup || signup.dataset.shellReady === "true") return Boolean(signup);
  signup.dataset.shellReady = "true";
  const title = signup.querySelector("h2");
  const description = signup.querySelector(".newsletter-box > div > p:last-child");
  const name = signup.querySelector('input[name="nome"]');
  if (title) title.textContent = "Urânia direto no seu e-mail.";
  if (description) description.textContent = "Receba notícias importantes, novidades da cidade e conteúdos do Eu Amo Urânia.";
  if (name) {
    name.placeholder = "Seu nome";
    name.required = true;
  }
  return true;
}

configureAppLinks();
if (!configureNewsletter()) {
  const observer = new MutationObserver(() => {
    if (configureNewsletter()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 10000);
}

Promise.allSettled([
  import("/assets/js/pages/site-config-page.js"),
  import("/assets/js/pages/analytics-page.js"),
  import("/assets/js/pages/newsletter-public.js"),
  import("/assets/js/pages/google-analytics-page.js"),
  import("/assets/js/pages/smart-app-banner.js"),
  import("/assets/js/pages/error-monitor.js")
]);
