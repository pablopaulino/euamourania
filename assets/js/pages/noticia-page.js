import { definirMeta, formatarData, gerarSlug, textoPuro } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";
import { sanitizeArticleHtml } from "../security/sanitize-html.js";

const container = document.getElementById("newsDetails");
const params = new URLSearchParams(location.search || location.hash.slice(1));
const pathSlug = location.pathname.match(/^\/noticias\/([^/]+)\/?$/)?.[1];
const slug = params.get("slug") || pathSlug;
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[char]));
const safeImage = value => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? esc(value) : "";
const resumo = item => (item.resumo || textoPuro(item.conteudo_html || "")).trim();
const urlNoticia = value => `/noticias/${encodeURIComponent(value)}`;
const urlCategoria = value => `/${encodeURIComponent(gerarSlug(value || "urania"))}/`;
const icons = {
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a9.8 9.8 0 0 0-8.4 14.8L2 22l5.4-1.4A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.1-1.1l-.3-.2-3.2.9.9-3.1-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.8-1.8-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.3 0-.4.1-.5l.4-.5.2-.4c.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.5-.4-.7-.4H8c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v2H6v4h3v7h4v-7h3.2l.8-4h-4V9c0-.7.3-1 1-1Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3Zm2 0h4a2 2 0 0 1 2 2v4h3V4h-9v3Zm4 2H5v9h9V9Z"/></svg>'
};

function sanitizeArticle(value) {
  return sanitizeArticleHtml(value);
}

function insertSuggestionBox(html) {
  const box = '<aside class="article-suggestion-box"><p><strong>Tem uma sugestão de reportagem?</strong></p><p>Envie informações, fotos ou relatos para o Eu Amo Urânia pelo WhatsApp.</p><a href="https://wa.me/5517976005583" target="_blank" rel="noopener">Falar com a redação</a></aside>';
  const paragraphs = [...html.matchAll(/<\/p>/gi)];
  if (paragraphs.length < 4) return `${html}${box}`;
  const insertAt = paragraphs[Math.min(3, paragraphs.length - 1)].index + paragraphs[Math.min(3, paragraphs.length - 1)][0].length;
  return `${html.slice(0, insertAt)}${box}${html.slice(insertAt)}`;
}

let readingProgressBound = false;

function setupReadingProgress() {
  const bar = document.getElementById("reading-progress-bar");
  const article = document.querySelector(".news-detail-container");
  if (!bar || !article) return;
  const update = () => {
    const start = article.offsetTop;
    const end = Math.max(start + article.offsetHeight - window.innerHeight, start + 1);
    const progress = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
    bar.style.transform = `scaleX(${progress})`;
  };
  update();
  if (!readingProgressBound) {
    readingProgressBound = true;
    window.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    window.addEventListener("resize", update, { passive: true });
  }
}

function initialNews() {
  const node = document.getElementById("initial-news-data");
  if (!node) return null;
  try {
    return JSON.parse(node.textContent);
  } catch {
    return null;
  }
}

async function findNews() {
  const initial = initialNews();
  if (initial?.slug === slug) return initial;
  if (!publicSupabaseConfigured()) return null;
  const [news] = await fetchPublicRows("noticias", {
    select: "*",
    slug: `eq.${slug}`,
    status: "eq.publicado",
    publicado_em: `lte.${new Date().toISOString()}`,
    limit: "1"
  });
  return news || null;
}

async function loadRelated(news) {
  const section = document.getElementById("related-news");
  if (!section) return;
  try {
    const common = {
      select: "titulo,slug,resumo,imagem_url,categoria_nome,publicado_em",
      status: "eq.publicado",
      publicado_em: `lte.${new Date().toISOString()}`,
      slug: `neq.${news.slug}`,
      order: "publicado_em.desc",
      limit: "9"
    };
    let related = [];
    if (news.categoria_nome) {
      related = await fetchPublicRows("noticias", { ...common, categoria_nome: `eq.${news.categoria_nome}`, limit: "4" });
    }
    if (related.length < 4) {
      const latest = await fetchPublicRows("noticias", common);
      const used = new Set(related.map(item => item.slug));
      latest.forEach(item => {
        if (related.length < 4 && !used.has(item.slug)) {
          related.push(item);
          used.add(item.slug);
        }
      });
    }
    const popular = await fetchPublicRows("noticias", {
      select: "titulo,slug,categoria_nome,publicado_em,visualizacoes",
      status: "eq.publicado",
      publicado_em: `lte.${new Date().toISOString()}`,
      slug: `neq.${news.slug}`,
      order: "visualizacoes.desc",
      limit: "5"
    }).catch(() => []);
    if (!related.length && !popular.length) return;
    const suggested = related[0] || popular[0];
    const relatedGrid = related.filter(item => item.slug !== suggested?.slug).slice(0, 3);
    section.innerHTML = `${suggested ? `<aside class="article-suggested-news"><div><p class="eyebrow">Sugerida para você</p><h2><a href="${urlNoticia(suggested.slug)}">${esc(suggested.titulo)}</a></h2><p>${esc(suggested.categoria_nome || "Notícias")} · ${esc(formatarData(suggested.publicado_em))}</p></div><a href="${urlNoticia(suggested.slug)}" aria-label="Ler notícia sugerida">Ler agora →</a></aside>` : ""}${relatedGrid.length ? `<div class="related-heading"><p class="eyebrow">Mais notícias</p><h2>Continue lendo</h2></div><div class="related-grid">${relatedGrid.map(item => {
      return `<a class="related-card" href="${urlNoticia(item.slug)}">${safeImage(item.imagem_url) ? `<img src="${safeImage(item.imagem_url)}" alt="${esc(item.titulo)}" loading="lazy" decoding="async">` : '<div class="related-placeholder">Eu Amo Urânia</div>'}<div class="related-card-body"><p class="related-meta">${esc(item.categoria_nome || "Notícias")} · ${esc(formatarData(item.publicado_em))}</p><h3>${esc(item.titulo)}</h3></div></a>`;
    }).join("")}</div>` : ""}${popular.length ? `<div class="article-popular-news"><div class="related-heading"><p class="eyebrow">Em alta</p><h2>Mais lidas</h2></div><ol>${popular.map((item, index) => `<li><a href="${urlNoticia(item.slug)}"><span>${index + 1}</span><strong>${esc(item.titulo)}</strong><small>${esc(item.categoria_nome || "Notícias")} · ${esc(formatarData(item.publicado_em))}</small></a></li>`).join("")}</ol></div>` : ""}`;
  } catch (error) {
    console.warn("Notícias relacionadas indisponíveis:", error.message);
  }
}

function renderNews(news) {
  const canonical = `https://euamourania.com.br/noticias/${encodeURIComponent(news.slug)}`;
  if (location.pathname.includes("news-details")) history.replaceState({}, "", urlNoticia(news.slug));
  const description = news.seo_descricao || resumo(news).slice(0, 160);
  const metaImage = news.seo_imagem || news.imagem_url;
  definirMeta({ titulo: `${news.seo_titulo || news.titulo} | Eu Amo Urânia`, descricao: description, imagem: metaImage, url: canonical });
  let structured = document.getElementById("news-structured-data");
  if (!structured) {
    structured = document.createElement("script");
    structured.type = "application/ld+json";
    structured.id = "news-structured-data";
    document.head.appendChild(structured);
  }
  structured.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${canonical}#newsarticle`,
        headline: news.titulo,
        description,
        image: metaImage ? [metaImage] : undefined,
        datePublished: news.publicado_em,
        dateModified: news.atualizado_em || news.publicado_em,
        author: { "@type": "Organization", name: news.autor || "Redação Eu Amo Urânia", url: "https://euamourania.com.br/quem-somos.html" },
        publisher: { "@type": "Organization", name: "Eu Amo Urânia", url: "https://euamourania.com.br", logo: { "@type": "ImageObject", url: "https://euamourania.com.br/assets/Design%20sem%20nome%20(9).png" } },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        url: canonical,
        articleSection: news.categoria_nome || "Notícias",
        articleBody: textoPuro(news.conteudo_html || news.resumo || "") || undefined,
        isAccessibleForFree: true,
        inLanguage: "pt-BR"
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: "https://euamourania.com.br/" },
          { "@type": "ListItem", position: 2, name: "Notícias", item: "https://euamourania.com.br/news/" },
          { "@type": "ListItem", position: 3, name: news.titulo, item: canonical }
        ]
      }
    ]
  });
  const content = sanitizeArticle(news.conteudo_html) || `<p>${esc(resumo(news))}</p>`;
  const contentWithSuggestion = insertSuggestionBox(content);
  const wordCount=textoPuro(content).split(/\s+/).filter(Boolean).length;
  const readingMinutes=Math.max(1,Math.ceil(wordCount/220));
  const categoryLabel = news.categoria_nome || "Notícias de Urânia";
  const categoryAnchor = `<a href="${urlCategoria(categoryLabel)}">${esc(categoryLabel)}</a>`;
  const shareBlock = `<div class="share-buttons" aria-label="Compartilhar notícia"><div class="share-heading"><span>Compartilhe</span><p>Envie esta notícia para quem também precisa saber.</p></div><a class="btn-share btn-share-whatsapp" target="_blank" rel="noopener" aria-label="Compartilhar no WhatsApp" href="https://api.whatsapp.com/send?text=${encodeURIComponent(`${news.titulo} - ${canonical}`)}">${icons.whatsapp}<span>WhatsApp</span></a><a class="btn-share btn-share-facebook" target="_blank" rel="noopener" aria-label="Compartilhar no Facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonical)}">${icons.facebook}<span>Facebook</span></a><button class="btn-share btn-share-copy" id="copy-link" type="button" aria-label="Compartilhar notícia">${icons.copy}<span>Compartilhar</span></button></div>`;
  container.innerHTML = `<div class="reading-progress" aria-hidden="true"><span id="reading-progress-bar"></span></div><article class="news-detail-container"><nav class="article-breadcrumb" aria-label="Navegação da notícia"><a href="/news/">Notícias</a><span aria-hidden="true">/</span>${categoryAnchor}</nav><header class="article-header"><p class="eyebrow">${categoryAnchor}</p><h1>${esc(news.titulo)}</h1>${news.subtitulo ? `<p class="article-subtitle">${esc(news.subtitulo)}</p>` : ""}<p class="meta article-meta"><span>Por ${esc(news.autor || "Eu Amo Urânia")}</span><time datetime="${esc(news.publicado_em)}">${esc(formatarData(news.publicado_em))}</time><span>${readingMinutes} min de leitura</span></p>${shareBlock}</header>${safeImage(news.imagem_url) ? `<figure class="article-figure"><img src="${safeImage(news.imagem_url)}" alt="${esc(news.legenda_imagem || news.titulo)}" class="main-image" decoding="async" fetchpriority="high">${news.legenda_imagem ? `<figcaption>${esc(news.legenda_imagem)}</figcaption>` : ""}</figure>` : ""}<div class="article-copy">${contentWithSuggestion}</div><section class="related-news" id="related-news" aria-label="Notícias relacionadas"><p class="related-loading">Carregando mais notícias…</p></section></article>`;
  document.getElementById("copy-link").addEventListener("click", async event => {
    const buttonLabel = event.currentTarget.querySelector("span");
    if (navigator.share && matchMedia("(max-width: 650px)").matches) {
      try {
        await navigator.share({ title: news.titulo, text: resumo(news).slice(0, 120), url: canonical });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try{
      await navigator.clipboard.writeText(canonical);
      buttonLabel.textContent = "Link copiado";
    }catch{
      buttonLabel.textContent = "Copie pela barra";
    }
  });
  window.dispatchEvent(new CustomEvent("noticia:renderizada"));
  setupReadingProgress();
  loadRelated(news);
}

async function loadNews() {
  if (!slug) {
    container.innerHTML = '<p class="not-found-message">Notícia não encontrada.</p>';
    return;
  }
  try {
    const news = await findNews();
    if (!news) throw new Error("not-found");
    renderNews(news);
  } catch {
    container.innerHTML = '<p class="not-found-message">Notícia não encontrada ou indisponível.</p>';
  }
}

loadNews();
