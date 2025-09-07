// Este script é usado em todas as páginas para funcionalidades globais.

// Função para obter o ano atual e inserir no rodapé
function updateFooterYear() {
    const currentYear = new Date().getFullYear();
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = currentYear;
    }
}

// Função para lidar com o banner de cookies
function handleCookieBanner() {
    const cookieConsent = localStorage.getItem("cookieConsent");
    const cookieBanner = document.getElementById("cookie-banner");
    
    if (!cookieConsent && cookieBanner) {
        cookieBanner.style.display = "block";
    }

    const acceptCookiesBtn = document.getElementById("accept-cookies");
    if (acceptCookiesBtn) {
        acceptCookiesBtn.addEventListener("click", () => {
            localStorage.setItem("cookieConsent", "true");
            if (cookieBanner) {
                cookieBanner.style.display = "none";
            }
        });
    }
}

// Executa as funções quando a página é carregada
document.addEventListener("DOMContentLoaded", () => {
    updateFooterYear();
    handleCookieBanner();
});
