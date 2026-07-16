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
const status = document.getElementById("category-status");
const nav = document.getElementById("category-nav");
const list = document.getElementById("category-news");
const form = document.getElementById("category-search-form");
const search = document.getElementById("category-search");
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "/assets/Design sem nome (9).png";
const newsUrl = slug => `/noticias/${encodeURIComponent(slug)}`;
const categoryUrl = category => `/${encodeURIComponent(gerarSlug(category || "urania"))}/`;
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const resumo = item => (item.resumo || textoPuro(item.conteudo_html || "")).trim();

let categoryNews = [];

function card(item, index = 0) {
  const text = resumo(item);
  const featured = index === 0 ? " category-card-featured" : "";
  return `<article class="category-card${featured}"><a class="category-card-media" href="${newsUrl(item.slug)}" aria-label="${esc(item.titulo)}"><img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" ${index === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></a><div class="category-card-body"><p class="category-card-meta"><span>${esc(item.categoria_nome || "Urânia")}</span><time datetime="${esc(item.publicado_em)}">${esc(formatarData(item.publicado_em))}</time></p><h3><a href="${newsUrl(item.slug)}">${esc(item.titulo)}</a></h3>${text ? `<p>${esc(text.slice(0, index === 0 ? 210 : 130))}${text.length > (index === 0 ? 210 : 130) ? "…" : ""}</p>` : ""}<a class="category-card-action" href="${newsUrl(item.slug)}">Ler notícia <span aria-hidden="true">→</span></a></div></article>`;
}

function renderNav(news) {
  const categories = [...new Set(news.map(item => item.categoria_nome).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  nav.innerHTML = categories.map(category => {
    const active = gerarSlug(category) === currentSlug;
    return `<a class="${active ? "active" : ""}" href="${categoryUrl(category)}" ${active ? 'aria-current="page"' : ""}>${esc(category)}</a>`;
  }).join("");
  nav.hidden = categories.length < 2;
}

function render() {
  const term = normalize(search.value.trim());
  const items = categoryNews.filter(item => !term || normalize(`${item.titulo} ${item.resumo || ""}`).includes(term));
  count.textContent = items.length === 1 ? "1 notícia encontrada nesta editoria." : `${items.length} notícias encontradas nesta editoria.`;
  if (!items.length) {
    list.innerHTML = "";
    status.hidden = false;
    status.textContent = term ? "Nenhuma notícia encontrada com essa busca." : "Ainda não há notícias publicadas nesta editoria.";
    return;
  }
  status.hidden = true;
  list.innerHTML = `<div class="category-news-grid">${items.map(card).join("")}</div>`;
}

function setStructuredData(categoryName, items) {
  let node = document.getElementById("category-structured-data");
  if (!node) {
    node = document.createElement("script");
    node.type = "application/ld+json";
    node.id = "category-structured-data";
    document.head.appendChild(node);
  }
  const url = `${DOMAIN}${categoryUrl(categoryName)}`;
  node.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: `${categoryName} | Eu Amo Urânia`,
        description: `Notícias de ${categoryName} em Urânia, organizadas pelo portal Eu Amo Urânia.`,
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
          { "@type": "ListItem", position: 3, name: categoryName, item: url }
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
    const news = await fetchPublicRows("noticias", {
      select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em",
      status: "eq.publicado",
      publicado_em: `lte.${new Date().toISOString()}`,
      order: "publicado_em.desc",
      limit: "250"
    });
    renderNav(news);
    const categoryName = news.find(item => gerarSlug(item.categoria_nome || "") === currentSlug)?.categoria_nome;
    if (!categoryName) {
      title.textContent = "Editoria não encontrada";
      description.textContent = "Não encontramos notícias publicadas para esta editoria.";
      count.textContent = "Nenhuma notícia encontrada.";
      status.textContent = "Volte para a página de notícias e escolha outra editoria.";
      return;
    }
    categoryNews = news.filter(item => gerarSlug(item.categoria_nome || "") === currentSlug);
    const pageUrl = `${DOMAIN}${categoryUrl(categoryName)}`;
    title.textContent = categoryName;
    description.textContent = `As principais notícias de ${categoryName} em Urânia, com atualização pela redação do Eu Amo Urânia.`;
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
