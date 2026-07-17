import fs from "node:fs";

const page = fs.readFileSync("guia.html", "utf8");
const script = fs.readFileSync("assets/js/pages/guia-page.js", "utf8");
const homeGuide = fs.readFileSync("assets/js/pages/home-guide-page.js", "utf8");
const css = fs.readFileSync("inner-pages.css", "utf8");

const checks = [
  [page.includes('id="guia-ver-mais"'), "botao Ver mais ausente da pagina"],
  [script.includes("const PAGE_SIZE=6"), "limite inicial do Guia nao configurado"],
  [script.includes("dados.slice(0,quantidadeVisivel)"), "listagem nao esta paginando os cartoes"],
  [script.includes("quantidadeVisivel+=PAGE_SIZE"), "botao nao amplia a listagem"],
  [script.includes("loadMore.hidden=restantes===0"), "botao nao e ocultado ao terminar"],
  [script.includes("quantidadeVisivel=PAGE_SIZE"), "filtros nao reiniciam a paginacao"],
  [script.includes("alvo>=0?Math.max(PAGE_SIZE,alvo+1)"), "links diretos para empresas podem ficar ocultos"],
  [homeGuide.includes('select: "id,nome,slug,categoria_nome,descricao,imagem_url,recomendado"'), "Home do Guia nao consulta os campos corretos"],
  [!homeGuide.includes("slug,categoria,"), "Home do Guia ainda consulta o campo inexistente categoria"],
  [css.includes(".guia-load-more-wrap"), "estilo do botao do Guia ausente"]
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Guia publico validado: seis cartoes iniciais, filtros, links diretos, Home e botao Ver mais.");
