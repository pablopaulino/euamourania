import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [api, admin, css, access, migration, docs, pkgText, apiFiles] = await Promise.all([
  read("api/newsletter-send.js"),
  read("admin/comunicacao.js"),
  read("admin/comunicacao.css"),
  read("admin/access-control.js"),
  read("supabase/migrations/20260717_newsletter_mensal.sql"),
  read("supabase/BREVO_SETUP.md"),
  read("package.json"),
  read("api/newsletter-send.js")
]);
const pkg = JSON.parse(pkgText);

must(api.includes("automatizacao_tipo: \"resumo_mensal\""), "API não marca newsletter mensal.");
must(api.includes("status: \"rascunho\""), "Resumo mensal precisa nascer como rascunho.");
must(api.includes("destinatarios_previstos"), "API não registra destinatários previstos.");
must(api.includes("noticias_mais_acessadas") && api.includes("empresas_mais_visitadas"), "API não registra destaques analisados.");
must(api.includes("existingMonthly") && api.includes("periodo_chave"), "API não impede duplicidade por período.");
must(api.includes("tem_permissao_admin") && api.includes("comunicacao"), "API sem autorização administrativa.");
must(api.includes("action === \"generate_monthly\""), "Geração mensal precisa reutilizar /api/newsletter-send.");
const monthlyBranch = api.slice(api.indexOf("action === \"generate_monthly\""), api.indexOf("return await sendNewsletter"));
must(monthlyBranch.includes("generateMonthlyDraft") && !monthlyBranch.includes("BREVO_API_KEY"), "Geração mensal não deve depender da chave Brevo.");

must(admin.includes("/api/newsletter-send") && admin.includes("generate_monthly"), "Painel não chama o gerador mensal pela API existente.");
must(admin.includes("data-generate-monthly"), "Botão de gerar resumo mensal ausente.");
must(admin.includes("Resumo mensal") && admin.includes("destinatários previstos"), "Painel não exibe histórico/dados do resumo mensal.");
must(admin.includes("newsletterForm(result.newsletter.id)"), "Após gerar, painel deve abrir o rascunho para revisão.");
must(admin.includes("automatizacao_tipo: newsletter.automatizacao_tipo || null"), "Edição deve preservar a automação do rascunho mensal.");
must(!admin.includes("BREVO_API_KEY"), "Frontend não pode expor chave Brevo.");

must(css.includes("monthly-newsletter-card") && css.includes("monthly-editor-note"), "Estilos do resumo mensal ausentes.");
must(access.includes("data-generate-monthly") && access.includes("comunicacao\",\"criar"), "Controle de acesso não cobre geração mensal.");
must(migration.includes("newsletters_resumo_mensal_periodo_unique"), "Índice único do resumo mensal ausente.");
must(migration.includes("configuracao_futura->>'periodo_chave'"), "Índice não usa periodo_chave.");
must(docs.includes("Newsletter mensal assistida") && docs.includes("Nada é enviado automaticamente"), "Documentação da newsletter mensal ausente.");
must(pkg.scripts["test:monthly-newsletter"], "package.json deve expor test:monthly-newsletter.");
must(pkg.scripts.test.includes("test-monthly-newsletter.mjs"), "Teste mensal não entrou na suíte principal.");
must(!apiFiles.includes("newsletter-monthly.js"), "Não deve existir nova serverless function para newsletter mensal.");

console.log("Newsletter mensal validada: rascunho automático, histórico, permissões, duplicidade e documentação.");
