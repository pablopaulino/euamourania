const trimSlash = value => String(value || "").replace(/\/+$/, "") || "/admin";

export const ADMIN_INDEX_ROUTES = {
  dashboard: "/admin",
  noticias: "/admin/noticias",
  aprovacoes: "/admin/aprovacoes",
  colaboradores_voluntarios: "/admin/colaboracoes",
  guia_comercial: "/admin/guia",
  guia_verificacao: "/admin/guia-verificacao",
  turismo: "/admin/turismo",
  links: "/admin/links",
  eventos: "/admin/agenda",
  eventos_principais: "/admin/eventos-principais",
  eventos_edicoes: "/admin/edicoes",
  categorias: "/admin/categorias",
  audiencia: "/admin/audiencia",
  insights: "/admin/audiencia",
  configuracoes_site: "/admin/configuracoes",
  midia: "/admin/midia",
  banners: "/admin/banners",
  comunicacao: "/admin/comunicacao",
  notificacoes: "/admin/viva-urania",
  submissoes: "/admin/submissoes",
  publicidade: "/admin/publicidade",
  usuarios: "/admin/usuarios",
  importacao: "/admin/importacao",
  melhores: "/admin/melhores"
};

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

const HASH_TO_VIEW = {
  dashboard: "dashboard",
  noticias: "noticias",
  aprovacoes: "aprovacoes",
  colaboradores_voluntarios: "colaboradores_voluntarios",
  guia_comercial: "guia_comercial",
  guia_verificacao: "guia_verificacao",
  turismo: "turismo",
  links: "links",
  eventos: "eventos",
  eventos_principais: "eventos_principais",
  eventos_edicoes: "eventos_edicoes",
  categorias: "categorias",
  audiencia: "audiencia",
  insights: "audiencia",
  configuracoes_site: "configuracoes_site",
  midia: "midia",
  banners: "banners",
  publicidade: "publicidade",
  usuarios: "usuarios",
  importacao: "importacao",
  melhores: "melhores"
};

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
