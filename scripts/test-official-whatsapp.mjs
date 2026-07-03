import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = ["index.html", "buscar.html", "news/index.html", "admin/migrar.js"];
const contents = await Promise.all(files.map(path => readFile(new URL(path, root), "utf8")));
const migration = await readFile(new URL("supabase/migrations/20260703_atualiza_whatsapp_oficial.sql", root), "utf8");
const current = "5517976005583";
const previous = "5517981344558";

for (const [index, content] of contents.entries()) {
  if (!content.includes(current)) throw new Error(`Novo WhatsApp ausente em ${files[index]}`);
  if (content.includes(previous)) throw new Error(`WhatsApp antigo permanece em ${files[index]}`);
}
if (!migration.includes(`'whatsapp', '${current}'`) || !migration.includes(`replace(url, '${previous}', '${current}')`)) {
  throw new Error("Migração não atualiza configuração e link oficial.");
}

console.log("WhatsApp oficial validado no site, importador e Supabase.");
