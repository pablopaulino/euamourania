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
        <span>Prêmio</span><strong>Melhores de Urânia</strong>
      </a>
      <nav id="menu-principal" class="award-nav" aria-label="Navegação do prêmio">
        <a href="${home}"${active("home")}>Início</a>
        <a id="award-nav-nominees" href="${year ? awardPath("edition", { year, local }) + "#vote-area" : home + "#award-past"}"${active("category")}>Indicados</a>
        <a id="award-nav-voting" href="${year ? awardPath("voting", { year, local }) : home}"${active("voting")}>Votação</a>
        <a href="${awardPath("hall", { local })}"${active("hall", "permanent", "winner", "results")}>Edições</a>
      </nav>
      <a class="award-back" href="https://euamourania.com.br/">← Eu Amo Urânia</a>
    </div>
  </header>`;
const footer = `
  <footer class="award-footer">
    <div class="award-shell award-footer-inner">
      <p>Uma realização <a href="https://euamourania.com.br/">Eu Amo Urânia</a></p>
      <a data-app-download href="https://euamourania.com.br/app">Viva Urânia</a>
    </div>
  </footer>`;
const section=(eyebrow,title,description,content)=>`<section class="award-section"><div class="award-shell"><header class="award-section-head"><div><p class="award-eyebrow">${eyebrow}</p><h2>${title}</h2></div>${description?`<p>${description}</p>`:""}</header>${content}</div></section>`;

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
const faqSection=page=>section("Dúvidas","Perguntas frequentes.",page==="home"?"Informações claras sobre a premiação.":"Respostas sobre as indicações e a edição.",`<div class="award-faq">${faqItems[page].map(([question,answer])=>`<details><summary>${question}</summary><p>${answer}</p></details>`).join("")}</div>`);
const functionalPages={
  home:()=>`<main id="conteudo" class="award-home">
    <section class="award-home-intro">
      <div class="award-shell award-home-grid">
        <div>
          <h1 id="award-home-title"><em class="award-accent">Melhores</em> de Urânia</h1>
          <p id="award-home-status" role="status">Carregando a edição…</p>
          <div class="award-home-actions" id="award-home-actions"></div>
        </div>
        <figure id="award-home-cover" hidden></figure>
      </div>
    </section>
    <section class="award-shell award-home-section" id="awards-home-winners" hidden>
      <h2>Vencedores anunciados</h2><ul></ul>
    </section>
    <section class="award-shell award-home-section" id="award-past" hidden>
      <h2>Edições anteriores</h2><div class="awards-editions-grid" id="awards-editions"></div>
    </section>
    <section class="award-shell award-home-section award-home-about" id="como-funciona">
      <h2>Sobre o prêmio</h2>
      <div class="award-faq">${faqItems.home.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join("")}</div>
      <a class="award-link" href="${awardPath("hall", { local })}">Ver histórico dos vencedores</a>
    </section>
  </main>`,
  edition:()=>`<main id="conteudo">${functionalHero("edition-copy","edition-panel")}${functionalSection("Edição oficial","edition-hub")}${functionalSection("Votação","vote-area","aria-live='polite'")}<section class="awards-section" id="indicacoes"><div class="award-shell"><header class="awards-section-head"><div><p class="award-eyebrow">Participe</p><h2>Indique quem faz a diferença.</h2></div><p id="indication-status-copy"></p></header><div id="indication-area" aria-live="polite">${loading}</div></div></section><p id="vote-status-copy" class="sr-only"></p></main>`,
  category:()=>`<main id="conteudo">${functionalHero("category-copy","category-panel")}${functionalSection("Indicados","category-nominees")}</main>`,
  permanent:()=>`<main id="conteudo">${functionalHero("permanent-category-copy","permanent-category-panel")}${functionalSection("Histórico da categoria","permanent-category-years")}</main>`,
  voting:()=>`<main id="conteudo"><section class="awards-section"><div class="award-shell" id="awards-voting-root">${loading}</div></section></main>`,
  results:()=>`<main id="conteudo">${functionalHero("results-copy","results-panel")}${functionalSection("Resultados","results-list")}</main>`,
  hall:()=>`<main id="conteudo">${functionalHero("hall-copy","hall-panel")}${functionalSection("Edições publicadas","hall-list")}</main>`,
  winner:()=>`<main id="conteudo">${functionalHero("winner-copy","winner-panel")}${functionalSection("Perfil do vencedor","winner-content")}</main>`,
  method:()=>`<main id="conteudo">${functionalHero("method-copy","method-panel")}${functionalSection("Metodologia","method-content")}</main>`,
  rules:()=>`<main id="conteudo">${functionalHero("rules-copy","rules-panel")}${functionalSection("Regulamento","rules-content")}</main>`
};
const pageModules={home:"melhores-index-page.js",edition:"melhores-edicao-page.js",category:"melhores-categoria-page.js",permanent:"melhores-categoria-permanente-page.js",voting:"melhores-votacao-page.js",results:"melhores-resultados-page.js",hall:"melhores-hall-page.js",winner:"melhores-vencedor-page.js",method:"melhores-metodologia-page.js",rules:"melhores-regulamento-page.js"};
const app=document.getElementById("awards-preview-app");app.innerHTML=header+(functionalPages[page]||functionalPages.home)()+footer;
if(page==="edition") app.querySelector("main")?.insertAdjacentHTML("beforeend",faqSection(page));
const demoMode = isAwardDemo(page);
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
