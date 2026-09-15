import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pages = {
  "preview/home/index.html": "index.html",
  "preview/noticias/index.html": "news/index.html",
  "preview/noticias/materia/index.html": "news-details.html",
  "preview/noticias/sobre-publicacoes/index.html": "news/sobre-publicacoes/index.html",
  "preview/noticias/politica-editorial/index.html": "news/politica-editorial/index.html",
  "preview/noticias/correcoes-transparencia-contato/index.html": "news/correcoes-transparencia-contato/index.html",
  "preview/guia/index.html": "guia.html",
  "preview/guia/empresa/index.html": "guia-details.html",
  "preview/turismo/index.html": "turismo.html",
  "preview/turismo/local/index.html": "turismo-details.html",
  "preview/agenda/index.html": "eventos/index.html",
  "preview/agenda/evento/index.html": "eventos/detalhes.html",
  "preview/agenda/tradicao/index.html": "eventos/evento.html",
  "preview/agenda/edicao/index.html": "eventos/edicao.html",
  "preview/urania/index.html": "urania/index.html",
  "preview/iniciativas/index.html": "iniciativas/index.html",
  "preview/iniciativas/detalhe/index.html": "iniciativas/detalhes.html",
  "preview/busca/index.html": "buscar.html",
  "preview/categorias/index.html": "categorias/index.html",
  "preview/quem-somos/index.html": "quem-somos.html",
  "preview/colabore/index.html": "colabore/index.html",
  "preview/divulgue/index.html": "divulgue.html",
  "preview/cadastrar-empresa/index.html": "cadastrar-empresa.html",
  "preview/cadastrar-evento/index.html": "cadastrar-evento.html",
  "preview/links/index.html": "links/index.html",
  "preview/melhores/index.html": "melhores-de-urania/index.html",
  "preview/melhores/categoria/index.html": "melhores-de-urania/categoria.html",
  "preview/melhores/categoria-permanente/index.html": "melhores-de-urania/categoria-permanente.html",
  "preview/melhores/edicao/index.html": "melhores-de-urania/edicao.html",
  "preview/melhores/metodologia/index.html": "melhores-de-urania/metodologia.html",
  "preview/melhores/regulamento/index.html": "melhores-de-urania/regulamento.html",
  "preview/melhores/resultados/index.html": "melhores-de-urania/resultados.html",
  "preview/melhores/votacao/index.html": "melhores-de-urania/votacao.html",
  "preview/termos/index.html": "termos-de-servico.html",
  "preview/privacidade/index.html": "politica-de-privacidade.html",
  "preview/descadastrar/index.html": "descadastrar.html"
};
const staticRoutes = {
  "/preview/home/": "/", "/preview/noticias/": "/news/", "/preview/guia/": "/guia.html",
  "/preview/turismo/": "/turismo.html", "/preview/agenda/": "/eventos/", "/preview/urania/": "/urania/",
  "/preview/melhores/": "/melhores-de-urania/", "/preview/iniciativas/": "/iniciativas/",
  "/preview/busca/": "/buscar.html", "/preview/quem-somos/": "/quem-somos.html",
  "/preview/colabore/": "/colabore/", "/preview/divulgue/": "/divulgue", "/preview/links/": "/links",
  "/preview/termos/": "/termos-de-servico.html", "/preview/privacidade/": "/politica-de-privacidade.html",
  "/preview/descadastrar/": "/descadastrar.html"
};
const keepNoindex = new Set(["buscar.html", "descadastrar.html"]);

for (const [source, target] of Object.entries(pages)) {
  let html = await readFile(join(root, source), "utf8");
  if (!keepNoindex.has(target)) {
    html = html.replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, "");
  }
  html = html.replace(/ — nova identidade(?=\s*\|?)/gi, "");
  const sourceUrl = new URL(source, "https://preview.local/");
  html = html.replace(/\b(href|src|action)=(['"])(\.\.?(?:\/[^'"]*)?)\2/g, (match, attribute, quote, value) => {
    const resolved = new URL(value, sourceUrl);
    return `${attribute}=${quote}${resolved.pathname}${resolved.search}${resolved.hash}${quote}`;
  });
  html = html.replace(/href=(['"])(\/preview\/[^'"?#]+\/?)(?:\1)/g, (match, quote, value) => staticRoutes[value] ? `href=${quote}${staticRoutes[value]}${quote}` : match);
  if (!html.includes("/assets/js/pages/production-links.js")) {
    html = html.replace("</body>", '<script type="module" src="/assets/js/pages/production-links.js"></script></body>');
  }
  const destination = join(root, target);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, html);
  console.log(`${source} -> ${target}`);
}
