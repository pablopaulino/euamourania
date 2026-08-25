const sidebarAdminRoutes = {
  dashboard: "/admin",
  noticias: "/admin/noticias",
  aprovacoes: "/admin/aprovacoes",
  colaboradores_voluntarios: "/admin/colaboracoes",
  guia_comercial: "/admin/guia",
  guia_verificacao: "/admin/guia-verificacao",
  turismo_verificacao: "/admin/turismo-verificacao",
  turismo: "/admin/turismo",
  links: "/admin/links",
  submissoes: "/admin/submissoes",
  eventos: "/admin/agenda",
  eventos_principais: "/admin/eventos-principais",
  eventos_edicoes: "/admin/edicoes",
  publicidade: "/admin/publicidade",
  comunicacao: "/admin/comunicacao",
  notificacoes: "/admin/viva-urania",
  melhores: "/admin/melhores",
  categorias: "/admin/categorias",
  audiencia: "/admin/audiencia",
  configuracoes_site: "/admin/configuracoes",
  usuarios: "/admin/usuarios",
  importacao: "/admin/importacao"
};
const sidebarPathToModule = Object.entries(sidebarAdminRoutes).reduce((acc, [key, path]) => {
  acc[path] = key;
  return acc;
}, {
  "/admin/index.html": "dashboard",
  "/admin/publicidade.html": "publicidade",
  "/admin/comunicacao.html": "comunicacao",
  "/admin/notificacoes-app.html": "notificacoes",
  "/admin/melhores.html": "melhores",
  "/admin/submissoes.html": "submissoes",
  "/admin/usuarios.html": "usuarios",
  "/admin/migrar.html": "importacao"
});
const sidebarHashToModule = {
  dashboard: "dashboard",
  noticias: "noticias",
  aprovacoes: "aprovacoes",
  colaboradores_voluntarios: "colaboradores_voluntarios",
  guia_comercial: "guia_comercial",
  guia_verificacao: "guia_verificacao",
  turismo_verificacao: "turismo_verificacao",
  turismo: "turismo",
  links: "links",
  eventos: "eventos",
  eventos_principais: "eventos_principais",
  eventos_edicoes: "eventos_edicoes",
  categorias: "categorias",
  audiencia: "audiencia",
  insights: "audiencia",
  configuracoes_site: "configuracoes_site"
};
function adminPathForModule(key) {
  return sidebarAdminRoutes[key] || sidebarAdminRoutes.dashboard;
}
function sidebarCleanPath(path) {
  return String(path || "").replace(/\/+$/, "") || "/admin";
}
function sidebarPathFromHref(href) {
  try { return new URL(href, location.origin).pathname; }
  catch { return String(href || ""); }
}
function adminModuleFromLocation(loc = location) {
  if (loc.hash) return sidebarHashToModule[String(loc.hash).replace(/^#/, "")] || "dashboard";
  return sidebarPathToModule[sidebarCleanPath(sidebarPathFromHref(loc.pathname))] || "dashboard";
}
function adminViewFromLocation(loc = location) {
  return adminModuleFromLocation(loc);
}

const sidebarIconSvgShared = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths}</svg>`;

const sharedSidebarIcons = {
  dashboard: sidebarIconSvgShared(`<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/>`),
  news: sidebarIconSvgShared(`<path d="M4 5.5h11.5a2.5 2.5 0 0 1 2.5 2.5v10.5H6.5A2.5 2.5 0 0 1 4 16V5.5Z"/><path d="M18 8h2v8.5a2 2 0 0 1-2 2"/><path d="M7.5 9h6"/><path d="M7.5 12h6"/><path d="M7.5 15h4"/>`),
  approval: sidebarIconSvgShared(`<path d="M20 7 10 17l-5-5"/><path d="M4 5.5h9"/><path d="M4 18.5h12"/>`),
  guide: sidebarIconSvgShared(`<path d="M4 10h16"/><path d="M5 10l1-5h12l1 5"/><path d="M6 10v9h12v-9"/><path d="M9 19v-5h6v5"/>`),
  tourism: sidebarIconSvgShared(`<path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>`),
  links: sidebarIconSvgShared(`<path d="M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10.6 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-1.4 1.4a5 5 0 0 0 7.1 7.1l.8-.8"/>`),
  events: sidebarIconSvgShared(`<path d="M7 3v4"/><path d="M17 3v4"/><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/>`),
  ads: sidebarIconSvgShared(`<path d="m4 14 4-2 9-5v10l-9-5-4-2v4Z"/><path d="M8 14v5"/><path d="M18 9.5c1 .8 1.5 1.7 1.5 2.5s-.5 1.7-1.5 2.5"/>`),
  mail: sidebarIconSvgShared(`<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 6 7.5-6"/>`),
  bell: sidebarIconSvgShared(`<path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>`),
  award: sidebarIconSvgShared(`<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M5 6H3v2a4 4 0 0 0 4 4"/><path d="M19 6h2v2a4 4 0 0 1-4 4"/>`),
  tag: sidebarIconSvgShared(`<path d="M20.5 10.5 13.5 3.5H6l-2.5 2.5v7.5l7 7a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8Z"/><circle cx="8.5" cy="8.5" r="1"/>`),
  settings: sidebarIconSvgShared(`<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19 13.5a1.8 1.8 0 0 0 0-3l1.2-2-2.4-2.4-2 1.2a1.8 1.8 0 0 0-3 0L11.6 5H8.4L7.2 7.3a1.8 1.8 0 0 0-3 0L2 8.6l1.2 2a1.8 1.8 0 0 0 0 3L2 15.6l2.2 2.2 2-1.2a1.8 1.8 0 0 0 3 0l1.2 2.4h3.2l1.2-2.4a1.8 1.8 0 0 0 3 0l2 1.2 2.2-2.2-1.2-2Z"/>`),
  users: sidebarIconSvgShared(`<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M20.5 8v6"/><path d="M17.5 11h6"/>`),
  upload: sidebarIconSvgShared(`<path d="M14 3v5h5"/><path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5Z"/><path d="M12 12v5"/><path d="m9.5 14.5 2.5-2.5 2.5 2.5"/>`)
};

let sidebarIsRendering = false;

const fullSidebarMenu = [
  { label: "Visão geral", href: adminPathForModule("dashboard"), icon: "dashboard", module: "dashboard", view: "dashboard" },
  { label: "Notícias", href: adminPathForModule("noticias"), icon: "news", module: "noticias", view: "noticias" },
  { label: "Aprovações", href: adminPathForModule("aprovacoes"), icon: "approval", module: "noticias", id: "editorial-approvals-nav" },
  { label: "Colaborações", href: adminPathForModule("colaboradores_voluntarios"), icon: "users", module: "colaboradores", view: "colaboradores_voluntarios" },
  { label: "Guia comercial", href: adminPathForModule("guia_comercial"), icon: "guide", module: "guia_comercial", view: "guia_comercial" },
  { label: "Verificação do Guia", href: adminPathForModule("guia_verificacao"), icon: "approval", module: "guia_comercial", view: "guia_verificacao" },
  { label: "Turismo", href: adminPathForModule("turismo"), icon: "tourism", module: "turismo", view: "turismo" },
  { label: "Verificação de Turismo", href: adminPathForModule("turismo_verificacao"), icon: "approval", module: "turismo", view: "turismo_verificacao" },
  { label: "Links", href: adminPathForModule("links"), icon: "links", module: "links", view: "links" },
  { label: "Submissões públicas", href: adminPathForModule("submissoes"), icon: "users", module: "submissoes" },
  { label: "Agenda simples", href: adminPathForModule("eventos"), icon: "events", module: "eventos", view: "eventos" },
  { label: "Eventos principais", href: adminPathForModule("eventos_principais"), icon: "events", module: "eventos", view: "eventos_principais" },
  { label: "Edições", href: adminPathForModule("eventos_edicoes"), icon: "news", module: "eventos", view: "eventos_edicoes" },
  { label: "Publicidade", href: adminPathForModule("publicidade"), icon: "ads", module: "publicidade" },
  { label: "Comunicação", href: adminPathForModule("comunicacao"), icon: "mail", module: "comunicacao" },
  { label: "Notificações do Viva Urânia", href: adminPathForModule("notificacoes"), icon: "bell", module: "notificacoes" },
  { label: "Melhores de Urânia", href: adminPathForModule("melhores"), icon: "award", module: "melhores" },
  { label: "Categorias", href: adminPathForModule("categorias"), icon: "tag", module: "categorias", view: "categorias" },
  { label: "Audiência", href: adminPathForModule("audiencia"), icon: "dashboard", module: "insights", id: "audience-nav" },
  { label: "Configurações", href: adminPathForModule("configuracoes_site"), icon: "settings", module: "configuracoes", view: "configuracoes_site" },
  { label: "Usuários administrativos", href: adminPathForModule("usuarios"), icon: "users", module: "usuarios" },
  { label: "Migrar conteúdo antigo", href: adminPathForModule("importacao"), icon: "upload", module: "importacao" }
];

function currentSidebarTarget() {
  return adminModuleFromLocation();
}

function isCurrentSidebarItem(item) {
  const current = currentSidebarTarget();
  const itemPath = typeof item.href === "function" ? item.href() : item.href;
  const target = adminModuleFromLocation({ pathname: itemPath, hash: "" });
  const targetView = adminViewFromLocation({ pathname: itemPath, hash: "" });
  return current === item.view || current === item.module || current === target || current === targetView;
}

function isCurrentSidebarHref(href) {
  const current = currentSidebarTarget();
  const target = adminModuleFromLocation({ pathname: String(href || ""), hash: "" });
  const targetView = adminViewFromLocation({ pathname: String(href || ""), hash: "" });
  return current === target || current === targetView;
}

function normalizeSidebarMenu(sidebar) {
  const nav = sidebar.querySelector(".admin-nav");
  if (!nav || nav.dataset.fullMenuReady === "true" || sidebarIsRendering) return;

  sidebarIsRendering = true;
  nav.dataset.fullMenuReady = "true";
  nav.dataset.fixed = "1";
  nav.innerHTML = fullSidebarMenu.map(item => {
    const attrs = [
      `href="${item.href}"`,
      `data-href="${item.href}"`,
      `data-icon-key="${item.icon}"`,
      `data-module="${item.module}"`
    ];
    if (item.view) attrs.push(`data-view="${item.view}"`);
    if (item.id) attrs.push(`id="${item.id}"`);
    if (isCurrentSidebarItem(item)) attrs.push(`class="active"`);
    return `
    <a ${attrs.join(" ")}>
      ${item.label}
    </a>
  `;
  }).join("");
  sidebarIsRendering = false;

  if (!nav.dataset.sidebarClickReady) {
    nav.dataset.sidebarClickReady = "true";
    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-href]");
      if (!button) return;
      if (isCurrentSidebarHref(button.dataset.href)) {
        event.preventDefault();
        return;
      }
      if (button.tagName !== "A") {
        location.href = button.dataset.href;
      }
    });
  }
}

function decorateSidebarButtons(sidebar) {
  const buttons = [...sidebar.querySelectorAll(".admin-nav button, .admin-nav a")];
  buttons.forEach(button => {
    const rawLabel = button.dataset.label || button.textContent || "";
    const label = rawLabel.trim().replace(/\s+/g, " ");
    const iconKey = button.dataset.iconKey || "dashboard";
    button.dataset.label = label;
    button.title = label;
    button.innerHTML = `<span class="admin-nav-icon" aria-hidden="true">${sharedSidebarIcons[iconKey] || sharedSidebarIcons.dashboard}</span><span class="admin-nav-label">${label}</span>`;
  });
}

function watchSidebarMenu(sidebar) {
  const nav = sidebar.querySelector(".admin-nav");
  if (!nav || nav.dataset.sidebarObserverReady) return;

  nav.dataset.sidebarObserverReady = "true";
  const observer = new MutationObserver(() => {
    if (sidebarIsRendering) return;
    window.requestAnimationFrame(() => {
      nav.dataset.fullMenuReady = "";
      normalizeSidebarMenu(sidebar);
      decorateSidebarButtons(sidebar);
    });
  });
  observer.observe(nav, { childList: true });
}

function ensureSidebarShell() {
  const sidebar = document.getElementById("sidebar");
  const shell = document.querySelector(".admin-shell");
  if (!sidebar || !shell) return;

  normalizeSidebarMenu(sidebar);

  let head = sidebar.querySelector(".admin-sidebar-head");
  const logo = sidebar.querySelector(".admin-logo");
  if (!head) {
    head = document.createElement("div");
    head.className = "admin-sidebar-head";
    if (logo) {
      sidebar.insertBefore(head, logo);
      head.appendChild(logo);
    } else {
      sidebar.prepend(head);
    }
  }

  let toggle = document.getElementById("sidebar-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.id = "sidebar-toggle";
    toggle.className = "sidebar-toggle";
    toggle.type = "button";
    toggle.innerHTML = `<span aria-hidden="true">â€¹</span>`;
    head.appendChild(toggle);
  }

  decorateSidebarButtons(sidebar);
  watchSidebarMenu(sidebar);

  const applyCollapsed = collapsed => {
    shell.classList.toggle("sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
    const icon = toggle.querySelector("span");
    if (icon) icon.textContent = collapsed ? "â€º" : "â€¹";
  };

  applyCollapsed(localStorage.getItem("euamourania:admin-sidebar") === "collapsed");
  if (!toggle.dataset.sidebarReady) {
    toggle.dataset.sidebarReady = "true";
    toggle.addEventListener("click", () => {
      const collapsed = !shell.classList.contains("sidebar-collapsed");
      applyCollapsed(collapsed);
      localStorage.setItem("euamourania:admin-sidebar", collapsed ? "collapsed" : "expanded");
    });
  }

  let backdrop = document.getElementById("sidebar-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("button");
    backdrop.id = "sidebar-backdrop";
    backdrop.className = "sidebar-backdrop";
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "Fechar menu");
    document.body.appendChild(backdrop);
  }

  const mobileMenu = document.getElementById("mobile-menu");
  mobileMenu?.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    document.body.classList.toggle("sidebar-drawer-open", sidebar.classList.contains("open"));
  });
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("open");
    document.body.classList.remove("sidebar-drawer-open");
  });
  sidebar.addEventListener("click", event => {
    if (window.innerWidth <= 860 && event.target.closest(".admin-nav button, .admin-nav a")) {
      sidebar.classList.remove("open");
      document.body.classList.remove("sidebar-drawer-open");
    }
  });
}

ensureSidebarShell();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureSidebarShell, { once: true });
} else {
  requestAnimationFrame(ensureSidebarShell);
}
