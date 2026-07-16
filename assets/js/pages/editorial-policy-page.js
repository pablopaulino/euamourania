import { definirMeta } from "../utils.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";
import { EDITORIAL_POLICY_BY_KEY, EDITORIAL_POLICY_PAGES } from "../editorialPolicies.js";
import { sanitizeInstitutionalHtml } from "../security/sanitize-html.js";

const DEFAULT_IMAGE = "https://euamourania.com.br/assets/AD3A1763-min%20(1).jpg";
const SITE_URL = "https://euamourania.com.br";

const text = (value = "") => String(value ?? "").trim();

function sanitizeHtml(html = "") {
  return sanitizeInstitutionalHtml(html);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

async function loadSettings() {
  if (!publicSupabaseConfigured()) return {};
  try {
    const rows = await fetchPublicRows("configuracoes_site", {
      select: "chave,valor",
    }, { ttl: 300000, timeout: 4500 });
    return Object.fromEntries((rows || []).map((row) => [row.chave, row.valor]));
  } catch (error) {
    console.warn("Políticas editoriais: usando conteúdo padrão.", error);
    return {};
  }
}

function renderNavigation(currentKey) {
  const nav = document.getElementById("policy-nav");
  if (!nav) return;
  nav.innerHTML = `
    <p>Transparência editorial</p>
    ${EDITORIAL_POLICY_PAGES.map((page) => `
      <a href="/news/${page.slug}/" class="${page.key === currentKey ? "active" : ""}">
        <span>${page.title}</span>
      </a>
    `).join("")}
  `;
}

function renderStructuredData({ page, title, description, url }) {
  document.getElementById("policy-structured-data")?.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "policy-structured-data";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "pt-BR",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Notícias", item: `${SITE_URL}/news/` },
          { "@type": "ListItem", position: 3, name: page.title, item: url },
        ],
      },
    ],
  });
  document.head.append(script);
}

async function init() {
  const main = document.querySelector("[data-policy-key]");
  const key = main?.dataset.policyKey || EDITORIAL_POLICY_PAGES[0].key;
  const page = EDITORIAL_POLICY_BY_KEY[key] || EDITORIAL_POLICY_PAGES[0];
  renderNavigation(page.key);

  const settings = await loadSettings();
  const title = text(settings[`${page.key}_titulo`]) || page.title;
  const description = text(settings[`${page.key}_descricao`]) || page.description;
  const html = text(settings[`${page.key}_html`]) || page.html;
  const updatedAt = text(settings[`${page.key}_atualizado_em`]) || page.updatedAt;
  const url = `${SITE_URL}/news/${page.slug}/`;

  setText("policy-eyebrow", page.eyebrow);
  setText("policy-title", title);
  setText("policy-description", description);
  setText("policy-updated", updatedAt ? `Última atualização: ${updatedAt}.` : "");

  const content = document.getElementById("policy-content");
  if (content) content.innerHTML = sanitizeHtml(html);

  definirMeta({
    titulo: `${title} | Eu Amo Urânia`,
    descricao: description,
    imagem: DEFAULT_IMAGE,
    url,
  });
  renderStructuredData({ page, title, description, url });
}

init();
