function loadImageStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .hero-visual > img { height: 680px; aspect-ratio: auto; object-fit: cover; object-position: center 45%; }
    @media (max-width: 900px) { .hero-visual > img { height: 560px; } }
    @media (max-width: 620px) { .hero-visual > img { height: 400px; } }
  `;
  document.head.appendChild(style);
}

function updateAboutLinks() {
  document.querySelectorAll('a[href="#sobre"], a[href="index.html#sobre"], a[href="../index.html#sobre"]').forEach(link => {
    link.href = link.getAttribute("href").startsWith("../") ? "../quem-somos.html" : "quem-somos.html";
  });
}

function setupPreviewNavigation() {
  if (window.location.hostname !== "htmlpreview.github.io") return;

  document.addEventListener("click", event => {
    const link = event.target.closest("a");
    if (!link || link.target === "_blank") return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || /^https?:\/\//i.test(href)) return;

    const sourceUrl = decodeURIComponent(window.location.search.slice(1));
    if (!sourceUrl.startsWith("https://raw.githubusercontent.com/")) return;

    event.preventDefault();
    const target = new URL(href, sourceUrl);
    if (target.pathname.endsWith("news-details.html") && target.search) {
      target.hash = target.search.slice(1);
      target.search = "";
    }
    window.location.href = `https://htmlpreview.github.io/?${target.href}`;
  });
}

function updateFooterYear() {
  const yearElement = document.getElementById("year");
  if (yearElement) yearElement.textContent = new Date().getFullYear();
}

function setupMenu() {
  const button = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".main-nav");
  if (!button || !navigation) return;

  const closeMenu = () => {
    button.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
  };

  button.addEventListener("click", () => {
    const willOpen = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(willOpen));
    navigation.classList.toggle("is-open", willOpen);
  });
  navigation.addEventListener("click", event => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeMenu(); button.focus(); }
  });
  window.addEventListener("resize", () => { if (window.innerWidth > 900) closeMenu(); });
}

function setupCookieBanner() {
  const banner = document.getElementById("cookie-banner");
  const acceptButton = document.getElementById("accept-cookies");
  if (!banner || !acceptButton) return;
  try {
    if (!localStorage.getItem("cookieConsent")) banner.hidden = false;
    acceptButton.addEventListener("click", () => { localStorage.setItem("cookieConsent", "accepted"); banner.hidden = true; });
  } catch {
    banner.hidden = false;
    acceptButton.addEventListener("click", () => { banner.hidden = true; });
  }
}

loadImageStyles();
setupPreviewNavigation();

document.addEventListener("DOMContentLoaded", () => {
  updateAboutLinks();
  updateFooterYear();
  setupMenu();
  setupCookieBanner();
});
