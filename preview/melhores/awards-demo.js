// Prévia visual isolada: estes dados nunca são enviados ao Supabase.
const demoBase = "/preview/melhores/";
const demoStyle = document.createElement("link");
demoStyle.rel = "stylesheet";
demoStyle.href = `${demoBase}awards-demo.css`;
document.head.append(demoStyle);
const votingLink = `${demoBase}votacao/?demo=1`;
const resultsLink = `${demoBase}resultados/?demo=1`;
const localDemo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const hallLink = "/melhores-de-urania/hall.html?demo=1";
const profileLink = "/melhores-de-urania/vencedor.html?demo=1";
const edition = {
  id: "demo-edition",
  ano: 2026,
  nome: "Melhores de Urânia 2026",
  descricao: "Uma amostra visual da premiação, sem votação nem resultado oficial.",
  status: "votacao_aberta",
  resultado_publicado_em: "2026-12-20T15:00:00-03:00"
};
const categories = [
  { id: "demo-category-1", slug: "comercio-exemplo", nome: "Comércio local", descricao: "Escolha um nome para conhecer o formato da votação.", max_escolhas: 1 },
  { id: "demo-category-2", slug: "iniciativa-exemplo", nome: "Iniciativa da cidade", descricao: "Outra categoria ilustrativa da edição.", max_escolhas: 1 }
];
const nominees = [
  { id: "demo-nominee-1", categoria_id: categories[0].id, nome: "Loja Modelo", descricao_curta: "Participante fictício para a prévia visual." },
  { id: "demo-nominee-2", categoria_id: categories[0].id, nome: "Café Exemplo", descricao_curta: "Participante fictício para a prévia visual." },
  { id: "demo-nominee-3", categoria_id: categories[0].id, nome: "Mercado Modelo", descricao_curta: "Participante fictício para a prévia visual." },
  { id: "demo-nominee-4", categoria_id: categories[0].id, nome: "Ateliê Exemplo", descricao_curta: "Participante fictício para a prévia visual." },
  { id: "demo-nominee-5", categoria_id: categories[1].id, nome: "Projeto Modelo", imagem_url: "/assets/AD3A1763-min%20(1).jpg", descricao_curta: "Iniciativa fictícia para a prévia visual." },
  { id: "demo-nominee-6", categoria_id: categories[1].id, nome: "Associação Exemplo", imagem_url: "/assets/3Q2A7854-min-min.jpg", descricao_curta: "Iniciativa fictícia para a prévia visual." },
  { id: "demo-nominee-7", categoria_id: categories[1].id, nome: "Coletivo Modelo", imagem_url: "/assets/1V4A4044-min.jpg", descricao_curta: "Iniciativa fictícia para a prévia visual." },
  { id: "demo-nominee-8", categoria_id: categories[1].id, nome: "Ação Exemplo", descricao_curta: "Iniciativa fictícia para a prévia visual." }
];
const results = nominees.map((nominee, index) => ({
  id: `demo-result-${index + 1}`,
  edicao_id: edition.id,
  categoria_id: nominee.categoria_id,
  indicado_id: nominee.id,
  colocacao: index % 4 + 1,
  vencedor: index % 4 === 0,
  votos_site: [214, 187, 156, 134, 230, 199, 172, 141][index],
  votos_instagram: [98, 82, 74, 65, 91, 76, 68, 54][index],
  publicado_em: edition.resultado_publicado_em,
  melhores_categorias: categories.find(category => category.id === nominee.categoria_id),
  melhores_indicados: nominee
}));

const main = document.querySelector("main");
const demoPage = document.body.dataset.awardsPage;
const votingPage = demoPage === "voting";
main.insertAdjacentHTML("afterbegin", `<aside class="awards-demo-banner" aria-label="Prévia demonstrativa">
  <span><strong>PRÉVIA VISUAL</strong> · Nomes e fotos ilustrativos. Sem votos oficiais.</span>
  <nav aria-label="Telas da prévia">
    <a href="${votingLink}">Votação</a>
    <a href="${resultsLink}">Resultados</a>
    ${localDemo ? `<a href="${hallLink}">Hall</a><a href="${profileLink}">Perfil</a>` : `<a href="${resultsLink}#hall-dos-vencedores">Vencedores</a>`}
    ${votingPage ? '<button type="button" data-reset-demo aria-label="Reiniciar prévia">Reiniciar</button>' : ""}
  </nav>
  <p id="awards-demo-notice" role="status" aria-live="polite"></p>
</aside>`);

const notice = document.getElementById("awards-demo-notice");
if (votingPage) {
  const { renderHub, renderCategory } = await import("/assets/js/pages/melhores-votacao-page.js");
  const demoVoteKey = `euamourania:melhores:votos:${edition.id}`;
  const showCategory = slug => {
    if (slug) renderCategory(edition, categories, nominees, slug);
    else renderHub(edition, categories, nominees);
    notice.textContent = "";
  };
  showCategory(new URLSearchParams(location.search).get("categoria"));
  main.addEventListener("click", event => {
    if (event.target.closest("[data-reset-demo]")) {
      localStorage.removeItem(demoVoteKey);
      const slug = new URLSearchParams(location.search).get("categoria");
      const url = new URL(votingLink, location.origin);
      if (slug) url.searchParams.set("categoria", slug);
      history.replaceState({}, "", url);
      showCategory(slug);
      notice.textContent = "Prévia reiniciada. Nenhum dado oficial foi alterado.";
      return;
    }
    const vote = event.target.closest("[data-vote]");
    if (vote) {
      event.preventDefault();
      if (vote.disabled) return;
      const stored = JSON.parse(localStorage.getItem(demoVoteKey) || "{}");
      stored[vote.dataset.category] = [vote.dataset.nominee];
      localStorage.setItem(demoVoteKey, JSON.stringify(stored));
      showCategory(new URLSearchParams(location.search).get("categoria"));
      notice.textContent = "Voto simulado apenas nesta prévia. Nenhum dado foi enviado.";
      document.querySelector(".vote-confirmation")?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "center"
      });
      return;
    }
    if (event.target.closest("[data-share-voting]")) {
      if (!navigator.clipboard?.writeText) {
        notice.textContent = "Esta é apenas uma prévia visual; o compartilhamento oficial virá na votação.";
        return;
      }
      navigator.clipboard.writeText(new URL(votingLink, location.origin).href).then(() => {
        notice.textContent = "Link da prévia copiado. Nenhum voto oficial foi compartilhado.";
      }).catch(() => {
        notice.textContent = "Esta é apenas uma prévia visual; o compartilhamento oficial virá na votação.";
      });
      return;
    }
    const share = event.target.closest("[data-share-category]");
    if (share) {
      const demoUrl = new URL(votingLink, location.origin);
      demoUrl.searchParams.set("categoria", new URLSearchParams(location.search).get("categoria") || "");
      if (!navigator.clipboard?.writeText) {
        notice.textContent = "Esta é apenas uma prévia visual; o compartilhamento oficial virá na votação.";
        return;
      }
      navigator.clipboard.writeText(demoUrl.href).then(() => {
        notice.textContent = "Link da prévia copiado. Nenhum voto oficial foi compartilhado.";
      }).catch(() => {
        notice.textContent = "Esta é apenas uma prévia visual; o compartilhamento oficial virá na votação.";
      });
      return;
    }
    const link = event.target.closest('a[href^="/melhores-de-urania/"]');
    if (!link) return;
    event.preventDefault();
    const match = link.pathname.match(/\/votacao\/([^/]+)\/?$/);
    const slug = match?.[1] || "";
    const url = new URL(votingLink, location.origin);
    if (slug) url.searchParams.set("categoria", slug);
    if (new URL(link.href).searchParams.has("concluido")) url.searchParams.set("concluido", "1");
    history.pushState({}, "", url);
    showCategory(slug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("popstate", () => showCategory(new URLSearchParams(location.search).get("categoria")));
} else if (demoPage === "hall") {
  const { esc, winnerCard } = await import("/assets/js/pages/melhores-resultados-page.js");
  const winners = results.filter(row => row.vencedor);
  const hallCopy = document.getElementById("hall-copy");
  const hallPanel = document.getElementById("hall-panel");
  const hallList = document.getElementById("hall-list");
  hallCopy.innerHTML = `<span class="awards-public-badge">Prévia demonstrativa</span><h1>Hall dos vencedores</h1><p>Veja como as conquistas de cada edição ficarão reunidas após a divulgação oficial.</p><div class="hero-actions"><a class="button button-secondary" href="${resultsLink}">Ver resultados de exemplo</a></div>`;
  hallPanel.innerHTML = `<h2>Histórico da cidade</h2><p>Os nomes e as categorias abaixo são fictícios. Nenhum vencedor oficial foi anunciado nesta prévia.</p>`;
  hallList.innerHTML = `<section class="awards-hall-year"><header class="awards-hall-year-head"><div><p class="eyebrow">Edição ilustrativa</p><h2>${esc(String(edition.ano))}</h2></div><a href="${profileLink}">Ver perfil de exemplo →</a></header><div class="awards-winners-hall">${winners.map(row => winnerCard(row, new Map(), edition, true)).join("")}</div></section>`;
} else if (demoPage === "winner") {
  const example = results.find(row => row.vencedor && row.melhores_indicados?.imagem_url) || results.find(row => row.vencedor);
  const nominee = example.melhores_indicados;
  const category = example.melhores_categorias;
  document.getElementById("winner-copy").innerHTML = `<span class="awards-public-badge">Prévia demonstrativa</span><h1>${nominee.nome}</h1><p>${category.nome} · edição ilustrativa ${edition.ano}</p><div class="hero-actions"><a class="button button-secondary" href="${hallLink}">Ver Hall de exemplo</a></div>`;
  document.getElementById("winner-panel").innerHTML = `<h2>Perfil de exemplo</h2><p>Esta página mostra o formato futuro do registro individual, sem atribuir uma premiação real.</p>`;
  document.getElementById("winner-content").innerHTML = `<article class="awards-winner-profile"><div class="awards-winner-photo"><span class="awards-winner-initial" aria-hidden="true">${nominee.nome.charAt(0)}</span>${nominee.imagem_url ? `<img src="${nominee.imagem_url}" alt="" loading="eager" width="640" height="640">` : ""}</div><div class="awards-winner-profile-body"><p class="eyebrow">Vencedor fictício</p><h2>${nominee.nome}</h2><p>${nominee.descricao_curta}</p><div class="awards-winner-profile-links"><a class="button button-secondary" href="${resultsLink}">Resultados de exemplo</a></div></div></article>`;
} else {
  const { renderResults } = await import("/assets/js/pages/melhores-resultados-page.js");
  document.getElementById("results-copy").innerHTML = `<span class="awards-public-badge">Prévia demonstrativa</span><h1>Resultados da edição</h1><p>Veja como o resultado por ano será apresentado após a publicação oficial.</p><div class="hero-actions"><a class="button button-secondary" href="${votingLink}">Ver votação</a></div>`;
  document.getElementById("results-panel").innerHTML = `<h2>Edição de exemplo</h2><p>Os nomes, categorias e números abaixo são fictícios.</p><div class="awards-status-line"><span class="awards-chip">Apenas visualização</span></div>`;
  document.querySelector("#results-list")?.closest(".awards-section")?.querySelector(".awards-section-head h2")?.replaceChildren(document.createTextNode("Resultados de exemplo"));
  document.getElementById("results-list").innerHTML = renderResults(results, edition, results.filter(row => row.vencedor), { demo: true });
  if (location.hash === "#hall-dos-vencedores") {
    requestAnimationFrame(() => document.getElementById("hall-dos-vencedores")?.scrollIntoView());
  }
}
