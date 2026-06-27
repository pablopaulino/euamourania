import { listarTabela, salvarRegistro, excluirRegistro } from "./baseService.js";
export const listarBanners = () => listarTabela("banners", { ordem: "ordem", crescente: true, filtros: { status: "ativo" } });
export const listarBannersAdmin = () => listarTabela("banners", { ordem: "ordem", crescente: true });
export const salvarBanner = dados => salvarRegistro("banners", dados);
export const excluirBanner = id => excluirRegistro("banners", id);
