import { GOOGLE_PLAY_URL, getAppDownloadConfig } from "../services/appDownloadConfig.js";

const SESSION_KEY = "viva_app_banner_shown";
const OFFICIAL_ORIGIN = "https://euamourania.com.br";

function isEligibleAndroidBrowser() {
  const userAgent = navigator.userAgent || "";
  const android = /Android/i.test(userAgent);
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  const webView = Boolean(window.ReactNativeWebView) || /;\s*wv\)/i.test(userAgent) || /VivaUraniaApp/i.test(userAgent);
  return android && !ios && !webView;
}

function wasShown() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markAsShown() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // Browsers that block storage may still display the non-blocking banner.
  }
}

function safeSlug(value) {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9-]+$/.test(slug) ? slug : null;
}

function currentAppLink() {
  const pathname = location.pathname.replace(/\/{2,}/g, "/");
  const querySlug = safeSlug(new URLSearchParams(location.search).get("slug"));
  const legacyRoutes = {
    "/guia-details.html": "guia",
    "/turismo-details.html": "turismo",
    "/news-details.html": "noticias",
    "/news-detalhes.html": "noticias",
    "/eventos/detalhes.html": "eventos/agenda",
  };

  if (querySlug && legacyRoutes[pathname]) return `${OFFICIAL_ORIGIN}/${legacyRoutes[pathname]}/${encodeURIComponent(querySlug)}`;

  const directPatterns = [
    /^\/guia\/[a-z0-9-]+\/?$/,
    /^\/turismo\/[a-z0-9-]+\/?$/,
    /^\/eventos\/agenda\/[a-z0-9-]+\/?$/,
    /^\/noticias\/[a-z0-9-]+\/?$/,
    /^\/iniciativas\/[a-z0-9-]+\/?$/,
  ];
  if (directPatterns.some(pattern => pattern.test(pathname))) return `${OFFICIAL_ORIGIN}${pathname.replace(/\/$/, "")}`;

  if (pathname === "/guia" || pathname === "/guia.html" || pathname.startsWith("/guia/")) return `${OFFICIAL_ORIGIN}/guia.html`;
  if (pathname === "/turismo" || pathname === "/turismo.html" || pathname.startsWith("/turismo/")) return `${OFFICIAL_ORIGIN}/turismo.html`;
  if (pathname === "/eventos" || pathname.startsWith("/eventos/")) return `${OFFICIAL_ORIGIN}/eventos/`;
  if (pathname === "/news" || pathname.startsWith("/news/") || pathname === "/noticias") return `${OFFICIAL_ORIGIN}/news/`;
  if (pathname === "/iniciativas" || pathname.startsWith("/iniciativas/")) return `${OFFICIAL_ORIGIN}/iniciativas/`;
  return `${OFFICIAL_ORIGIN}/`;
}

function ensureStyles() {
  if (document.querySelector("link[data-viva-app-banner-style]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/css/smart-app-banner.css";
  link.dataset.vivaAppBannerStyle = "true";
  document.head.append(link);
}

function setupBottomOffset(banner) {
  const cookieBanner = document.getElementById("cookie-banner");
  if (!cookieBanner) return () => {};
  const update = () => {
    const offset = cookieBanner.hidden ? 0 : Math.ceil(cookieBanner.getBoundingClientRect().height + 12);
    banner.style.setProperty("--viva-app-banner-offset", `${offset}px`);
  };
  const observer = new MutationObserver(update);
  observer.observe(cookieBanner, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("resize", update, { passive: true });
  update();
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", update);
  };
}

export function setupSmartAppBanner() {
  if (!isEligibleAndroidBrowser() || wasShown() || document.querySelector("[data-viva-app-banner]")) return;
  ensureStyles();

  const banner = document.createElement("aside");
  banner.className = "viva-app-banner";
  banner.dataset.vivaAppBanner = "true";
  banner.setAttribute("aria-label", "Abrir o Viva Urânia");
  banner.innerHTML = `
    <img class="viva-app-banner__icon" src="/assets/logo-viva-urania-coracao.svg" alt="" width="48" height="48">
    <div class="viva-app-banner__copy">
      <strong>Viva Urânia</strong>
      <span>Tudo sobre Urânia em um só lugar.</span>
    </div>
    <div class="viva-app-banner__actions">
      <a class="viva-app-banner__open" href="${currentAppLink()}">Abrir no app</a>
      <a class="viva-app-banner__download" href="${GOOGLE_PLAY_URL}" target="_blank" rel="noopener">Baixar</a>
    </div>
    <button class="viva-app-banner__close" type="button" aria-label="Fechar sugestão do aplicativo">×</button>`;

  document.body.append(banner);
  markAsShown();
  const clearOffset = setupBottomOffset(banner);
  requestAnimationFrame(() => banner.classList.add("is-visible"));

  banner.querySelector(".viva-app-banner__close")?.addEventListener("click", () => {
    clearOffset();
    banner.classList.remove("is-visible");
    banner.classList.add("is-leaving");
    window.setTimeout(() => banner.remove(), 180);
  });

  void getAppDownloadConfig().then(config => {
    const download = banner.querySelector(".viva-app-banner__download");
    if (download && config.googlePlayUrl) download.href = config.googlePlayUrl;
  });
}

setupSmartAppBanner();
