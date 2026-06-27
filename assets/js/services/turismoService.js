import { listarTabela, buscarPorCampo, salvarRegistro, excluirRegistro } from "./baseService.js";
export const listarTurismo = () => listarTabela("turismo", { ordem: "destaque", filtros: { status: "publicado" } });
export const buscarTurismoPorSlug = slug => buscarPorCampo("turismo", "slug", slug);
export const listarTurismoAdmin = () => listarTabela("turismo", { ordem: "atualizado_em" });
export const salvarTurismo = dados => salvarRegistro("turismo", dados);
export const excluirTurismo = id => excluirRegistro("turismo", id);
