const routeMap = new Map([
  ["/preview/home/", "/"], ["/preview/noticias/", "/news/"], ["/preview/guia/", "/guia.html"],
  ["/preview/turismo/", "/turismo.html"], ["/preview/agenda/", "/eventos/"], ["/preview/urania/", "/urania/"],
  ["/preview/melhores/", "/melhores-de-urania/"], ["/preview/iniciativas/", "/iniciativas/"],
  ["/preview/busca/", "/buscar.html"], ["/preview/quem-somos/", "/quem-somos.html"],
  ["/preview/colabore/", "/colabore/"], ["/preview/divulgue/", "/divulgue"],
  ["/preview/cadastrar-empresa/", "/cadastrar-empresa.html"], ["/preview/cadastrar-evento/", "/cadastrar-evento.html"],
  ["/preview/links/", "/links"], ["/preview/noticias/sobre-publicacoes/", "/news/sobre-publicacoes/"],
  ["/preview/noticias/politica-editorial/", "/news/politica-editorial/"],
  ["/preview/noticias/correcoes-transparencia-contato/", "/news/correcoes-transparencia-contato/"],
  ["/preview/termos/", "/termos-de-servico.html"], ["/preview/privacidade/", "/politica-de-privacidade.html"],
  ["/preview/descadastrar/", "/descadastrar.html"]
]);

function dynamicRoute(url) {
  const slug = url.searchParams.get("slug") || "";
  const year = url.searchParams.get("ano") || "";
  const category = url.searchParams.get("categoria") || "";
  if (url.pathname === "/preview/noticias/materia/" && slug) return `/noticias/${encodeURIComponent(slug)}`;
  if (url.pathname === "/preview/guia/empresa/" && slug) return `/guia/${encodeURIComponent(slug)}`;
  if (url.pathname === "/preview/turismo/local/" && slug) return `/turismo/${encodeURIComponent(slug)}`;
  if (url.pathname === "/preview/iniciativas/detalhe/" && slug) return `/iniciativas/${encodeURIComponent(slug)}`;
  if (url.pathname === "/preview/agenda/evento/" && slug) return `/eventos/agenda/${encodeURIComponent(slug)}`;
  if (url.pathname === "/preview/agenda/tradicao/" && slug) return `/eventos/${encodeURIComponent(slug)}`;
  if (url.pathname === "/preview/agenda/edicao/" && slug && year) return `/eventos/${encodeURIComponent(slug)}/${encodeURIComponent(year)}`;
  if (url.pathname === "/preview/categorias/" && category) return `/news/${encodeURIComponent(category)}`;
  if (url.pathname === "/preview/melhores/categoria-permanente/" && category) return `/melhores-de-urania/categorias/${encodeURIComponent(category)}`;
  if (url.pathname === "/preview/melhores/categoria/" && year && category) return `/melhores-de-urania/${encodeURIComponent(year)}/categorias/${encodeURIComponent(category)}`;
  if (url.pathname === "/preview/melhores/edicao/" && year) return `/melhores-de-urania/${encodeURIComponent(year)}`;
  if (url.pathname === "/preview/melhores/votacao/" && year) return category ? `/melhores-de-urania/${encodeURIComponent(year)}/votacao/${encodeURIComponent(category)}` : `/melhores-de-urania/${encodeURIComponent(year)}/votacao`;
  if (["regulamento", "metodologia", "resultados"].some(page => url.pathname === `/preview/melhores/${page}/`) && year) {
    const page = url.pathname.split("/").filter(Boolean).at(-1);
    return `/melhores-de-urania/${encodeURIComponent(year)}/${page}`;
  }
  return "";
}

function productionUrl(value) {
  if (!value || !value.includes("/preview/")) return value;
  try {
    const url = new URL(value, location.origin);
    if (url.origin !== location.origin) return value;
    const mapped = dynamicRoute(url) || routeMap.get(url.pathname);
    if (!mapped) return value;
    const output = new URL(mapped, location.origin);
    if (!dynamicRoute(url)) output.search = url.search;
    output.hash = url.hash;
    return `${output.pathname}${output.search}${output.hash}`;
  } catch { return value; }
}

function rewriteLinks(root = document) {
  root.querySelectorAll?.("a[href]").forEach(link => {
    const next = productionUrl(link.getAttribute("href"));
    if (next !== link.getAttribute("href")) link.setAttribute("href", next);
  });
  root.querySelectorAll?.("form[action]").forEach(form => {
    const next = productionUrl(form.getAttribute("action"));
    if (next !== form.getAttribute("action")) form.setAttribute("action", next);
  });
}

rewriteLinks();
new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
  if (node.nodeType === Node.ELEMENT_NODE) rewriteLinks(node);
}))).observe(document.documentElement, { childList: true, subtree: true });
