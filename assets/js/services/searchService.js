import { fetchPublicRows } from "./publicDataService.js";
import { EDITORIAL_POLICY_PAGES } from "../editorialPolicies.js";

let indexPromise;

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

const trimText = (value, length = 180) => {
  const text = String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};

const image = (value) => /^https?:\/\//i.test(value || "") || /^\/?assets\//.test(value || "") ? value : "";

function makeItem(type, row) {
  const types = {
    noticia: {
      label: "Notícia",
      title: row.titulo,
      description: row.resumo,
      url: `/noticias/${encodeURIComponent(row.slug)}`,
      category: row.categoria_nome,
      date: row.publicado_em,
      action: "Ler notícia"
    },
    guia: {
      label: "Guia",
      title: row.nome,
      description: row.descricao,
      url: `/guia/${encodeURIComponent(row.slug)}`,
      category: row.categoria_nome,
      meta: row.endereco,
      action: "Ver estabelecimento"
    },
    turismo: {
      label: "Turismo",
      title: row.nome,
      description: row.descricao,
      url: `/turismo/${encodeURIComponent(row.slug)}`,
      category: row.categoria_nome,
      meta: row.endereco,
      action: "Conhecer lugar"
    },
    evento: {
      label: "Evento",
      title: row.titulo,
      description: row.descricao,
      url: `/eventos/detalhes.html?slug=${encodeURIComponent(row.slug)}`,
      category: "Agenda",
      meta: row.local,
      date: row.data_inicio,
      action: "Ver evento"
    }
  };
  const config = types[type];
  const searchable = normalize([
    config.title,
    config.description,
    config.category,
    config.meta,
    row.organizador
  ].filter(Boolean).join(" "));
  return {
    id: row.id,
    type,
    typeLabel: config.label,
    title: config.title || "Sem título",
    description: trimText(config.description),
    image: image(row.imagem_url),
    url: config.url,
    category: config.category || "",
    meta: config.meta || "",
    date: config.date || null,
    actionLabel: config.action,
    featured: Boolean(row.destaque || row.recomendado),
    normalizedTitle: normalize(config.title),
    searchable
  };
}

function staticPage({ id, title, description, url, category, meta, actionLabel, featured = false, terms = "", imageUrl = "assets/1505 - Urania - Logo Horizontal - 1.png" }) {
  return {
    id,
    type: "pagina",
    typeLabel: "Página",
    title,
    description,
    image: imageUrl,
    url,
    category,
    meta,
    date: null,
    actionLabel,
    featured,
    normalizedTitle: normalize(title),
    searchable: normalize([title, description, category, meta, terms].filter(Boolean).join(" "))
  };
}

function staticPages() {
  return [
    staticPage({
      id: "pagina-urania",
      title: "Urânia",
      description: "História, identidade e informações sobre a cidade de Urânia.",
      url: "/urania/",
      category: "Cidade",
      meta: "Conheça Urânia",
      actionLabel: "Abrir página",
      featured: true,
      imageUrl: "assets/AD3A1763-min (1).jpg",
      terms: "história noroeste paulista turismo comunidade informações cidade"
    }),
    staticPage({
      id: "pagina-quem-somos",
      title: "Quem somos",
      description: "Conheça o propósito do Eu Amo Urânia e como o portal valoriza a cidade.",
      url: "/quem-somos.html",
      category: "Institucional",
      meta: "Eu Amo Urânia",
      actionLabel: "Abrir página",
      terms: "contato portal comunidade institucional sobre nós"
    }),
    staticPage({
      id: "pagina-links",
      title: "Links e canais",
      description: "Acesse canais oficiais, contatos e links úteis do Eu Amo Urânia.",
      url: "/links/",
      category: "Serviço",
      meta: "Canais",
      actionLabel: "Ver links",
      terms: "whatsapp contato instagram facebook canais úteis"
    }),
    staticPage({
      id: "pagina-colabore",
      title: "Colabore voluntariamente",
      description: "Cadastre-se para colaborar voluntariamente com pautas, historias, fotos e informacoes locais do Eu Amo Urania.",
      url: "/colabore/",
      category: "Comunidade",
      meta: "Colaboracao voluntaria",
      actionLabel: "Quero colaborar",
      terms: "colaborar voluntario voluntaria pauta pautas escrever textos fotos eventos historias informacoes cidade redacao comunidade"
    }),
    staticPage({
      id: "pagina-melhores",
      title: "Melhores de Urânia",
      description: "Votação, categorias, indicados e resultados do Melhores de Urânia.",
      url: "/melhores-de-urania/",
      category: "Melhores de Urânia",
      meta: "Votação popular",
      actionLabel: "Abrir votação",
      featured: true,
      terms: "votação popular indicados categorias empresas prêmio comércio"
    }),
    ...EDITORIAL_POLICY_PAGES.map((page) => staticPage({
      id: `pagina-${page.slug}`,
      title: page.title,
      description: page.description,
      url: `/news/${page.slug}/`,
      category: "Transparência editorial",
      meta: "Notícias",
      actionLabel: "Abrir política",
      terms: "publicações política editorial correções direito de resposta denúncias transparência publicidade fontes créditos contato editorial"
    }))
  ];
}

async function buildIndex() {
  const now = new Date().toISOString();
  const [news, guide, tourism, events] = await Promise.all([
    fetchPublicRows("noticias", {
      select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,destaque",
      status: "eq.publicado",
      publicado_em: `lte.${now}`,
      order: "publicado_em.desc",
      limit: "250"
    }, { ttl: 300000 }),
    fetchPublicRows("guia_comercial", {
      select: "id,nome,slug,descricao,imagem_url,categoria_nome,endereco,recomendado",
      status: "eq.publicado",
      order: "recomendado.desc,nome.asc",
      limit: "300"
    }, { ttl: 300000 }),
    fetchPublicRows("turismo", {
      select: "id,nome,slug,descricao,imagem_url,categoria_nome,endereco,destaque",
      status: "eq.publicado",
      order: "destaque.desc,nome.asc",
      limit: "150"
    }, { ttl: 300000 }),
    fetchPublicRows("eventos", {
      select: "id,titulo,slug,descricao,imagem_url,data_inicio,data_fim,local,organizador,destaque",
      status: "eq.publicado",
      order: "data_inicio.desc",
      limit: "150"
    }, { ttl: 300000 })
  ]);

  return [
    ...news.map((row) => makeItem("noticia", row)),
    ...guide.map((row) => makeItem("guia", row)),
    ...tourism.map((row) => makeItem("turismo", row)),
    ...events.map((row) => makeItem("evento", row)),
    ...staticPages()
  ];
}

export function loadSearchIndex() {
  if (!indexPromise) indexPromise = buildIndex().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

function score(item, term, tokens) {
  let value = 0;
  if (item.normalizedTitle === term) value += 120;
  else if (item.normalizedTitle.startsWith(term)) value += 90;
  else if (item.normalizedTitle.includes(term)) value += 65;
  tokens.forEach((token) => {
    if (item.normalizedTitle.startsWith(token)) value += 18;
    else if (item.normalizedTitle.includes(token)) value += 12;
    else if (normalize(item.category).includes(token)) value += 7;
    else if (item.searchable.includes(token)) value += 3;
  });
  if (item.featured) value += 4;
  if (item.type === "noticia" && item.date) {
    const age = Date.now() - new Date(item.date).getTime();
    if (age >= 0 && age < 30 * 86400000) value += 3;
  }
  return value;
}

export async function searchPortal(query, { type = "", limit = 40 } = {}) {
  const term = normalize(query);
  if (term.length < 2) return [];
  const tokens = term.split(" ").filter(Boolean);
  const index = await loadSearchIndex();
  return index
    .filter((item) => (!type || item.type === type) && tokens.every((token) => item.searchable.includes(token)))
    .map((item) => ({ ...item, score: score(item, term, tokens) }))
    .sort((a, b) => b.score - a.score || String(b.date || "").localeCompare(String(a.date || "")) || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, limit);
}

export function searchTypeCounts(results) {
  return results.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, { noticia: 0, guia: 0, turismo: 0, evento: 0, pagina: 0 });
}
