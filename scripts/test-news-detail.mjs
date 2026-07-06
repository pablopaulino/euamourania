import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [service, page, css] = await Promise.all([
  read("assets/js/services/noticiasService.js"),
  read("assets/js/pages/noticia-page.js"),
  read("inner-pages.css")
]);

must(service.includes("categoriaNormalizada"), "Notícias relacionadas não tratam categoria vazia");
must(service.includes("relacionadas.length < limite"), "Notícias relacionadas não possuem fallback");
must(service.includes("slugsIncluidos"), "Fallback pode repetir notícias");
must(service.includes('neq("slug", slugAtual)'), "Notícia atual pode aparecer nas relacionadas");
must(page.includes('class="article-header"'), "Cabeçalho editorial não foi aplicado");
must(page.includes('class="article-breadcrumb"'), "Navegação de retorno não foi aplicada");
must(page.includes('class="article-figure"'), "Imagem principal não possui estrutura editorial");
must(page.includes("readingMinutes"), "Tempo estimado de leitura não foi aplicado");
for (const shareClass of ["btn-share-whatsapp", "btn-share-facebook", "btn-share-copy"]) {
  must(page.includes(shareClass), `Botão de compartilhamento sem identidade: ${shareClass}`);
}
must(page.includes("related-heading"), "Seção Continue lendo não possui cabeçalho");
must(css.includes("max-width: 720px"), "Coluna de leitura não foi limitada");
must(css.includes(".article-copy blockquote"), "Conteúdo rico não estiliza citações");
must(css.includes(".news-detail-container .related-grid"), "Cards relacionados não foram estilizados");
must(css.includes(".btn-share-whatsapp") && css.includes("#1877f2"), "Compartilhamento não possui cores próprias dos canais");
must(css.includes("grid-template-columns: 1fr"), "Cards relacionados não são responsivos");

console.log("Página da notícia validada: leitura editorial, conteúdo rico e recomendações com fallback.");
