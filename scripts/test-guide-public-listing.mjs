import fs from "node:fs";

const page = fs.readFileSync("guia.html", "utf8");
const script = fs.readFileSync("assets/js/pages/guia-page.js", "utf8");
const homeGuide = fs.readFileSync("assets/js/pages/home-guide-page.js", "utf8");
const css = fs.readFileSync("inner-pages.css", "utf8");

const checks = [
  [page.includes('id="guia-ver-mais"'), "botao Ver mais ausente da pagina"],
  [/const\s+PAGE_SIZE\s*=\s*6/.test(script), "limite inicial do Guia nao configurado"],
  [/dados\.slice\(0,\s*quantidadeVisivel\)/.test(script), "listagem nao esta paginando os cartoes"],
  [/quantidadeVisivel\s*\+=\s*PAGE_SIZE/.test(script), "botao nao amplia a listagem"],
  [/loadMore\.hidden\s*=\s*restantes\s*===\s*0/.test(script), "botao nao e ocultado ao terminar"],
  [/quantidadeVisivel\s*=\s*PAGE_SIZE/.test(script), "filtros nao reiniciam a paginacao"],
  [/alvo\s*>=\s*0\s*\?\s*Math\.max\(PAGE_SIZE,\s*alvo\s*\+\s*1\)/.test(script), "links diretos para empresas podem ficar ocultos"],
  [homeGuide.includes('select: "id,nome,slug,categoria_nome,descricao,imagem_url,recomendado"'), "Home do Guia nao consulta os campos corretos"],
  [!homeGuide.includes("slug,categoria,"), "Home do Guia ainda consulta o campo inexistente categoria"],
  [homeGuide.includes('order: "recomendado.desc,nome.asc"'), "Home do Guia nao prioriza empresas recomendadas"],
  [homeGuide.includes("home-guide-badge") && homeGuide.includes("Destaque"), "Home do Guia nao sinaliza empresas em destaque"],
  [css.includes(".guia-load-more-wrap"), "estilo do botao do Guia ausente"]
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Guia publico validado: seis cartoes iniciais, filtros, links diretos, Home e botao Ver mais.");
