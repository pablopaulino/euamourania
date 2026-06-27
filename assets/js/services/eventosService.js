import { listarTabela, buscarPorCampo, salvarRegistro, excluirRegistro } from "./baseService.js";
export const listarEventos = () => listarTabela("eventos", { ordem: "data_inicio", crescente: true, filtros: { status: "publicado" } });
export const buscarEventoPorSlug = slug => buscarPorCampo("eventos", "slug", slug);
export const listarEventosAdmin = () => listarTabela("eventos", { ordem: "atualizado_em" });
export const salvarEvento = dados => salvarRegistro("eventos", dados);
export const excluirEvento = id => excluirRegistro("eventos", id);
