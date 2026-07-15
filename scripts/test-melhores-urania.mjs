import { readFileSync, existsSync } from "node:fs";

const must = (condition, message) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260712_melhores_urania_fase1.sql");
const retentionFix = read("supabase/migrations/20260712_melhores_urania_retencao_encerramento.sql");
const adminHtml = read("admin/melhores.html");
const adminJs = read("admin/melhores.js");
const adminCss = read("admin/melhores.css");
const service = read("assets/js/services/melhoresService.js");
const index = read("admin/index.html");
const auth = read("admin/auth.js");
const access = read("admin/access-control.js");
const docs = read("DOCS/MELHORES-DE-URANIA.md");
const guide = read("DOCS/GUIA-OPERACIONAL-MELHORES-DE-URANIA.md");

for (const table of [
  "melhores_edicoes",
  "melhores_categorias",
  "melhores_indicados",
  "melhores_indicacoes",
  "melhores_votos",
  "melhores_consolidados",
  "melhores_resultados",
  "melhores_auditoria"
]) {
  must(migration.includes(`public.${table}`), `Tabela ausente na migração: ${table}`);
  must(migration.includes(`alter table public.${table} enable row level security`), `RLS ausente: ${table}`);
}

for (const required of [
  "constraint melhores_edicoes_ano_unico unique(ano)",
  "constraint melhores_edicoes_pesos_validos_check",
  "peso_site + peso_instagram",
  "constraint melhores_categorias_slug_por_edicao unique(edicao_id, slug)",
  "melhores_indicados_nome_categoria_uidx",
  "foreign key(categoria_id, edicao_id)",
  "foreign key(indicado_id, categoria_id, edicao_id)",
  "melhores_votos_um_valido_por_categoria_uidx",
  "melhores_limpar_votos_expirados",
  "melhores_consolidar_edicao",
  "votos_individuais_remover_apos interval not null default interval '7 days'",
  "valores_anteriores jsonb",
  "valores_posteriores jsonb",
  "snapshot historico publicado",
  "pg_cron"
]) {
  must(migration.includes(required), `Migração sem requisito: ${required}`);
}

must(!migration.includes("grant execute on function public.melhores_limpar_votos_expirados() to authenticated"), "Limpeza de votos não deve ficar exposta ao frontend autenticado");
must(migration.includes("coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em)"), "Retenção precisa priorizar encerramento/votação");
must(retentionFix.includes("coalesce(encerramento_em, votacao_fim, resultado_publicado_em, divulgacao_em)"), "Migração de ajuste da retenção ausente ou incorreta");
must(retentionFix.includes("revoke all on function public.melhores_limpar_votos_expirados() from public"), "Função de limpeza deve continuar sem execute público");
must(adminHtml.includes("Melhores de Urânia") && adminHtml.includes("melhores.js"), "Página administrativa não foi criada corretamente");
must(adminCss.includes(".awards-hero") && adminCss.includes(".awards-table"), "CSS do módulo incompleto");
for (const action of ["salvarEdicao", "salvarCategoria", "salvarIndicado", "listarGuiaComercial"]) {
  must(service.includes(`export async function ${action}`), `Serviço sem função: ${action}`);
  must(adminJs.includes(action), `Admin JS não usa serviço: ${action}`);
}
must(service.includes("export async function copiarCategoriasEntreEdicoes"), "Serviço não permite copiar categorias entre edições");
must(service.includes("export async function listarEdicoesParaCopiaCategorias") && adminJs.includes("listarEdicoesParaCopiaCategorias"), "Cópia não permite selecionar uma edição anterior arquivada");
must(service.includes('item => ({ ...item, edicao_id: destinoEdicaoId })'), "Cópia de categorias não vincula os registros à edição de destino");
must(service.includes('slugsExistentes.has(item.slug)'), "Cópia de categorias não protege categorias já existentes no destino");
must(adminJs.includes('data-copy-categories') && adminJs.includes('submitLabel: "Copiar categorias"'), "Painel não oferece a ação de copiar categorias");
must(adminJs.includes("Indicados, indicações e votos não serão copiados"), "Painel não explica o escopo seguro da cópia de categorias");
for (const tab of ["dashboard", "editions", "categories", "nominees"]) {
  must(adminHtml.includes(`data-tab="${tab}"`) || adminHtml.includes(`${tab}-view`), `Aba ausente: ${tab}`);
}
must(index.includes("melhores.html"), "Menu principal não aponta para Melhores de Urânia");
must(auth.includes('"melhores.html":"melhores"') && auth.includes("melhores:*"), "Permissões locais do módulo não foram registradas");
must(access.includes('target.includes("melhores.html")'), "Controle visual de acesso não reconhece melhores.html");
must(docs.includes("Retenção dos votos individuais") && docs.includes("RLS e permissões"), "Documentação técnica incompleta");
must(guide.includes("Criar uma edição") && guide.includes("Criar indicados"), "Guia operacional incompleto");
must(existsSync(new URL("../admin/melhores.html", import.meta.url)), "Arquivo admin/melhores.html não existe");

console.log("Melhores de Urânia validado: migração, RLS, retenção, painel, permissões e documentação.");
