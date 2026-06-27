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

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
      button.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
  });
}

function setupCookieBanner() {
  const banner = document.getElementById("cookie-banner");
  const acceptButton = document.getElementById("accept-cookies");
  if (!banner || !acceptButton) return;

  try {
    if (!localStorage.getItem("cookieConsent")) banner.hidden = false;
    acceptButton.addEventListener("click", () => {
      localStorage.setItem("cookieConsent", "accepted");
      banner.hidden = true;
    });
  } catch {
    banner.hidden = false;
    acceptButton.addEventListener("click", () => { banner.hidden = true; });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateFooterYear();
  setupMenu();
  setupCookieBanner();
});
