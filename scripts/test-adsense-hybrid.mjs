import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [ads, css, shell, privacy, adsTxt, docs] = await Promise.all([
  read("assets/js/pages/banners-page.js"),
  read("assets/css/publicidade-publica.css"),
  read("script.js"),
  read("politica-de-privacidade.html"),
  read("ads.txt"),
  read("supabase/PUBLICIDADE.md")
]);

must(ads.includes("ca-pub-6427480219886739"), "Cliente AdSense ausente.");
for (const slot of ["1899945573", "8841557208", "9680985838", "6769128877", "3031817003"]) {
  must(ads.includes(slot), `Bloco AdSense ausente: ${slot}`);
}
must(ads.includes("hasAdConsent") && ads.includes("cookie-consent:accepted"), "AdSense não respeita consentimento.");
must(ads.includes('cookieConsentVersion") === "2"') && shell.includes('cookieConsentVersion","2"'), "Consentimento antigo pode ativar o AdSense sem novo aviso.");
must(ads.includes("renderAllAdvertising") && ads.indexOf("render();") < ads.indexOf("renderAdSense();"), "Campanhas próprias não têm prioridade.");
must(ads.includes("maxPerPage: 3"), "Página pode receber anúncios Google em excesso.");
must(ads.includes("adsenseAttempted.has(position)") && ads.includes("adsenseAttempted.add(position)"), "Bloco não preenchido pode ser solicitado repetidamente.");
must(ads.includes('data-ad-provider="google"') && ads.includes("data-full-width-responsive"), "Bloco Google não é identificado ou responsivo.");
must(ads.includes('unit.dataset.adStatus === "unfilled"'), "Espaços Google não preenchidos permanecem visíveis.");
must(css.includes(".adsense-unit") && css.includes("[data-ad-status=unfilled]"), "Estilos do AdSense incompletos.");
must(shell.includes("exibir anúncios do Google"), "Aviso de cookies não informa publicidade.");
must(privacy.includes("Google AdSense") && privacy.includes("partner-sites"), "Política de privacidade não documenta o AdSense.");
must(adsTxt.trim() === "google.com, pub-6427480219886739, DIRECT, f08c47fec0942fa0", "ads.txt inválido.");
must(docs.includes("publicidade híbrida") && docs.includes("três blocos por página"), "Integração não documentada.");

console.log("AdSense validado: fallback híbrido, cinco blocos, consentimento, responsividade e ads.txt.");
