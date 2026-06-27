import { listarTabela, salvarRegistro, excluirRegistro } from "./baseService.js";
export const listarLinks = () => listarTabela("links", { ordem: "ordem", crescente: true, filtros: { status: "ativo" } });
export const listarLinksAdmin = () => listarTabela("links", { ordem: "ordem", crescente: true });
export const salvarLink = dados => salvarRegistro("links", dados);
export const excluirLink = id => excluirRegistro("links", id);
