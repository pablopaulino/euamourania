import { listarTabela, salvarRegistro, excluirRegistro } from "./baseService.js";
export const listarCategorias = tipo => listarTabela("categorias", { ordem: "ordem", crescente: true, filtros: { status: "ativo", tipo } });
export const listarCategoriasAdmin = () => listarTabela("categorias", { ordem: "ordem", crescente: true });
export const salvarCategoria = dados => salvarRegistro("categorias", dados);
export const excluirCategoria = id => excluirRegistro("categorias", id);
