import { listarTabela, salvarRegistro } from "./baseService.js";
export const listarConfiguracoes = () => listarTabela("configuracoes_site", { ordem: "chave", crescente: true });
export const salvarConfiguracao = dados => salvarRegistro("configuracoes_site", dados);
