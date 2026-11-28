import { getAppDownloadConfig } from "/assets/js/services/appDownloadConfig.js";

import { awardLocal, awardPath, awardPreviewBase, isAwardDemo, readAwardRoute } from "/assets/js/melhoresRoutes.mjs";

const page = document.body.dataset.awardsPage || "home";
const { year } = readAwardRoute();
const local = awardLocal();
const home = awardPath();
const active = (...pages) => pages.includes(page) ? ' aria-current="page"' : "";
const header = `
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header class="award-header">
    <div class="award-shell award-header-inner">
      <a class="award-wordmark" href="${home}" aria-label="Prêmio Melhores de Urânia, início">
        <img src="/assets/melhores/assinatura-2026.png" width="108" height="42" alt="">
      </a>
      <nav id="menu-principal" class="award-nav" aria-label="Navegação do prêmio">
        <a href="${home}"${active("home")}>Início</a>
        <a id="award-nav-nominees" href="${year ? awardPath("edition", { year, local }) + "#vote-area" : home + "#award-past"}"${active("edition", "category")}>Indicados</a>
        <a id="award-nav-voting" href="${year ? awardPath("voting", { year, local }) : home}"${active("voting")}>Votação</a>
        <a href="${awardPath("hall", { local })}"${active("hall", "permanent", "winner", "results")}>Edições</a>
      </nav>
      <a class="award-back" href="https://euamourania.com.br/">Eu Amo Urânia</a>
    </div>
  </header>`;
const footer = `
  <footer class="award-footer">
    <div class="award-shell award-footer-inner">
      <div class="award-credit"><p><small>Uma realização</small><a href="https://euamourania.com.br/"><img src="/assets/1505%20-%20Urania%20-%20Logo%20Horizontal%20-%201.png" width="144" height="32" alt="Eu Amo Urânia"></a></p></div>
      <a data-app-download href="https://euamourania.com.br/app"><img src="/assets/viva-origem-colorido.svg" width="40" height="40" alt=""><span><small>Conheça o app</small><strong>Viva Urânia</strong></span></a>
    </div>
  </footer>`;
const loading='<div class="awards-empty">Carregando informações oficiais…</div>';
const functionalHero=(copyId,panelId)=>`<section class="awards-public-hero"><div class="award-shell awards-public-grid"><div class="awards-public-copy" id="${copyId}"></div><article class="awards-public-panel" id="${panelId}">${loading}</article></div></section>`;
const functionalSection=(title,id,extra="")=>`<section class="awards-section"><div class="award-shell"><header class="awards-section-head"><h2>${title}</h2></header><div id="${id}" ${extra}>${loading}</div></div></section>`;
const faqItems={
  home:[
    ["O que é o Melhores de Urânia?","Uma premiação anual criada pelo Eu Amo Urânia para reconhecer quem contribui com a cidade."],
    ["É preciso pagar para participar?","Não. Participação, indicação ou vitória não dependem de pagamento."],
    ["Como funciona a votação?","As regras e o período são publicados na página oficial de cada edição."]
  ],
  edition:[
    ["Como posso indicar alguém?","Durante o período de indicações, escolha uma categoria e informe o nome da empresa, pessoa ou projeto no formulário desta edição."],
    ["Uma indicação garante participação na votação?","Não. As sugestões passam por análise da organização antes da divulgação dos indicados oficiais."],
    ["É preciso pagar para indicar ou participar?","Não. A indicação e a participação na premiação são gratuitas."],
    ["Onde encontro as regras e as datas?","O regulamento e o cronograma ficam disponíveis nesta página da edição."]
  ]
};
function faqSection(page) {
  const questions = faqItems[page].map(([question, answer]) =>
    `<details name="award-questions"><summary>${question}</summary><p>${answer}</p></details>`
  ).join("");
  const destination = page === "edition" && year ? awardPath("rules", { year, local }) : awardPath("hall", { local });
  const label = page === "edition" && year ? "Consultar regulamento" : "Ver histórico dos vencedores";
  return `<section class="award-help" id="como-funciona"><div class="award-shell award-help-grid">
    <header><h2>Perguntas <em class="award-accent">frequentes</em></h2>${page === "edition" ? `<a class="award-link" href="${destination}">${label}</a>` : ""}</header>
    <div class="award-faq">${questions}</div>
  </div></section>`;
}
const functionalPages={
  home:()=>`<main id="conteudo" class="award-home">
    <section class="award-home-intro">
      <div class="award-shell award-home-grid">
        <div>
          <h1 id="award-home-title">Quem faz a diferença em <em class="award-accent">Urânia</em></h1>
          <p id="award-home-status" role="status">Carregando a edição…</p>
          <div class="award-home-actions" id="award-home-actions"></div>
        </div>
        <div class="award-home-art"><figure id="award-home-cover"><img class="award-home-symbol" src="/assets/melhores/simbolo.png" alt="" width="1602" height="1771"></figure><div id="award-home-tools"></div></div>
      </div>
    </section>
    <section class="award-shell award-home-section" id="awards-home-winners" hidden>
      <h2>Vencedores <em class="award-accent">anunciados</em></h2><ul></ul><a class="award-history-link" href="${awardPath("hall", { local })}">Histórico dos vencedores</a>
    </section>
    <section class="award-shell award-home-section" id="award-past" hidden>
      <h2>Edições anteriores</h2><div class="awards-editions-grid" id="awards-editions"></div>
    </section>
    ${faqSection("home")}
  </main>`,
  edition:()=>`<main id="conteudo">${functionalHero("edition-copy","edition-panel")}${functionalSection("Sobre a edição","edition-hub")}${functionalSection('Conheça os <em class="award-accent">indicados</em>',"vote-area","aria-live='polite'")}<section class="awards-section" id="indicacoes"><div class="award-shell"><header class="awards-section-head"><div><p class="award-eyebrow">Participe</p><h2>Indique quem faz a <em class="award-accent">diferença</em></h2></div><p id="indication-status-copy"></p></header><div id="indication-area" aria-live="polite">${loading}</div></div></section><p id="vote-status-copy" class="sr-only"></p></main>`,
  category:()=>`<main id="conteudo">${functionalHero("category-copy","category-panel")}${functionalSection("Indicados","category-nominees")}</main>`,
  permanent:()=>`<main id="conteudo">${functionalHero("permanent-category-copy","permanent-category-panel")}${functionalSection("Histórico da categoria","permanent-category-years")}</main>`,
  voting:()=>`<main id="conteudo"><section class="awards-section"><div class="award-shell" id="awards-voting-root">${loading}</div></section></main>`,
  results:()=>`<main id="conteudo">${functionalHero("results-copy","results-panel")}${functionalSection("Resultados","results-list")}</main>`,
  hall:()=>`<main id="conteudo">${functionalHero("hall-copy","hall-panel")}${functionalSection("Edições publicadas","hall-list")}</main>`,
  winner:()=>`<main id="conteudo">${functionalHero("winner-copy","winner-panel")}${functionalSection("Perfil do vencedor","winner-content")}</main>`,
  method:()=>`<main id="conteudo">${functionalHero("method-copy","method-panel")}<section class="awards-section"><div class="award-shell"><article id="method-content">${loading}</article></div></section></main>`,
  rules:()=>`<main id="conteudo">${functionalHero("rules-copy","rules-panel")}<section class="awards-section"><div class="award-shell"><article id="rules-content">${loading}</article></div></section></main>`
};
const pageModules={home:"melhores-index-page.js",edition:"melhores-edicao-page.js",category:"melhores-categoria-page.js",permanent:"melhores-categoria-permanente-page.js",voting:"melhores-votacao-page.js",results:"melhores-resultados-page.js",hall:"melhores-hall-page.js",winner:"melhores-vencedor-page.js",method:"melhores-metodologia-page.js",rules:"melhores-regulamento-page.js"};
const app=document.getElementById("awards-preview-app");
const demoMode = isAwardDemo(page);
if (app?.dataset.serverRendered !== "true" || demoMode) {
  app.innerHTML=header+(functionalPages[page]||functionalPages.home)()+footer;
  if(page==="edition") app.querySelector("main")?.insertAdjacentHTML("beforeend",faqSection(page));
}
function setupMobileMenu() {
  const header = app.querySelector(".award-header-inner");
  const nav = header.querySelector(".award-nav");
  const back = header.querySelector(".award-back");
  const panel = document.createElement("div");
  panel.id = "award-navigation";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "award-menu-toggle";
  toggle.setAttribute("aria-controls", panel.id);
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>Menu';
  header.append(toggle, panel);
  panel.append(nav, back);
  const close = () => toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => toggle.setAttribute("aria-expanded", String(toggle.getAttribute("aria-expanded") !== "true")));
  document.addEventListener("click", event => {
    if (!header.contains(event.target) || event.target.closest("a")) close();
  });
  document.addEventListener("focusin", event => { if (!header.contains(event.target)) close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      close();
      toggle.focus();
    }
  });
  matchMedia("(max-width: 768px)").addEventListener("change", close);
  window.addEventListener("pageshow", close);
}
setupMobileMenu();
import(demoMode?`${awardPreviewBase}/awards-demo.js`:`/assets/js/pages/${pageModules[page]||pageModules.home}`).catch(error=>console.error("Melhores de Urânia:",error));
if (!year && !demoMode) {
  import("/assets/js/services/melhoresPublicService.js").then(async ({ edicaoEmDestaque, listarEdicoesPublicas }) => {
    const featured = edicaoEmDestaque(await listarEdicoesPublicas());
    if (!featured) return;
    document.getElementById("award-nav-nominees").href = awardPath("edition", { year: featured.ano, local }) + "#vote-area";
    document.getElementById("award-nav-voting").href = awardPath("voting", { year: featured.ano, local });
  }).catch(() => {});
}

getAppDownloadConfig().then(config => {
  const href = config.googlePlayUrl || config.appStoreUrl || config.appPageUrl || "/app";
  document.querySelectorAll("[data-app-download]").forEach(link => link.href = new URL(href, "https://euamourania.com.br/").href);
}).catch(() => {});
Promise.allSettled([import("/assets/js/pages/analytics-page.js"), import("/assets/js/pages/google-analytics-page.js"), import("/assets/js/pages/error-monitor.js")]);
