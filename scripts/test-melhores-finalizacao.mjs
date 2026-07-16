import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const must = (condition, message) => {
  if (!condition) {
    console.error(`Falhou: ${message}`);
    process.exit(1);
  }
};

const voteApi = read("api/melhores-votar.js");
const indicationApi = read("api/melhores-indicar.js");
const editionJs = read("assets/js/pages/melhores-edicao-page.js");
const analyticsJs = read("assets/js/services/melhoresAnalyticsService.js");
const vercel = read("vercel.json");
const docs = read("DOCS/MELHORES-DE-URANIA-FINALIZACAO.md");

must(voteApi.includes("TURNSTILE_SECRET_KEY") && voteApi.includes("verifyTurnstile"), "API de voto deve suportar Turnstile/Captcha.");
must(voteApi.includes("missing-turnstile-secret") && voteApi.includes("Verificação de segurança ausente"), "API de voto deve exigir Turnstile obrigatório.");
must(indicationApi.includes("TURNSTILE_SECRET_KEY") && indicationApi.includes("verifyTurnstile"), "API de indicação deve suportar Turnstile/Captcha.");
must(indicationApi.includes("honeypot"), "Indicação pública deve ter honeypot anti-spam.");
must(voteApi.includes("melhores_limpar_votos_expirados"), "API deve executar limpeza de votos expirados.");
must(vercel.includes('"crons"') && vercel.includes("/api/melhores-votar?cron=limpeza"), "Vercel deve ter cron de limpeza sem nova função serverless.");
must(editionJs.includes("getTurnstileToken") && editionJs.includes("turnstile_token"), "Frontend deve enviar token Turnstile.");
must(editionJs.includes("showPostVotePanel") && editionJs.includes("data-awards-share"), "Pós-voto deve incentivar compartilhamento.");
for (const eventType of ["melhores_vote_abandon", "melhores_category_view", "melhores_nominee_impression", "melhores_share_click"]) {
  must(analyticsJs.includes(eventType), `Analytics avançado ausente: ${eventType}`);
}
must(docs.includes("TURNSTILE_SECRET_KEY") && docs.includes("/api/melhores-votar?cron=limpeza"), "Documentação final deve explicar Turnstile e cron.");

console.log("Finalização do Melhores de Urânia validada: Turnstile obrigatório para votação, cron, anti-spam, pós-voto e analytics avançado.");
