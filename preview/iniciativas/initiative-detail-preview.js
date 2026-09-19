import { getSupabase } from "/assets/js/services/supabaseClient.js";
import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

const esc = (value = "") => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const clean = value => String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const leakedAdminText = value => /Exibir na listagem|Salvar iniciativa|Formas de ajuda/i.test(value || "");
const slug = new URLSearchParams(location.search).get("slug") || location.pathname.match(/^\/iniciativas\/([^/]+)\/?$/)?.[1] || "";
const root = document.getElementById("initiative-detail-root");

function helpLink(entry) {
  if (!entry.valor_publico) return "";
  if (entry.tipo === "telefone") return `tel:${String(entry.valor_publico).replace(/\D/g, "")}`;
  if (entry.tipo === "whatsapp") return `https://wa.me/${String(entry.valor_publico).replace(/\D/g, "")}`;
  return entry.valor_publico;
}

function helpLabel(entry) {
  if (entry.tipo === "pix") return "Copiar chave Pix";
  if (entry.tipo === "whatsapp") return "Conversar no WhatsApp";
  if (entry.tipo === "telefone") return "Ligar agora";
  return "Acessar canal";
}

function helpMarkup(items) {
  if (!items.length) return `
    <div class="initiative-help-empty">
      <span>♡</span>
      <p>As formas de participação serão divulgadas aqui quando estiverem disponíveis.</p>
    </div>`;
  return `<div class="initiative-help-list">${items.map((entry, index) => `
    <article class="initiative-help-card">
      <span class="initiative-help-number">${String(index + 1).padStart(2, "0")}</span>
      <div><h3>${esc(entry.titulo || "Como ajudar")}</h3>${entry.descricao ? `<p>${esc(entry.descricao)}</p>` : ""}</div>
      ${entry.tipo === "pix"
        ? `<button type="button" data-pix="${esc(entry.valor_publico || "")}">${helpLabel(entry)} <b>→</b></button>`
        : helpLink(entry) ? `<a href="${esc(helpLink(entry))}" target="_blank" rel="noopener">${helpLabel(entry)} <b>→</b></a>` : ""}
    </article>`).join("")}</div>`;
}

function setupChrome() {
  const header = document.querySelector(".site-header");
  const menu = document.getElementById("menu-principal");
  const toggle = header?.querySelector(".menu-toggle");
  const trigger = header?.querySelector(".search-trigger");
  const input = document.getElementById("header-search-input");
  const closeSearch = () => {
    header?.classList.remove("search-open");
    trigger?.setAttribute("aria-expanded", "false");
  };
  trigger?.addEventListener("click", () => {
    menu?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    header?.classList.add("search-open");
    trigger.setAttribute("aria-expanded", "true");
    setTimeout(() => input?.focus(), 180);
  });
  toggle?.addEventListener("click", () => {
    closeSearch();
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    menu?.classList.toggle("is-open", open);
  });
  header?.querySelector(".header-search-close")?.addEventListener("click", closeSearch);
  document.getElementById("year").textContent = new Date().getFullYear();
  getAppDownloadConfig().then(app => document.querySelectorAll("[data-app-download]").forEach(link => {
    link.href = app.googlePlayUrl || app.appStoreUrl || app.appPageUrl || "/app.html";
  })).catch(() => {});
}

function imageFallback(event) {
  if (event.target.tagName !== "IMG" || event.target.dataset.fallback) return;
  event.target.dataset.fallback = "true";
  event.target.src = "/assets/compartilhamento-logo.png";
  event.target.classList.add("is-fallback");
  event.target.parentElement?.classList.add("has-fallback");
}

async function init() {
  setupChrome();
  root.addEventListener("error", imageFallback, true);
  try {
    const { data: item, error } = await getSupabase().from("iniciativas_comunitarias").select("*").eq("slug", slug).eq("status", "publicado").maybeSingle();
    if (error || !item) throw error || new Error("not-found");
    const { data: help = [] } = await getSupabase().from("iniciativas_formas_ajuda").select("*").eq("iniciativa_id", item.id).eq("ativo", true).order("ordem");
    const fallback = "Conheça esta iniciativa e acompanhe o trabalho realizado em nossa comunidade.";
    const summary = leakedAdminText(item.resumo) ? fallback : clean(item.resumo) || fallback;
    const description = leakedAdminText(item.descricao) ? summary : clean(item.descricao) || summary;
    const image = item.imagem_capa_url || "/assets/compartilhamento-logo.png";
    const type = item.tipo === "projeto" ? "Projeto permanente" : "Ação da comunidade";
    const shareUrl = `https://euamourania.com.br/iniciativas/${item.slug}`;
    const primaryHelp = help.find(entry => entry.tipo === "whatsapp" && helpLink(entry));

    document.title = `${item.titulo} | Iniciativas de Urânia`;
    root.className = "";
    root.innerHTML = `
      <div class="initiative-detail-breadcrumb initiative-shell"><a href="/preview/iniciativas/">Iniciativas</a><span>/</span><span>${esc(item.titulo)}</span></div>
      <section class="initiative-profile initiative-shell">
        <figure class="initiative-profile-media"><img src="${esc(image)}" alt="${esc(item.titulo)}" width="1400" height="1000" fetchpriority="high" decoding="async"><figcaption>Uma iniciativa de Urânia</figcaption></figure>
        <div class="initiative-profile-copy">
          <span class="initiative-detail-type">${esc(type)}</span><h1>${esc(item.titulo)}</h1><p>${esc(summary)}</p>
          <div class="initiative-profile-actions">
            <a class="initiative-primary" href="${primaryHelp ? esc(helpLink(primaryHelp)) : "#historia"}"${primaryHelp ? ' target="_blank" rel="noopener"' : ""}>${primaryHelp ? "Quero participar" : "Conhecer a história"} <b>→</b></a>
            <button type="button" data-share>Compartilhar <b>↗</b></button>
          </div>
        </div>
      </section>
      <section class="initiative-detail-body initiative-shell" id="historia">
        <article class="initiative-story"><p class="initiative-eyebrow">História e propósito</p><h2>Uma ideia que cuida do que está perto.</h2><div class="initiative-story-text"><p>${esc(description)}</p></div></article>
        <aside class="initiative-help" id="como-ajudar"><p class="initiative-eyebrow">Faça parte</p><h2>Como participar.</h2><p class="initiative-help-intro">Cada iniciativa tem seu próprio jeito de receber apoio. Confira os canais informados pelos responsáveis.</p>${helpMarkup(help)}${help.length ? "<small>O Eu Amo Urânia apenas divulga a iniciativa e não processa transferências.</small>" : ""}</aside>
      </section>
      <section class="initiative-community-note"><div class="initiative-shell"><p>Quando a cidade se mobiliza, todo mundo fica mais perto.</p><a href="/preview/iniciativas/">Ver todas as iniciativas <b>→</b></a></div></section>`;

    root.addEventListener("click", async event => {
      const pix = event.target.closest("[data-pix]");
      if (pix) {
        await navigator.clipboard.writeText(pix.dataset.pix);
        pix.textContent = "Chave Pix copiada";
        return;
      }
      if (event.target.closest("[data-share]")) {
        if (navigator.share) await navigator.share({ title: item.titulo, text: summary, url: shareUrl });
        else await navigator.clipboard.writeText(shareUrl);
      }
    });
  } catch (error) {
    console.warn(error);
    root.className = "initiative-detail-loading";
    root.innerHTML = '<h1>Iniciativa não encontrada</h1><p><a href="/preview/iniciativas/">Voltar para iniciativas</a></p>';
  }
  Promise.allSettled([import("/assets/js/pages/site-config-page.js"), import("/assets/js/pages/analytics-page.js"), import("/assets/js/pages/google-analytics-page.js"), import("/assets/js/pages/error-monitor.js")]);
}

init();
