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
const PARTNERS_MINIMUM_VISIBLE = 15;
const PARTNERS_AUTOSCROLL_INTERVAL = 4200;

function detectPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

function setStoreLink(link, url, fallbackLabel) {
  if (!link) return;
  const hasUrl = Boolean(url);
  link.hidden = !hasUrl;
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
      target.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <img src="${safeImage(item.imagem_url)}" alt="${escapeHtml(item.nome)}" width="420" height="260" loading="lazy" decoding="async">
    </a>
    <div class="viva-partner-body">
      <small>${escapeHtml(item.categoria_nome || "Guia Comercial")}</small>
      <strong>${escapeHtml(item.nome)}</strong>
      ${item.descricao ? `<p>${escapeHtml(item.descricao)}</p>` : ""}
    </div>
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
      select: "id,nome,slug,descricao,imagem_url,categoria_nome,recomendado",
      status: "eq.publicado",
      order: "recomendado.desc,nome.asc",
      limit: String(PARTNERS_LIMIT)
    }, { ttl: 300000, timeout: 5000 });
    const partners = (rows || []).slice(0, Math.max(PARTNERS_MINIMUM_VISIBLE, rows?.length || 0));
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
  if (
    cards.length < 2
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || window.matchMedia("(max-width: 720px)").matches
  ) return;

  list.classList.add("is-auto-scrolling");
  cards.forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a").forEach(link => {
      link.tabIndex = -1;
      link.removeAttribute("data-app-page-link");
    });
    list.appendChild(clone);
  });

  let paused = false;
  const setPaused = value => {
    paused = value;
  };
  const getStep = () => {
    const card = cards[0];
    if (!card) return 280;
    const styles = getComputedStyle(list);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    return card.getBoundingClientRect().width + gap;
  };
  const move = () => {
    if (paused || list.scrollWidth <= list.clientWidth) return;
    const resetPoint = list.scrollWidth / 2;
    if (list.scrollLeft >= resetPoint) {
      list.scrollLeft = 0;
      return;
    }
    list.scrollBy({ left: getStep(), behavior: "smooth" });
  };

  const timer = window.setInterval(move, PARTNERS_AUTOSCROLL_INTERVAL);
  list.addEventListener("mouseenter", () => setPaused(true));
  list.addEventListener("mouseleave", () => setPaused(false));
  list.addEventListener("focusin", () => setPaused(true));
  list.addEventListener("focusout", () => setPaused(false));
  list.addEventListener("touchstart", () => setPaused(true), { passive: true });
  list.addEventListener("touchend", () => window.setTimeout(() => setPaused(false), 1800), { passive: true });
  window.addEventListener("pagehide", () => window.clearInterval(timer), { once: true });
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
  const googleLink = document.querySelector("[data-google-play]");
  const appStoreLink = document.querySelector("[data-app-store]");

  setStoreLink(googleLink, config.googlePlayUrl, "Google Play em configuração");
  setStoreLink(appStoreLink, config.appStoreUrl, "App Store em breve");

  googleLink?.addEventListener("click", event => {
    if (googleLink.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    safeTrack("app_google_play_click", { destino: googleLink.href, plataforma_detectada: platform });
  });

  appStoreLink?.addEventListener("click", event => {
    if (appStoreLink.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      return;
    }
    safeTrack("app_app_store_click", { destino: appStoreLink.href, plataforma_detectada: platform });
  });

  bindTrackedLinks();
  bindSmoothAnchors();
  setupSlides();
  loadPartners();
}

init();
