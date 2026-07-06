import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [script, config, styles] = await Promise.all([
  read("script.js"),
  read("assets/js/pages/site-config-page.js"),
  read("styles.css")
]);

must(script.includes('current>2024?`2024–${current}`:"2024"'), "Intervalo de anos do rodapé não é dinâmico.");
must(script.includes("Eu Amo Urânia. Todos os direitos reservados."), "Copyright obrigatório ausente.");
must(script.includes("Feito em Urânia, para Urânia."), "Assinatura institucional ausente.");
must(script.includes('document.querySelectorAll(".footer-bottom p")'), "Rodapé não é atualizado em todas as páginas.");
must(config.includes("window.updateFooterYear?.()"), "Configurações globais podem sobrescrever o copyright.");
must(styles.includes(".footer-signature{display:block"), "Assinatura do rodapé não preserva o layout.");

console.log("Rodapé validado: intervalo iniciado em 2024, ano atual automático e assinatura institucional.");
