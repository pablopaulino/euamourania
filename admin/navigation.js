import { getAdminModule } from "./admin-modules.js";

// Each section opens the first tab available to the signed-in administrator.
export const sections = [
  ["Visão geral", ["dashboard"]],
  ["Audiência & Métricas", ["audiencia"]],
  ["Notícias", ["noticias", "noticia_editor", "aprovacoes", "automacao_editorial"]],
  ["Agenda & Eventos", ["eventos", "eventos_principais", "eventos_edicoes"]],
  ["Categorias", ["categorias"]],
  ["Guia Comercial", ["guia_comercial", "catalogos", "guia_verificacao", "parceiros_log"]],
  ["Turismo", ["turismo", "turismo_verificacao"]],
  ["Serviços Urbanos", ["telefones_uteis", "motoristas", "achados_perdidos", "vantagens", "sugestoes_momento", "iniciativas", "natal_premiado"]],
  ["Vitrine de Links", ["links"]],
  ["Publicidade", ["publicidade", "banners"]],
  ["Assinaturas Viva", ["viva_assinaturas"]],
  ["Melhores de Urânia", ["melhores"]],
  ["Central de Comunicação", ["comunicacao", "newsletters", "assinantes", "notificacoes", "submissoes", "colaboradores_voluntarios"]],
  ["Mídia", ["midia"]],
  ["Configurações Globais", ["configuracoes_site"]],
  ["Usuários & Permissões", ["usuarios"]],
  ["Migração / Importação JSON", ["importacao"]]
];

const labels = {
  noticias: "Todas as matérias", aprovacoes: "Fila de aprovação", eventos: "Agenda simples",
  eventos_principais: "Eventos tradicionais", eventos_edicoes: "Edições históricas",
  guia_comercial: "Empresas", catalogos: "Catálogos/Cardápios", guia_verificacao: "Verificação",
  turismo: "Atrativos", turismo_verificacao: "Revisão periódica", publicidade: "Painel de campanhas",
  comunicacao: "Visão geral", notificacoes: "Push do app", colaboradores_voluntarios: "Voluntários"
};

export function allowedSections(canOpen) {
  return sections.map(([label, views]) => ({
    label, group: getAdminModule(views[0]).group,
    tabs: views.filter(view => canOpen(view)).map(view => ({ view, label: labels[view] || getAdminModule(view).label }))
  })).filter(section => section.tabs.length);
}
