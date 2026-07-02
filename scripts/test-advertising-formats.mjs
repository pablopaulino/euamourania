import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [publicJs, publicCss, adminJs, adminCss, styles, docs] = await Promise.all([
  read("assets/js/pages/banners-page.js"),
  read("assets/css/publicidade-publica.css"),
  read("admin/publicidade.js"),
  read("admin/publicidade-v2.css"),
  read("styles.css"),
  read("supabase/PUBLICIDADE.md")
]);

for (const format of ["automatico", "super_banner", "horizontal", "retangulo", "quadrado", "vertical", "nativo"]) {
  must(adminJs.includes(`${format}:`) || adminJs.includes(`"${format}"`), `Formato ausente no painel: ${format}`);
  must(publicCss.includes(`ad-format-${format}`), `Formato sem estilo público: ${format}`);
}
must(adminJs.includes("imagem_mobile_url") && publicJs.includes("imagem_mobile_url"), "Campanha não aceita imagem específica para celular.");
must(adminJs.includes("campaign-preview") && adminCss.includes(".campaign-preview"), "Painel não possui prévia do criativo.");
must(adminJs.includes("positionRecommendations") && adminJs.includes("placement-inventory"), "Painel não orienta nem resume as posições.");
must(adminJs.includes("configuracao_futura") && adminJs.includes("rotacao_segundos"), "Configuração de formato não usa o JSON escalável existente.");
must(publicJs.includes("insertBetweenCards") && publicJs.includes('".news-item", 3') && publicJs.includes('".card-guia", 5'), "Anúncios não entram realmente entre os cartões.");
must(publicJs.includes("insertInsideArticle") && publicJs.includes("Math.floor(blocks.length / 2)"), "Anúncio não entra no meio do conteúdo da notícia.");
must(publicJs.includes("IntersectionObserver") && publicJs.includes("intersectionRatio >= .45"), "Impressões são registradas sem visibilidade real.");
must(publicJs.includes("ad-rotator") && publicJs.includes("rotacao_segundos"), "Campanhas na mesma posição não possuem rotação.");
must(publicJs.includes('if (!html) return false'), "Posição vazia pode reservar espaço no site.");
must(publicCss.includes("@media(max-width:650px)") && publicCss.includes("320/100"), "Banners não possuem formato móvel responsivo.");
must(styles.includes('publicidade-publica.css'), "Estilos de publicidade não carregam junto do site.");
must(docs.includes("configuracao_futura"), "Documentação não descreve a configuração evolutiva.");

console.log("Publicidade validada: formatos, mobile, posições reais, rotação, métricas visíveis e painel.");
