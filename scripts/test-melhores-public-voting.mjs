import { readFileSync } from "node:fs";

const must = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const publicService = read("assets/js/services/melhoresPublicService.js");
const publicData = read("assets/js/services/publicDataService.js");
const index = read("melhores-de-urania/index.html");
const edition = read("melhores-de-urania/edicao.html");
const indexPage = read("assets/js/pages/melhores-index-page.js");
const editionPage = read("assets/js/pages/melhores-edicao-page.js");
const api = read("api/melhores-votar.js");
const css = read("assets/css/melhores-public.css");
const vercel = read("vercel.json");
const sitemap = read("api/sitemaps.js");
const script = read("script.js");
const docs = read("DOCS/MELHORES-DE-URANIA.md");

for (const table of ["melhores_edicoes", "melhores_categorias", "melhores_indicados", "melhores_resultados", "melhores_consolidados"]) {
  must(publicData.includes(`"${table}"`), `Tabela pública não liberada: ${table}`);
}
must(!publicData.includes('"melhores_votos"'), "Votos individuais não podem ser liberados para leitura pública direta");
must(publicService.includes('/api/melhores-votar'), "Serviço público não usa API segura de votação");
must(!editionPage.includes(".from(\"melhores_votos\")") && !editionPage.includes("melhores_votos"), "Frontend não deve gravar votos direto no Supabase");
must(api.includes("SUPABASE_SERVICE_ROLE_KEY"), "API precisa usar Service Role apenas no backend");
must(api.includes("MELHORES_VOTO_SECRET"), "API precisa suportar segredo dedicado para hash");
must(api.includes("votingOpen") && api.includes("status === \"votacao_aberta\""), "API não valida período/status da votação");
must(api.includes("identificador_hash") && api.includes("duplicate key"), "API não trata duplicidade de voto");
must(api.includes("ip_hash") && !api.includes("ip:"), "API deve armazenar apenas hash de IP");
must(index.includes("Melhores de Urânia") && index.includes("melhores-index-page.js"), "Página principal pública incompleta");
must(edition.includes("melhores-edicao-page.js") && edition.includes("Categorias e indicados"), "Página de edição incompleta");
must(indexPage.includes("listarEdicoesPublicas"), "Página principal não carrega edições públicas");
must(editionPage.includes("enviarVotoMelhores") && editionPage.includes("localStorage"), "Página de edição não registra voto com feedback local");
must(css.includes(".awards-public-hero") && css.includes(".awards-nominee-card"), "CSS público incompleto");
must(vercel.includes("/melhores-de-urania/:ano"), "Rewrite amigável da edição ausente");
must(sitemap.includes("melhoresRows") && sitemap.includes("/melhores-de-urania/"), "Sitemap não inclui Melhores de Urânia");
must(script.includes("Melhores de Ur&acirc;nia") && script.includes("/melhores-de-urania/"), "Menu público não inclui Melhores de Urânia");
must(docs.includes("Fase 2") && docs.includes("MELHORES_VOTO_SECRET"), "Documentação da Fase 2 incompleta");

console.log("Melhores de Urânia Fase 2 validado: páginas públicas, API segura, rotas, sitemap e documentação.");
