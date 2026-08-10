const sidebarIconSvgShared = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round" focusable="false">${paths}</svg>`;

const sharedSidebarIcons = {
  dashboard: sidebarIconSvgShared(`<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-5h5v5"/>`),
  news: sidebarIconSvgShared(`<path d="M4 5.5h11.5a2.5 2.5 0 0 1 2.5 2.5v10.5H6.5A2.5 2.5 0 0 1 4 16V5.5Z"/><path d="M18 8h2v8.5a2 2 0 0 1-2 2"/><path d="M7.5 9h6"/><path d="M7.5 12h6"/><path d="M7.5 15h4"/>`),
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

function sidebarIconKey(button, label) {
  const source = `${label} ${button.getAttribute("onclick") || ""} ${button.dataset.view || ""}`.toLowerCase();
  if (source.includes("notic") || source.includes("notÃ")) return "news";
  if (source.includes("guia")) return "guide";
  if (source.includes("turismo")) return "tourism";
  if (source.includes("links")) return "links";
  if (source.includes("evento") || source.includes("agenda")) return "events";
  if (source.includes("publicidade")) return "ads";
  if (source.includes("comunic")) return "mail";
  if (source.includes("notific")) return "bell";
  if (source.includes("melhores")) return "award";
  if (source.includes("categoria")) return "tag";
  if (source.includes("config")) return "settings";
  if (source.includes("usuario") || source.includes("usuÃ")) return "users";
  if (source.includes("migrar") || source.includes("importar")) return "upload";
  if (source.includes("colabora") || source.includes("submiss")) return "users";
  return "dashboard";
}

function ensureSidebarShell() {
  const sidebar = document.getElementById("sidebar");
  const shell = document.querySelector(".admin-shell");
  if (!sidebar || !shell) return;

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
    toggle.innerHTML = `<span aria-hidden="true">‹</span>`;
    head.appendChild(toggle);
  }

  const buttons = [...sidebar.querySelectorAll(".admin-nav button")];
  buttons.forEach(button => {
    const label = (button.dataset.label || button.textContent || "").trim().replace(/\s+/g, " ");
    button.dataset.label = label;
    button.title = label;
    if (!button.querySelector(".admin-nav-icon")) {
      const icon = sharedSidebarIcons[sidebarIconKey(button, label)] || sharedSidebarIcons.dashboard;
      button.innerHTML = `<span class="admin-nav-icon" aria-hidden="true">${icon}</span><span class="admin-nav-label">${label}</span>`;
    }
  });

  const applyCollapsed = collapsed => {
    shell.classList.toggle("sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
    const icon = toggle.querySelector("span");
    if (icon) icon.textContent = collapsed ? "›" : "‹";
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
    if (window.innerWidth <= 860 && event.target.closest(".admin-nav button")) {
      sidebar.classList.remove("open");
      document.body.classList.remove("sidebar-drawer-open");
    }
  });
}

ensureSidebarShell();
