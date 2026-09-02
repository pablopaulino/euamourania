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
  return "/assets/compartilhamento-logo.png";
};

const safeTrack = (tipo, metadados = {}) => {
  registrarEventoSite(tipo, {
    pagina: "/app",
    recursoTipo: "app",
    destino: metadados.destino || null,
    metadados
  }).catch(() => {});
};

const PARTNERS_LIMIT = 24;

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
        <small>Destaque no Guia</small>
      </span>
    </a>
  </article>`;
}

async function loadPartners() {
  const list = document.getElementById("viva-partners-list");
  if (!list) return;
  if (!publicSupabaseConfigured()) {
    list.innerHTML = `<p class="partners-empty">Parceiros indisponíveis no momento.</p>`;
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
    list.innerHTML = partners.length ? partners.map(partnerCard).join("") : `<p class="partners-empty">Em breve, novos parceiros por aqui.</p>`;
    setupPartnersAutoscroll(list);
    bindTrackedLinks(list);
  } catch (error) {
    console.warn("Parceiros do Viva Urânia:", error.message);
    list.innerHTML = `<p class="partners-empty">Não foi possível carregar os parceiros agora.</p>`;
  }
}

function setupPartnersAutoscroll(list) {
  const cards = [...list.querySelectorAll(".viva-partner-card")];
  if (cards.length < 2 || prefersReducedMotion()) {
    list.classList.add("is-static");
    return;
  }

  list.classList.add("is-auto-scrolling");
  const addCloneSet = () => cards.forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a").forEach(link => {
      link.tabIndex = -1;
      link.removeAttribute("data-app-page-link");
    });
    list.appendChild(clone);
  });
  addCloneSet();

  let cloneRuns = 1;
  while (list.scrollWidth < list.clientWidth * 2 && cloneRuns < 5) {
    addCloneSet();
    cloneRuns += 1;
  }

  let paused = false;
  let rafId = 0;
  const speed = window.matchMedia("(max-width: 720px)").matches ? 0.22 : 0.34;
  const setPaused = value => {
    paused = value;
  };
  const tick = () => {
    if (!paused && list.scrollWidth > list.clientWidth) {
      const resetPoint = list.scrollWidth / 2;
      list.scrollLeft = list.scrollLeft >= resetPoint ? 0 : list.scrollLeft + speed;
    }
    rafId = window.requestAnimationFrame(tick);
  };
  const stop = () => window.cancelAnimationFrame(rafId);

  list.addEventListener("mouseenter", () => setPaused(true));
  list.addEventListener("mouseleave", () => setPaused(false));
  list.addEventListener("focusin", () => setPaused(true));
  list.addEventListener("focusout", () => setPaused(false));
  list.addEventListener("touchstart", () => setPaused(true), { passive: true });
  list.addEventListener("touchend", () => window.setTimeout(() => setPaused(false), 1800), { passive: true });
  window.addEventListener("pagehide", stop, { once: true });
  rafId = window.requestAnimationFrame(tick);
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
    ".viva-trust-strip span",
    ".viva-section-head",
    ".viva-ecosystem-grid article",
    ".viva-app-screen",
    ".viva-showcase-notes span",
    ".viva-daily > *",
    ".viva-smart-guide > *",
    ".viva-tourism > *",
    ".viva-business > *",
    ".viva-partners > *",
    ".viva-brand-story > *",
    ".viva-download > *"
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

function setupTourismDepth() {
  if (prefersReducedMotion() || window.matchMedia("(max-width: 720px)").matches) return;
  const image = document.querySelector(".viva-tourism img");
  if (!image) return;
  let ticking = false;
  const update = () => {
    const rect = image.getBoundingClientRect();
    const progress = ((rect.top + rect.height / 2) - window.innerHeight / 2) / window.innerHeight;
    const offset = Math.max(-8, Math.min(8, progress * -10));
    image.style.transform = `translateY(${offset}px)`;
    ticking = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function setupSlides() {
  const slides = [...document.querySelectorAll(".viva-slide")];
  if (!slides.length) return;
  const setActive = index => {
    slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
    slides[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };
  document.querySelectorAll("[data-viva-slide]").forEach(button => {
    button.addEventListener("click", () => {
      const current = Math.max(0, slides.findIndex(slide => slide.classList.contains("active")));
      const next = button.dataset.vivaSlide === "next"
        ? (current + 1) % slides.length
        : (current - 1 + slides.length) % slides.length;
      setActive(next);
    });
  });
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
  setupTourismDepth();
  setupSlides();
  loadPartners();
}

init();
