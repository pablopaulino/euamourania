import { getAppDownloadConfig } from "../services/appDownloadConfig.js";
import { registrarEventoSite } from "../services/analyticsService.js";

const safeTrack = (tipo, metadados = {}) => {
  registrarEventoSite(tipo, {
    pagina: "/app",
    recursoTipo: "app",
    destino: metadados.destino || null,
    metadados
  }).catch(() => {});
};

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
      target.scrollIntoView({ behavior: "smooth", block: "start" });
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

  document.querySelectorAll("[data-app-page-link]").forEach(link => {
    link.addEventListener("click", () => safeTrack("app_internal_cta_click", {
      destino: link.getAttribute("href"),
      label: link.textContent.trim()
    }));
  });

  bindSmoothAnchors();
}

init();
