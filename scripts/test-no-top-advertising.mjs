import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../assets/js/pages/banners-page.js", import.meta.url), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const disabled = ["home_topo", "noticias_topo", "guia_topo", "turismo_topo", "eventos_topo"];

must(source.includes("disabledTopPositions"), "Lista de posições de topo desativadas ausente.");
for (const position of disabled) {
  must(source.includes(`"${position}"`), `Posição de topo ${position} não está bloqueada explicitamente.`);
  must(!source.includes(`insertZone("${position}"`), `Banner próprio de topo ainda é inserido em ${position}.`);
  must(!source.includes(`insertAdSenseZone("${position}"`), `AdSense de topo ainda é inserido em ${position}.`);
}

must(source.includes('insertZone("home_hero_conteudo"'), "Publicidade entre hero e conteúdo foi removida por engano.");
must(source.includes('insertBetweenCards("noticias_entre_listagem"') || source.includes('insertRepeatedBetweenCards("noticias_entre_listagem"'), "Publicidade entre listagens de notícias foi removida por engano.");
must(source.includes('insertZone("guia_rodape"'), "Publicidade de rodapé do guia foi removida por engano.");

console.log("Publicidade validada: banners de topo desativados e demais posições preservadas.");
