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

const migration = read("supabase/migrations/20260712_melhores_urania_fase4_audiencia.sql");
const index = read("index.html");
const homeJs = read("assets/js/pages/melhores-home-page.js");
const analytics = read("assets/js/services/melhoresAnalyticsService.js");
const melhoresIndex = read("assets/js/pages/melhores-index-page.js");
const melhoresEdition = read("assets/js/pages/melhores-edicao-page.js");
const melhoresResults = read("assets/js/pages/melhores-resultados-page.js");
const publicIndex = read("melhores-de-urania/index.html");
const publicEdition = read("melhores-de-urania/edicao.html");
const publicResults = read("melhores-de-urania/resultados.html");
const docs = read("DOCS/MELHORES-DE-URANIA.md");
const guide = read("DOCS/GUIA-OPERACIONAL-MELHORES-DE-URANIA.md");
const pkg = JSON.parse(read("package.json"));

[
  "melhores_index_view",
  "melhores_edition_view",
  "melhores_results_view",
  "melhores_vote_start",
  "melhores_vote_complete",
  "melhores_vote_error",
  "melhores_cta_click"
].forEach(type => {
  must(analytics.includes(type), `Serviço de analytics não reconhece ${type}`);
});

must(migration.includes("create or replace function public.registrar_evento_site"), "Migração deve atualizar registrar_evento_site");
must(migration.includes("check(tipo ~ '^[a-z][a-z0-9_]{1,60}$')"), "Migração deve aceitar eventos técnicos seguros sem quebrar histórico");
must(migration.includes("coalesce(p_tipo,'') !~ '^[a-z][a-z0-9_]{1,60}$'"), "RPC deve rejeitar tipos de evento fora do padrão seguro");
must(migration.includes("coalesce(p_metadados") && migration.includes("-'ip'-'email'-'telefone'"), "Migração deve sanitizar metadados sensíveis");
must(index.includes("assets/js/pages/melhores-home-page.js"), "Home deve carregar o bloco do Melhores de Urânia");
must(homeJs.includes("listarEdicoesPublicas") && homeJs.includes("data-awards-home"), "Script da home deve buscar edição pública e renderizar bloco");
must(homeJs.includes("melhores_cta_click"), "Home deve registrar clique em CTA do Melhores");
must(melhoresIndex.includes("melhores_index_view"), "Página principal do Melhores deve registrar visualização");
must(melhoresEdition.includes("melhores_edition_view"), "Página da edição deve registrar visualização");
must(melhoresEdition.includes("melhores_vote_start") && melhoresEdition.includes("melhores_vote_complete"), "Votação deve registrar início e conclusão");
must(melhoresResults.includes("melhores_results_view"), "Página de resultados deve registrar visualização");
must(publicIndex.includes("BreadcrumbList"), "Página principal pública deve conter breadcrumb estruturado");
must(publicEdition.includes("BreadcrumbList"), "Página de edição pública deve conter breadcrumb estruturado");
must(publicResults.includes("BreadcrumbList"), "Página de resultados pública deve conter breadcrumb estruturado");
must(docs.includes("Fase 4") && docs.includes("20260712_melhores_urania_fase4_audiencia.sql"), "Documentação principal deve explicar a Fase 4");
must(guide.includes("Audiência") && guide.includes("Retenção dos votos individuais"), "Guia operacional deve cobrir audiência e retenção");
must(pkg.scripts["test:melhores-polimento"], "package.json deve expor test:melhores-polimento");
must(pkg.scripts.test.includes("test-melhores-polimento.mjs"), "npm test deve incluir teste da Fase 4");

console.log("Fase 4 do Melhores de Urânia validada.");
