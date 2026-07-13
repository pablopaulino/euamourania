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

const migration = read("supabase/migrations/20260713_app_melhores_urania.sql");
const rollback = read("supabase/rollbacks/20260713_app_melhores_urania_rollback.sql");
const service = read("assets/js/services/melhoresService.js");
const admin = read("admin/melhores.js");
const html = read("admin/melhores.html");
const docs = read("DOCS/MELHORES-DE-URANIA-APP.md");

for (const table of ["app_melhores_campanhas", "app_melhores_vencedores"]) {
  must(migration.includes(`create table if not exists public.${table}`), `migração deve criar ${table}`);
  must(migration.includes(`alter table public.${table} enable row level security`), `RLS deve estar ativa em ${table}`);
  must(rollback.includes(`drop table if exists public.${table}`), `rollback deve remover ${table}`);
}

for (const policy of ["app_melhores_campanhas_publicas", "app_melhores_vencedores_publicos"]) {
  must(migration.includes(policy), `policy pública ausente: ${policy}`);
}

must(migration.includes("app_melhores_importar_vencedores"), "RPC de importação deve existir.");
must(migration.includes("r.publicado=true") && migration.includes("r.vencedor=true"), "importação deve usar apenas resultados publicados e vencedores.");
must(migration.includes("e.status='resultado_publicado'"), "campanha pública deve exigir edição oficialmente publicada.");
must(migration.includes("melhores_auditoria"), "ações do app devem registrar auditoria.");
must(html.includes('data-tab="app"') && html.includes('id="app-view"'), "aba Exibição no aplicativo deve existir no HTML.");
must(service.includes("listarCampanhasApp") && service.includes("importarVencedoresApp"), "service deve expor funções do app.");
must(admin.includes("loadAppDisplay") && admin.includes("Importar vencedores da edição"), "painel deve carregar aba e botão de importação.");
must(admin.includes("app_bestof_banner_view") && docs.includes("app_bestof_banner_view"), "analytics futuros do app devem estar documentados.");

console.log("Integração Melhores de Urânia + app validada: migração, RLS, painel, importação e documentação.");
