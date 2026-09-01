import { excluirRegistro, listarTabela, salvarRegistro } from './baseService.js';

export const listarMotoristasAdmin = () => listarTabela('motoristas', { ordem: 'ordem', crescente: true });
export const salvarMotorista = dados => salvarRegistro('motoristas', dados);
export const excluirMotorista = id => excluirRegistro('motoristas', id);
