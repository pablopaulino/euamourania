import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../preview/home/home-preview.js", import.meta.url), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

must(source.includes('fetchPublicRows("eventos"'), "Home não consulta a agenda simples.");
must(source.includes('fetchPublicRows("eventos_edicoes"'), "Home não consulta as edições de eventos.");
must(source.includes('"confirmado", "acontecendo"'), "Home não reconhece edições confirmadas ou em andamento.");
must(source.includes("end < now"), "Home não remove eventos depois do encerramento.");
must(source.includes("Number(b.isOngoing) - Number(a.isOngoing)"), "Eventos em andamento não têm prioridade.");
must(source.includes("/eventos/${encodeURIComponent(parent.slug)}/${encodeURIComponent(item.ano"), "Edição não aponta para sua página pública.");

console.log("Agenda da home validada: edições atuais, futuras e encerramento automático.");
