import { readdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, relative, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const skip = new Set([".git", "node_modules", "notificacoes-worktree"]);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(relative(root, path).replaceAll("\\", "/"));
  }
}

await walk(root);
const set = new Set(files);
const errors = [];

for (const file of files.filter(path => /\.(js|mjs)$/.test(path))) {
  const source = await readFile(join(root, file), "utf8");
  const temp = join(
    tmpdir(),
    `euamourania-${Math.random().toString(36).slice(2)}.${file.startsWith("api/") ? "cjs" : "mjs"}`
  );
  await writeFile(temp, source);
  const result = spawnSync(process.execPath, ["--check", temp], { encoding: "utf8" });
  await rm(temp, { force: true });
  if (result.status !== 0) errors.push(`${file}: JavaScript inválido — ${result.stderr.split("\n")[0]}`);
  if (/xkeysib-[A-Za-z0-9_-]{20,}|service_role\s*[=:]\s*["'][^"']+/i.test(source)) {
    errors.push(`${file}: possível segredo no repositório`);
  }
}

for (const file of files.filter(path => path.endsWith(".html"))) {
  const source = await readFile(join(root, file), "utf8");
  if (!/<html[^>]+lang=/i.test(source)) errors.push(`${file}: atributo lang ausente`);
  if (!/<meta[^>]+name=["']viewport/i.test(source)) errors.push(`${file}: viewport ausente`);
  const base = dirname(file) === "." ? "" : dirname(file);
  for (const match of source.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gi)) {
    const reference = match[1];
    if (/^(https?:|mailto:|tel:|data:|\/)/.test(reference)) continue;
    const target = relative(root, resolve(root, base, decodeURIComponent(reference))).replaceAll("\\", "/");
    if (!set.has(target) && !set.has(`${target}/index.html`)) {
      errors.push(`${file}: referência ausente ${reference}`);
    }
  }
}

const required = [
  "vercel.json",
  "api/sitemaps.js",
  "supabase/schema.sql",
  "admin/index.html",
  "robots.txt",
  "DOCS/README.md"
];
for (const file of required) {
  if (!set.has(file)) errors.push(`Arquivo obrigatório ausente: ${file}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Validação concluída: ${files.length} arquivos, JavaScript e referências internas consistentes.`);
