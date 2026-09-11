import { ADMIN_MODULES } from "./admin-modules.js?v=20260911-home-suggestions";

const trimSlash = value => String(value || "").replace(/\/+$/, "") || "/admin";

export const ADMIN_INDEX_ROUTES = Object.fromEntries(Object.entries(ADMIN_MODULES).map(([key, module]) => [key, module.route]));

ADMIN_INDEX_ROUTES.insights = ADMIN_INDEX_ROUTES.audiencia;
ADMIN_INDEX_ROUTES.midia = "/admin/midia";
ADMIN_INDEX_ROUTES.banners = "/admin/banners";

export const ADMIN_PAGE_ROUTES = {};

const PATH_TO_VIEW = Object.entries(ADMIN_INDEX_ROUTES).reduce((acc, [view, path]) => {
  acc[trimSlash(path)] = view === "insights" ? "audiencia" : view;
  return acc;
}, {
  "/admin/index.html": "dashboard",
  "/admin/guia-comercial": "guia_comercial",
  "/admin/eventos": "eventos_principais",
  "/admin/notificacoes": "notificacoes"
});

const PATH_TO_PAGE = Object.entries(ADMIN_PAGE_ROUTES).reduce((acc, [key, path]) => {
  acc[trimSlash(path)] = key;
  return acc;
}, {
  "/admin/publicidade.html": "publicidade",
  "/admin/comunicacao.html": "comunicacao",
  "/admin/notificacoes-app.html": "notificacoes",
  "/admin/melhores.html": "melhores",
  "/admin/submissoes.html": "submissoes",
  "/admin/usuarios.html": "usuarios",
  "/admin/migrar.html": "importacao"
});

const HASH_TO_VIEW = Object.fromEntries(Object.keys(ADMIN_INDEX_ROUTES).map(key => [key, key]));
HASH_TO_VIEW.insights = "audiencia";

export function adminHashToView(hash = "") {
  const key = String(hash || "").replace(/^#/, "");
  return HASH_TO_VIEW[key] || key || "dashboard";
}

export function adminPathForView(view = "dashboard") {
  const key = view === "insights" ? "audiencia" : view;
  return ADMIN_INDEX_ROUTES[key] || ADMIN_INDEX_ROUTES.dashboard;
}

export function adminPathForModule(key = "dashboard") {
  return ADMIN_INDEX_ROUTES[key] || ADMIN_PAGE_ROUTES[key] || ADMIN_INDEX_ROUTES.dashboard;
}

export function adminViewFromLocation(loc = location) {
  const path = trimSlash(loc.pathname);
  if (loc.hash) return adminHashToView(loc.hash);
  return PATH_TO_VIEW[path] || null;
}

export function adminModuleFromLocation(loc = location) {
  const path = trimSlash(loc.pathname);
  return PATH_TO_PAGE[path] || adminViewFromLocation(loc) || "dashboard";
}

export function normalizeLegacyAdminRoute(loc = location) {
  const view = adminViewFromLocation(loc) || "dashboard";
  const path = trimSlash(loc.pathname);
  const target = adminPathForModule(view);
  const isLegacyIndex = path === "/admin/index.html";
  if (loc.hash || isLegacyIndex) {
    history.replaceState({ adminView: view }, "", target);
  }
  return view;
}
