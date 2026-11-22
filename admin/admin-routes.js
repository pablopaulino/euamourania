import { ADMIN_MODULES } from "./admin-modules.js";

export const ADMIN_INDEX_ROUTES = Object.fromEntries(Object.entries(ADMIN_MODULES).map(([view, meta]) => [view, meta.route]));
const paths = new Map(Object.entries(ADMIN_INDEX_ROUTES).map(([view, path]) => [path,view]));
paths.set("/admin/eventos","eventos_principais");
paths.set("/admin/guia-comercial","guia_comercial");
paths.set("/admin/notificacoes","notificacoes");

const legacy = {
  "index": "dashboard",
  "banners": "banners",
  "categorias": "categorias",
  "configuracoes": "configuracoes_site",
  "eventos": "eventos",
  "guia-form": "guia_comercial",
  "guia": "guia_comercial",
  "links": "links",
  "noticia-form": "noticia_editor",
  "noticias": "noticias",
  "turismo-form": "turismo",
  "turismo": "turismo",
  "automacao-editorial": "automacao_editorial",
  "parceiros-log": "parceiros_log",
  "publicidade": "publicidade",
  "viva-assinaturas": "viva_assinaturas",
  "comunicacao": "comunicacao",
  "notificacoes-app": "notificacoes",
  "melhores": "melhores",
  "submissoes": "submissoes",
  "usuarios": "usuarios",
  "migrar": "importacao"
};
for (const [name,view] of Object.entries(legacy)) paths.set("/admin/" + name + ".html",view);

export function adminHashToView(hash = "") {
  const name = hash.replace(/^#/, "").split("?")[0];
  if (name === "insights") return "audiencia";
  return Object.hasOwn(ADMIN_MODULES, name) ? name : "dashboard";
}

export function adminPathForView(view = "dashboard") {
  return ADMIN_INDEX_ROUTES[view === "insights" ? "audiencia" : view] || "/admin";
}
export const adminPathForModule = adminPathForView;

export function adminViewFromLocation(loc = location) {
  const path = loc.pathname.replace(/\/+$/, "") || "/";
  if (loc.hash && ["/admin", "/admin/index.html"].includes(path)) return adminHashToView(loc.hash);
  return paths.get(path) || null;
}

export function adminModuleFromLocation(loc = location) {
  return adminViewFromLocation(loc) || "dashboard";
}

export function normalizeLegacyAdminRoute(loc = location) {
  const view = adminModuleFromLocation(loc);
  if (["/admin", "/admin/", "/admin/index.html"].includes(loc.pathname) && (loc.hash || loc.pathname.endsWith("index.html"))) {
    const query = loc.search || (loc.hash.includes("?") ? loc.hash.slice(loc.hash.indexOf("?")) : "");
    history.replaceState({adminView:view}, "", adminPathForView(view) + query);
  }
  return view;
}
