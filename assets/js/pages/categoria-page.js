import { definirMeta, formatarData, gerarSlug, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const DOMAIN = "https://euamourania.com.br";
const DEFAULT_IMAGE = `${DOMAIN}/assets/AD3A1763-min%20(1).jpg`;
const pathSlug = decodeURIComponent(location.pathname.match(/^\/([^/.]+)\/?$/)?.[1] || "");
const params = new URLSearchParams(location.search);
const currentSlug = pathSlug || params.get("categoria") || "";
const title = document.getElementById("category-title");
const description = document.getElementById("category-description");
const count = document.getElementById("category-count");
const total = document.getElementById("category-total");
const updated = document.getElementById("category-updated");
const status = document.getElementById("category-status");
const nav = document.getElementById("category-nav");
const list = document.getElementById("category-news");
const featured = document.getElementById("category-featured");
const feedTitle = document.getElementById("category-feed-title");
const form = document.getElementById("category-search-form");
const search = document.getElementById("category-search");
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const newsUrl = slug => `/noticias/${encodeURIComponent(slug)}`;
const categoryUrl = category => `/${encodeURIComponent(gerarSlug(category || "urania"))}/`;
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const resumo = item => (item.resumo || textoPuro(item.conteudo_html || "")).trim();

let categoryNews = [];
let categoryName = "";

function imageMarkup(item, className = "category-card-media", priority = false) {
  const image = safeImage(item.imagem_url);
  if (!image) {
    return `<a class="${className} category-card-placeholder" href="${newsUrl(item.slug)}" aria-label="${esc(item.titulo)}"><span>Eu Amo Urânia</span></a>`;
  }
  return `<a class="${className}" href="${newsUrl(item.slug)}" aria-label="${esc(item.titulo)}"><img src="${image}" alt="${esc(item.titulo)}" ${priority ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a>`;
}

function metaLine(item) {
  return `<p class="category-card-meta"><span>${esc(item.categoria_nome || categoryName || "Urânia")}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p>`;
}

function featuredCard(item) {
  const text = resumo(item);
  return `<article class="category-featured-card">
    ${imageMarkup(item, "category-featured-media", true)}
    <div class="category-featured-copy">
      ${metaLine(item)}
      <h2><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h2>
      ${text ? `<p>${esc(text.slice(0, 220))}${text.length > 220 ? "…" : ""}</p>` : ""}
      <a class="category-read-link" href="${newsUrl(item.slug)}">Abrir notícia <span aria-hidden="true">→</span></a>
    </div>
  </article>`;
}

function card(item) {
  const text = resumo(item);
  return `<article class="category-card">
    ${imageMarkup(item)}
    <div class="category-card-body">
      ${metaLine(item)}
      <h3><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h3>
      ${text ? `<p>${esc(text.slice(0, 135))}${text.length > 135 ? "…" : ""}</p>` : ""}
    </div>
  </article>`;
}

function renderNav(news, categoryRows = []) {
  const fromTable = categoryRows
    .filter(item => normalize(item.tipo) === "noticias" && (!item.status || item.status === "ativo"))
    .map(item => item.nome)
    .filter(Boolean);
  const fromNews = news.map(item => item.categoria_nome).filter(Boolean);
  const categories = [...new Set([...fromTable, ...fromNews])]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  nav.innerHTML = [
    `<a href="/news/">Todas</a>`,
    ...categories.map(category => {
      const active = gerarSlug(category) === currentSlug;
      return `<a class="${active ? "active" : ""}" href="${categoryUrl(category)}" ${active ? 'aria-current="page"' : ""}>${esc(category)}</a>`;
    })
  ].join("");
  nav.hidden = categories.length < 2;
}

function render() {
  const term = normalize(search.value.trim());
  const filtered = categoryNews.filter(item => !term || normalize(`${item.titulo} ${item.resumo || ""}`).includes(term));
  const main = categoryNews[0];
  const items = term ? filtered : filtered.filter(item => item.slug !== main?.slug);

  if (feedTitle) feedTitle.textContent = `Últimas notícias de ${categoryName}`;
  count.textContent = filtered.length === 1 ? "1 publicação encontrada" : `${filtered.length} publicações encontradas`;
  if (search) search.placeholder = `Buscar em ${categoryName}`;
  if (featured) featured.innerHTML = main && !term ? featuredCard(main) : "";

  if (!filtered.length) {
    list.innerHTML = "";
    status.hidden = false;
    status.textContent = term ? "Nenhuma notícia encontrada com essa busca." : "Ainda não há notícias publicadas nesta editoria.";
    return;
  }

  if (!items.length) {
    list.innerHTML = "";
    status.hidden = false;
    status.textContent = term ? "A busca encontrou apenas a notícia em destaque." : "Esta editoria ainda tem apenas uma publicação.";
    return;
  }

  status.hidden = true;
  list.innerHTML = `<div class="category-news-grid">${items.map(card).join("")}</div>`;
}

function setStructuredData(name, items) {
  let node = document.getElementById("category-structured-data");
  if (!node) {
    node = document.createElement("script");
    node.type = "application/ld+json";
    node.id = "category-structured-data";
    document.head.appendChild(node);
  }
  const url = `${DOMAIN}${categoryUrl(name)}`;
  node.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: `${name} | Eu Amo Urânia`,
        description: `Notícias de ${name} em Urânia, organizadas pelo portal Eu Amo Urânia.`,
        isPartOf: { "@id": `${DOMAIN}/#website` },
        inLanguage: "pt-BR",
        hasPart: items.slice(0, 10).map(item => ({
          "@type": "NewsArticle",
          headline: item.titulo,
          url: `${DOMAIN}${newsUrl(item.slug)}`,
          datePublished: item.publicado_em,
          image: item.imagem_url ? [new URL(item.imagem_url, `${DOMAIN}/`).href] : undefined
        }))
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${DOMAIN}/` },
          { "@type": "ListItem", position: 2, name: "Notícias", item: `${DOMAIN}/news/` },
          { "@type": "ListItem", position: 3, name, item: url }
        ]
      }
    ]
  });
}

async function init() {
  if (!currentSlug) {
    location.replace("/news/");
    return;
  }
  if (!publicSupabaseConfigured()) {
    status.textContent = "Notícias indisponíveis no momento.";
    return;
  }
  try {
    const [news, categories] = await Promise.all([
      fetchPublicRows("noticias", {
        select: "id,titulo,slug,resumo,conteudo_html,imagem_url,categoria_nome,publicado_em",
        status: "eq.publicado",
        publicado_em: `lte.${new Date().toISOString()}`,
        order: "publicado_em.desc",
        limit: "250"
      }),
      fetchPublicRows("categorias", {
        select: "nome,slug,descricao,tipo,status,ordem",
        status: "eq.ativo",
        order: "ordem.asc",
        limit: "100"
      }).catch(() => [])
    ]);
    renderNav(news, categories);
    const categoryMeta = categories.find(item => gerarSlug(item.slug || item.nome || "") === currentSlug || gerarSlug(item.nome || "") === currentSlug);
    categoryName = categoryMeta?.nome || news.find(item => gerarSlug(item.categoria_nome || "") === currentSlug)?.categoria_nome || "";
    if (!categoryName) {
      title.textContent = "Editoria não encontrada";
      description.textContent = "Não encontramos notícias publicadas para esta editoria.";
      count.textContent = "Nenhuma notícia encontrada.";
      status.textContent = "Volte para a página de notícias e escolha outra editoria.";
      if (total) total.textContent = "0";
      if (updated) updated.textContent = "—";
      return;
    }
    categoryNews = news.filter(item => gerarSlug(item.categoria_nome || "") === gerarSlug(categoryName));
    const pageUrl = `${DOMAIN}${categoryUrl(categoryName)}`;
    title.textContent = categoryName;
    description.textContent = categoryMeta?.descricao || `As principais notícias de ${categoryName} em Urânia, com atualização pela redação do Eu Amo Urânia.`;
    if (total) total.textContent = String(categoryNews.length);
    if (updated) updated.textContent = categoryNews[0]?.publicado_em ? formatarData(categoryNews[0].publicado_em) : "—";
    definirMeta({
      titulo: `${categoryName} | Eu Amo Urânia`,
      descricao: `Notícias de ${categoryName} em Urânia, reunidas em uma página própria do Eu Amo Urânia.`,
      imagem: categoryNews[0]?.imagem_url || DEFAULT_IMAGE,
      url: pageUrl
    });
    setStructuredData(categoryName, categoryNews);
    render();
  } catch (error) {
    console.error(error);
    status.textContent = "Não foi possível carregar esta editoria agora.";
  }
}

form?.addEventListener("submit", event => {
  event.preventDefault();
  render();
});
search?.addEventListener("input", render);
init();
