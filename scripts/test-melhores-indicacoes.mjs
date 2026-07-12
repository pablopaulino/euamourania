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

const api = read("api/melhores-indicar.js");
const publicService = read("assets/js/services/melhoresPublicService.js");
const editionPage = read("melhores-de-urania/edicao.html");
const editionJs = read("assets/js/pages/melhores-edicao-page.js");
const analytics = read("assets/js/services/melhoresAnalyticsService.js");
const adminHtml = read("admin/melhores.html");
const adminJs = read("admin/melhores.js");
const adminService = read("assets/js/services/melhoresService.js");
const docs = read("DOCS/MELHORES-DE-URANIA.md");
const guide = read("DOCS/GUIA-OPERACIONAL-MELHORES-DE-URANIA.md");
const pkg = JSON.parse(read("package.json"));

must(api.includes("module.exports") && api.includes("SUPABASE_SERVICE_ROLE_KEY"), "API de indicação deve rodar no backend com Service Role");
must(api.includes("indicacoes_abertas") && api.includes("indicacoes_inicio") && api.includes("indicacoes_fim"), "API deve validar período/status de indicações");
must(api.includes("melhores_indicacoes") && api.includes("status: \"pendente\""), "API deve gravar indicação pendente");
must(api.includes("permite_indicacao_publica") && api.includes("aceite_regulamento"), "API deve validar categoria e aceite do regulamento");
must(publicService.includes("enviarIndicacaoMelhores") && publicService.includes("/api/melhores-indicar"), "Serviço público deve usar API segura de indicação");
must(publicService.includes("permite_indicacao_publica"), "Categorias públicas devem carregar permissão de indicação");
must(editionPage.includes("indication-area") && editionPage.includes("melhores-indicacoes.css"), "Página da edição deve ter área pública de indicação");
must(editionJs.includes("isIndicationOpen") && editionJs.includes("renderIndications"), "JS público deve renderizar indicação conforme período");
must(editionJs.includes("melhores_indication_start") && editionJs.includes("melhores_indication_complete"), "Indicações devem registrar audiência básica");
must(analytics.includes("melhores_indication_error"), "Analytics deve reconhecer erros de indicação");
must(adminHtml.includes('data-tab="indications"') && adminHtml.includes("indications-view"), "Painel deve ter aba de indicações");
must(adminJs.includes("loadIndications") && adminJs.includes("convertIndication") && adminJs.includes("updateIndicationStatus"), "Painel deve listar, converter e moderar indicações");
must(adminService.includes("listarIndicacoes") && adminService.includes("moderarIndicacao") && adminService.includes("excluirIndicacao"), "Serviço admin deve gerenciar indicações");
must(docs.includes("Fase 5") && docs.includes("/api/melhores-indicar"), "Documentação principal deve explicar Fase 5");
must(guide.includes("Receber e moderar indicações públicas") && guide.includes("Converter"), "Guia operacional deve explicar moderação");
must(pkg.scripts["test:melhores-indicacoes"], "package.json deve expor test:melhores-indicacoes");
must(pkg.scripts.test.includes("test-melhores-indicacoes.mjs"), "npm test deve incluir teste da Fase 5");

console.log("Melhores de Urânia Fase 5 validado: indicações públicas e moderação.");
