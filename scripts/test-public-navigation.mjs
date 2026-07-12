import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const errors = [];
const must = (condition, message) => {
  if (!condition) errors.push(message);
};

async function collectHtml(dir = root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "notificacoes-worktree", "admin"].includes(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(path));
    else if (entry.name.endsWith(".html")) files.push(path);
  }
  return files;
}

const requiredLabels = [
  ["Início", "In&iacute;cio"],
  ["Guia da cidade", "Guia da cidade"],
  ["Turismo", "Turismo"],
  ["Notícias", "Not&iacute;cias"],
  ["Eventos", "Eventos"],
  ["Quem somos", "Quem somos"]
];

for (const file of await collectHtml()) {
  const html = await readFile(file, "utf8");
  if (!html.includes('class="main-nav"')) continue;
  const rel = relative(root, file).replaceAll("\\", "/");
  const nav = html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  for (const [label, htmlLabel] of requiredLabels) {
    must(nav.includes(`>${label}<`) || nav.includes(`>${htmlLabel}<`) || nav.includes(`>${label}</a>`) || nav.includes(`>${htmlLabel}</a>`), `${rel}: item "${label}" ausente do menu principal.`);
  }
  must((nav.match(/aria-current="page"/g) || []).length <= 1, `${rel}: menu possui mais de um item ativo.`);
  must(!nav.includes("index.html#sobre"), `${rel}: menu ainda aponta Quem somos para âncora antiga.`);
}

const newsApi = await readFile(join(root, "api", "noticia.js"), "utf8");
for (const [label, htmlLabel] of requiredLabels) {
  must(newsApi.includes(`>${label}<`) || newsApi.includes(`>${htmlLabel}<`) || newsApi.includes(`>${label}</a>`) || newsApi.includes(`>${htmlLabel}</a>`), `api/noticia.js: item "${label}" ausente do menu server-side.`);
}

const [scriptSource, configSource] = await Promise.all([
  readFile(join(root, "script.js"), "utf8"),
  readFile(join(root, "assets", "js", "pages", "site-config-page.js"), "utf8")
]);
must(scriptSource.includes("window.normalizePublicNavigation=normalizePublicNavigation"), "Menu normalizado não foi exposto para os módulos públicos.");
must(configSource.includes("window.normalizePublicNavigation?.()"), "Configurações globais podem sobrescrever o menu fixo e remover Eventos.");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Navegação pública validada: menu principal consistente, com Turismo e Eventos fixos nas páginas.");
