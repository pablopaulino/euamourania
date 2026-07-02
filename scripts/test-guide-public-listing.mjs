import fs from "node:fs";

const page = fs.readFileSync("guia.html", "utf8");
const script = fs.readFileSync("assets/js/pages/guia-page.js", "utf8");
const css = fs.readFileSync("inner-pages.css", "utf8");

const checks = [
  [page.includes('id="guia-ver-mais"'), "botão Ver mais ausente da página"],
  [script.includes("const PAGE_SIZE=6"), "limite inicial do Guia não configurado"],
  [script.includes("dados.slice(0,quantidadeVisivel)"), "listagem não está paginando os cartões"],
  [script.includes("quantidadeVisivel+=PAGE_SIZE"), "botão não amplia a listagem"],
  [script.includes("loadMore.hidden=restantes===0"), "botão não é ocultado ao terminar"],
  [script.includes("quantidadeVisivel=PAGE_SIZE"), "filtros não reiniciam a paginação"],
  [script.includes("alvo>=0?Math.max(PAGE_SIZE,alvo+1)"), "links diretos para empresas podem ficar ocultos"],
  [css.includes(".guia-load-more-wrap"), "estilo do botão do Guia ausente"]
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Guia público validado: seis cartões iniciais, filtros, links diretos e botão Ver mais.");
