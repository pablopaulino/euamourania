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
  ["Guia", "Guia"],
  ["Turismo", "Turismo"],
  ["Notícias", "Not&iacute;cias"],
  ["Quem somos", "Quem somos"]
];

function hasLabel(source, label, htmlLabel) {
  return source.includes(`>${label}<`)
    || source.includes(`>${htmlLabel}<`)
    || source.includes(`>${label}</a>`)
    || source.includes(`>${htmlLabel}</a>`);
}

for (const file of await collectHtml()) {
  const html = await readFile(file, "utf8");
  if (!html.includes('class="main-nav"')) continue;
  const rel = relative(root, file).replaceAll("\\", "/");
  const nav = html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  for (const [label, htmlLabel] of requiredLabels) {
    must(hasLabel(nav, label, htmlLabel), `${rel}: item "${label}" ausente do menu principal.`);
  }
  must(!hasLabel(nav, "Guia da cidade", "Guia da cidade"), `${rel}: menu ainda usa "Guia da cidade" em vez de "Guia".`);
  must(!hasLabel(nav, "Eventos", "Eventos"), `${rel}: item "Eventos" deve ficar fora do menu principal.`);
  must((nav.match(/aria-current="page"/g) || []).length <= 1, `${rel}: menu possui mais de um item ativo.`);
  must(!nav.includes("index.html#sobre"), `${rel}: menu ainda aponta Quem somos para âncora antiga.`);
}

const newsApi = await readFile(join(root, "api", "noticia.js"), "utf8");
for (const [label, htmlLabel] of requiredLabels) {
  must(hasLabel(newsApi, label, htmlLabel), `api/noticia.js: item "${label}" ausente do menu server-side.`);
}
must(!hasLabel(newsApi, "Guia da cidade", "Guia da cidade"), 'api/noticia.js: menu ainda usa "Guia da cidade" em vez de "Guia".');
must(!hasLabel(newsApi, "Eventos", "Eventos"), 'api/noticia.js: item "Eventos" deve ficar fora do menu server-side.');

const [scriptSource, configSource] = await Promise.all([
  readFile(join(root, "script.js"), "utf8"),
  readFile(join(root, "assets", "js", "pages", "site-config-page.js"), "utf8")
]);
must(scriptSource.includes("window.normalizePublicNavigation=normalizePublicNavigation"), "Menu normalizado não foi exposto para os módulos públicos.");
must(configSource.includes("window.normalizePublicNavigation?.()"), "Configurações globais podem sobrescrever o menu fixo aprovado.");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Navegação pública validada: menu principal consistente, com Guia, Turismo e sem Eventos no menu.");
