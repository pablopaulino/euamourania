export const awardBase = "/melhores-de-urania";
export const awardPreviewBase = "/preview/melhores";
export const awardOrigin = "https://euamourania.com.br";

const routes = {
  home: ["index", ""],
  hall: ["hall", "hall"],
  edition: ["edicao", ":year"],
  category: ["categoria", ":year/categorias/:slug"],
  permanent: ["categoria-permanente", "categorias/:slug"],
  voting: ["votacao", ":year/votacao"],
  results: ["resultados", ":year/resultados"],
  winner: ["vencedor", ":year/vencedores/:id"],
  rules: ["regulamento", ":year/regulamento"],
  method: ["metodologia", ":year/metodologia"]
};

export const awardTemplate = page => `${awardBase}/${routes[page][0]}.html`;
export const awardSocialPages = {
  "award-home": "home", "award-edition": "edition", "award-voting": "voting",
  "award-results": "results", "award-hall": "hall", "award-winner": "winner",
  "award-rules": "rules", "award-method": "method", "award-category": "category",
  "award-permanent-category": "permanent"
};
export const awardLocal = (location = globalThis.location) => /^(localhost|127\.0\.0\.1)$/.test(location?.hostname || "");
const isAwardPreview = location => location?.pathname?.startsWith(`${awardPreviewBase}/`) ?? false;
export function isAwardDemo(page = globalThis.document?.body?.dataset.awardsPage, location = globalThis.location) {
  if (new URLSearchParams(location?.search).get("demo") !== "1") return false;
  return ["voting", "results"].includes(page) || (awardLocal(location) && ["hall", "winner"].includes(page));
}

export function awardPath(page = "home", { year, slug, id, local = false, trailingSlash = true } = {}) {
  const values = { year, slug, id };
  if (local && page !== "home") {
    const query = new URLSearchParams();
    if (year != null) query.set("ano", year);
    if (slug != null) query.set("categoria", slug);
    if (id != null) query.set("id", id);
    return `${awardTemplate(page)}${query.size ? `?${query}` : ""}`;
  }
  const pattern = page === "voting" && slug ? ":year/votacao/:slug" : routes[page][1];
  const segments = pattern.replace(/:(year|slug|id)/g, (_, key) => encodeURIComponent(values[key] ?? ""));
  return `${awardBase}${segments ? `/${segments}` : ""}${trailingSlash ? "/" : ""}`;
}

export function readAwardRoute(location = globalThis.location) {
  const pathname = location?.pathname?.replace(/\/+$/, "") || "";
  const query = new URLSearchParams(location?.search);
  const publicPath = pathname.startsWith(`${awardBase}/`) ? pathname.slice(awardBase.length + 1) : "";
  const [first, second, third] = publicPath.split("/");
  const year = /^\d{4}$/.test(first) ? first : query.get("ano");
  const category = first === "categorias" ? second : ["categorias", "votacao"].includes(second) ? third : null;
  const winner = second === "vencedores" ? third : null;
  return { year, slug: category ? decodeSegment(category) : query.get("categoria") || "", id: winner ? decodeSegment(winner) : query.get("id") || "" };
}

function decodeSegment(value) {
  try { return decodeURIComponent(value); }
  catch { return ""; }
}

export function awardSocialQuery(pathname) {
  if (pathname !== awardBase && !pathname.startsWith(`${awardBase}/`)) return null;
  const cleanPath = pathname.replace(/\/+$/, "");
  const parsed = readAwardRoute({ pathname: cleanPath });
  for (const [mode, page] of Object.entries(awardSocialPages)) {
    if (awardPath(page, { ...parsed, trailingSlash: false }) !== cleanPath) continue;
    return { tipo: "social", mode, ano: parsed.year || "", slug: parsed.id || parsed.slug, categoria: parsed.slug };
  }
  return null;
}

export function awardFromPreview(url) {
  if (!isAwardPreview(url)) return "";
  const template = url.pathname.slice(awardPreviewBase.length + 1).replace(/\/$/, "");
  const page = Object.keys(routes).find(key => routes[key][0] === template);
  const { year, slug, id } = readAwardRoute(url);
  if ((page === "permanent" && !slug) || (page === "category" && (!year || !slug))) return "";
  return page && (page === "permanent" || year) ? awardPath(page, { year, slug, id, trailingSlash: false }) : "";
}
