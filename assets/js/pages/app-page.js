import { getAppDownloadConfig } from "../services/appDownloadConfig.js";
import { registrarEventoSite } from "../services/analyticsService.js";
import { fetchPublicRows, publicSupabaseConfigured } from "../services/publicDataService.js";

const escapeHtml = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

const safeImage = value => {
  const raw = String(value || "").trim();
  if (/^https?:\/\//i.test(raw)) return escapeHtml(raw);
  if (/^\/?assets\//i.test(raw)) return escapeHtml(raw.startsWith("/") ? raw : `/${raw}`);
  return "/assets/viva-origem-colorido.svg";
};

const safeTrack = (tipo, metadados = {}) => {
  registrarEventoSite(tipo, {
    pagina: "/app",
    recursoTipo: "app",
    destino: metadados.destino || null,
    metadados
  }).catch(() => {});
};

const PARTNERS_LIMIT = 200;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

function setStoreLink(link, url, fallbackLabel) {
  if (!link) return;
  const hasUrl = Boolean(url);
  link.href = hasUrl ? url : "#download";
  link.setAttribute("aria-disabled", hasUrl ? "false" : "true");
  link.classList.toggle("is-disabled", !hasUrl);
  if (!hasUrl && fallbackLabel) {
    const text = link.querySelector("[data-store-label]");
    if (text) text.textContent = fallbackLabel;
  }
}

function bindSmoothAnchors() {
  document.querySelectorAll("[data-scroll-target]").forEach(anchor => {
    anchor.addEventListener("click", event => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      safeTrack("app_cta_click", { destino: anchor.getAttribute("href"), label: anchor.textContent.trim() });
      const header = document.querySelector(".viva-header");
      const offset = (header?.getBoundingClientRect().height || 0) + 18;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  });
}

function bindTrackedLinks(root = document) {
  root.querySelectorAll("[data-app-page-link]").forEach(link => {
    link.addEventListener("click", () => safeTrack("app_internal_cta_click", {
      destino: link.getAttribute("href"),
      label: link.textContent.trim()
    }), { once: true });
  });
}

function partnerCard(item) {
  const url = `/guia/${encodeURIComponent(item.slug || item.id)}`;
  return `<article class="viva-partner-card">
    <a href="${url}" data-app-page-link aria-label="Conhecer ${escapeHtml(item.nome)}">
      <span class="viva-partner-logo">
        <img src="${safeImage(item.imagem_url)}" alt="${escapeHtml(item.nome)}" width="180" height="180" loading="lazy" decoding="async">
      </span>
      <span class="viva-partner-body">
        <strong>${escapeHtml(item.nome)}</strong>
        <small>Parceiro do Viva</small>
      </span>
    </a>
  </article>`;
}

function partnerSet(partners, repeats = 1, hidden = false) {
  const set = document.createElement("div");
  set.className = "viva-partner-set";
  if (hidden) set.setAttribute("aria-hidden", "true");
  set.innerHTML = Array.from({ length: repeats }, () => partners.map(partnerCard).join("")).join("");
  const cards = [...set.querySelectorAll(".viva-partner-card")];
  cards.forEach((card, index) => {
    if (hidden || index >= partners.length) {
      card.setAttribute("aria-hidden", "true");
      const link = card.querySelector("a");
      if (link) {
        link.tabIndex = -1;
        link.removeAttribute("data-app-page-link");
      }
    }
  });
  return set;
}

function setupPartnersMarquee(list, partners) {
  list.replaceChildren();
  list.classList.remove("is-static", "is-marquee");
  const shouldAnimate = partners.length > 1 && !prefersReducedMotion();
  const repeats = shouldAnimate ? Math.max(1, Math.ceil(8 / partners.length)) : 1;
  const primary = partnerSet(partners, repeats);
  list.append(primary);

  if (!shouldAnimate) {
    list.classList.add("is-static");
    bindTrackedLinks(primary);
    return;
  }

  const duplicate = primary.cloneNode(true);
  duplicate.setAttribute("aria-hidden", "true");
  duplicate.querySelectorAll("a").forEach(link => {
    link.tabIndex = -1;
    link.removeAttribute("data-app-page-link");
  });
  list.append(duplicate);

  // Mobile browsers may defer images that enter the viewport through a CSS
  // transform. Preload this small repeated pool so animated cards stay painted.
  if (window.matchMedia("(max-width: 780px)").matches) {
    list.querySelectorAll("img").forEach(image => {
      image.loading = "eager";
      image.fetchPriority = "low";
    });
  }

  list.classList.add("is-marquee");
  list.style.setProperty("--partner-marquee-duration", Math.max(28, partners.length * repeats * 5) + "s");
  bindTrackedLinks(primary);
}

async function loadPartners() {
  const list = document.getElementById("viva-partners-list");
  if (!list) return;
  const section = list.closest(".viva-partners");
  if (!publicSupabaseConfigured()) {
    section?.setAttribute("hidden", "");
    return;
  }
  try {
    const rows = await fetchPublicRows("guia_comercial", {
      select: "id,nome,slug,imagem_url,recomendado",
      status: "eq.publicado",
      recomendado: "eq.true",
      order: "nome.asc",
      limit: String(PARTNERS_LIMIT)
    }, { ttl: 300000, timeout: 5000 });
    const partners = rows || [];
    if (!partners.length) {
      section?.setAttribute("hidden", "");
      return;
    }
    setupPartnersMarquee(list, partners);
  } catch (error) {
    console.warn("Parceiros do Viva Urânia:", error.message);
    section?.setAttribute("hidden", "");
  }
}

function setupHeaderMotion() {
  const header = document.querySelector(".viva-header");
  if (!header) return;
  const update = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

function setupRevealMotion() {
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("motion-ready");
  const targets = [
    ".viva-proof span",
    ".viva-section-head",
    ".viva-section-heading",
    ".viva-path",
    ".viva-screen-card",
    ".viva-everyday > *",
    ".viva-smart > *",
    ".viva-download > *",
    ".viva-partners > *",
    ".viva-partner-card"
  ].join(",");
  const elements = [...document.querySelectorAll(targets)];
  elements.forEach((element, index) => {
    element.classList.add("motion-reveal");
    element.style.setProperty("--reveal-delay", `${Math.min(index % 4, 3) * 70}ms`);
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
  elements.forEach(element => observer.observe(element));
}

async function init() {
  const platform = detectPlatform();
  document.documentElement.dataset.appPlatform = platform;
  safeTrack("app_page_view", { plataforma_detectada: platform });

  const config = await getAppDownloadConfig();
  const googleLinks = [...document.querySelectorAll("[data-google-play]")];
  const appStoreLinks = [...document.querySelectorAll("[data-app-store]")];

  googleLinks.forEach(link => setStoreLink(link, config.googlePlayUrl, "Google Play em configuração"));
  appStoreLinks.forEach(link => setStoreLink(link, config.appStoreUrl, "App Store em breve"));

  googleLinks.forEach(link => link.addEventListener("click", event => {
    if (link.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    safeTrack("app_google_play_click", { destino: link.href, plataforma_detectada: platform });
  }));

  appStoreLinks.forEach(link => link.addEventListener("click", event => {
    if (link.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    safeTrack("app_app_store_click", { destino: link.href, plataforma_detectada: platform });
  }));

  bindTrackedLinks();
  bindSmoothAnchors();
  setupHeaderMotion();
  setupRevealMotion();
  loadPartners();
}

init();
