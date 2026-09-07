const icon = paths => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${paths}</svg>`;

export const ADMIN_MODULE_ICONS = {
  dashboard: icon(`<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10.5V19h11v-8.5"/><path d="M10 19v-4h4v4"/>`),
  audience: icon(`<path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-4"/><path d="M12 16V8"/><path d="M16 16v-7"/><path d="M7 9l4-3 4 2 4-5"/>`),
  news: icon(`<path d="M5 5.5h10.5a2.5 2.5 0 0 1 2.5 2.5v10.5H7.5A2.5 2.5 0 0 1 5 16V5.5Z"/><path d="M18 8h1.8v8.4a2.1 2.1 0 0 1-1.8 2.1"/><path d="M8.5 9h5.5"/><path d="M8.5 12h5.5"/><path d="M8.5 15h3.5"/>`),
  approval: icon(`<path d="m5 12 4 4 10-10"/><path d="M4 6h8"/><path d="M4 18h12"/>`),
  calendar: icon(`<path d="M7 3.5v3"/><path d="M17 3.5v3"/><rect x="4.5" y="5.5" width="15" height="15" rx="3"/><path d="M4.5 10h15"/><path d="M8.5 14h.01"/><path d="M12 14h.01"/><path d="M15.5 14h.01"/>`),
  event: icon(`<path d="M7 3.5v3"/><path d="M17 3.5v3"/><rect x="4.5" y="5.5" width="15" height="15" rx="3"/><path d="M4.5 10h15"/><path d="m12 13 1 2 2.2.3-1.6 1.55.38 2.15L12 18l-1.98 1 .38-2.15-1.6-1.55 2.2-.3 1-2Z"/>`),
  editions: icon(`<path d="M7.5 7h12v12h-12z"/><path d="M4.5 4h12v12"/><path d="M10.5 11h5.5"/><path d="M10.5 14.5h4"/>`),
  category: icon(`<path d="M20 10.5 13.5 4H7L4 7v6.5l6.5 6.5a2 2 0 0 0 2.8 0l6.7-6.7a2 2 0 0 0 0-2.8Z"/><circle cx="8.7" cy="8.7" r="1"/>`),
  guide: icon(`<path d="M4.5 10h15"/><path d="m6 10 1-5h10l1 5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-4h4v4"/>`),
  checkStore: icon(`<path d="M4.5 10h15"/><path d="m6 10 1-5h10l1 5"/><path d="M7 10v9h10v-9"/><path d="m9 15 2 2 4-5"/>`),
  tourism: icon(`<path d="M12 21s6.5-5 6.5-10.7a6.5 6.5 0 0 0-13 0C5.5 16 12 21 12 21Z"/><circle cx="12" cy="10.2" r="2.2"/>`),
  phone: icon(`<path d="M8.5 4.5h7A1.5 1.5 0 0 1 17 6v12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 18V6a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M11 17h2"/>`),
  car: icon(`<path d="M6 16h12"/><path d="M7 16l1.2-5.2A2.4 2.4 0 0 1 10.5 9h3a2.4 2.4 0 0 1 2.3 1.8L17 16"/><circle cx="8" cy="17" r="1.5"/><circle cx="16" cy="17" r="1.5"/><path d="M8.7 12h6.6"/>`),
  initiative: icon(`<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z"/><path d="M12 8v6"/><path d="M9 11h6"/>`),
  ticket: icon(`<path d="M4.5 8.5a2 2 0 0 0 0 3v1a2 2 0 0 0 0 3v2h15v-2a2 2 0 0 0 0-3v-1a2 2 0 0 0 0-3v-2h-15v2Z"/><path d="M9 7v10"/><path d="M13 10h3"/><path d="M13 14h3"/>`),
  link: icon(`<path d="M10 13a4.5 4.5 0 0 0 6.4 0l1.6-1.6a4.5 4.5 0 0 0-6.4-6.4l-.7.7"/><path d="M14 11a4.5 4.5 0 0 0-6.4 0L6 12.6A4.5 4.5 0 0 0 12.4 19l.7-.7"/>`),
  ads: icon(`<path d="m4.5 14 4-2 8.5-5v10l-8.5-5-4-2v4Z"/><path d="M8.5 14v4.5"/><path d="M18 9.5c1 .75 1.5 1.55 1.5 2.5S19 13.75 18 14.5"/>`),
  award: icon(`<path d="M8 4.5h8v4.8a4 4 0 0 1-8 0V4.5Z"/><path d="M12 17v3.5"/><path d="M8.5 20.5h7"/><path d="M6.2 6H4.5v1.8A3.6 3.6 0 0 0 8 11.4"/><path d="M17.8 6h1.7v1.8a3.6 3.6 0 0 1-3.5 3.6"/>`),
  mail: icon(`<rect x="4" y="5.5" width="16" height="13" rx="3"/><path d="m5 8 7 5.2L19 8"/>`),
  bell: icon(`<path d="M17.5 8.5a5.5 5.5 0 1 0-11 0c0 6-2.5 6.5-2.5 8h16c0-1.5-2.5-2-2.5-8"/><path d="M10 20h4"/>`),
  people: icon(`<path d="M15.5 20v-1.5a3.5 3.5 0 0 0-3.5-3.5H7.5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="9.8" cy="8" r="3.5"/><path d="M18.5 11.5a3 3 0 0 0-2-5.5"/><path d="M20 20v-1a3.5 3.5 0 0 0-2.5-3.35"/>`),
  submission: icon(`<path d="M4.5 5h15v11h-10L6 19.5V16h-1.5V5Z"/><path d="M8 9h8"/><path d="M8 12.5h5"/>`),
  media: icon(`<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.4"/><path d="m7 17 3.2-3.2a1.4 1.4 0 0 1 2 0L14 15.5l1-1a1.4 1.4 0 0 1 2 0L20 17"/>`),
  settings: icon(`<circle cx="12" cy="12" r="3"/><path d="M19 12a7.8 7.8 0 0 0-.08-1.05l2-1.55-2-3.45-2.35.95a7.4 7.4 0 0 0-1.8-1.05L14.4 3h-4.8l-.38 2.85A7.4 7.4 0 0 0 7.42 6.9l-2.35-.95-2 3.45 2 1.55A7.8 7.8 0 0 0 5 12c0 .36.03.7.08 1.05l-2 1.55 2 3.45 2.35-.95c.55.44 1.15.8 1.8 1.05L9.6 21h4.8l.38-2.85c.65-.25 1.25-.61 1.8-1.05l2.35.95 2-3.45-2-1.55c.05-.34.08-.69.08-1.05Z"/>`),
  import: icon(`<path d="M14 4v5h5"/><path d="M19 9v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 6Z"/><path d="M12 12v5"/><path d="m9.5 14.5 2.5 2.5 2.5-2.5"/>`)
};

export const ADMIN_MODULES = {
  dashboard: { label: "Visão geral", description: "Central de operação do portal, aplicativo e módulos administrativos.", route: "/admin", group: "Operação", icon: "dashboard", keywords: ["home", "dashboard", "central"], dashboard: { domain: "Operação", indicator: "Saúde geral" } },
  audiencia: { label: "Audiência", description: "Leitura de acessos, cliques e desempenho real do portal e app.", route: "/admin/audiencia", group: "Operação", icon: "audience", keywords: ["analytics", "dados", "visualizações"], dashboard: { domain: "Operação", indicator: "Interações" } },
  noticias: { label: "Notícias", description: "Matérias, rascunhos, SEO e publicação editorial.", route: "/admin/noticias", group: "Conteúdo", icon: "news", keywords: ["editorial", "matérias", "conteúdo"], primaryAction: "Nova notícia", permission: "noticias", dashboard: { domain: "Conteúdo", indicator: "Publicadas" } },
  aprovacoes: { label: "Aprovações", description: "Fila editorial de revisão e publicação.", route: "/admin/aprovacoes", group: "Conteúdo", icon: "approval", keywords: ["fila", "revisão"], permission: "noticias", dashboard: { domain: "Conteúdo", indicator: "Pendências" } },
  eventos: { label: "Agenda simples", description: "Eventos pontuais exibidos no site e aplicativo.", route: "/admin/agenda", group: "Conteúdo", icon: "calendar", keywords: ["agenda", "evento"], primaryAction: "Novo evento", permission: "eventos", dashboard: { domain: "Conteúdo", indicator: "Próximos" } },
  eventos_principais: { label: "Eventos principais", description: "Eventos tradicionais e permanentes da cidade.", route: "/admin/eventos-principais", group: "Conteúdo", icon: "event", keywords: ["festas", "principais"], primaryAction: "Novo evento principal", permission: "eventos", dashboard: { domain: "Conteúdo", indicator: "Ativos" } },
  eventos_edicoes: { label: "Edições", description: "Edições, cartazes, programação e histórico de eventos.", route: "/admin/edicoes", group: "Conteúdo", icon: "editions", keywords: ["edições", "programação"], primaryAction: "Nova edição", permission: "eventos", dashboard: { domain: "Conteúdo", indicator: "Edições" } },
  categorias: { label: "Categorias", description: "Taxonomia usada por notícias, guia, turismo e eventos.", route: "/admin/categorias", group: "Conteúdo", icon: "category", keywords: ["tags", "tipos"], primaryAction: "Nova categoria", permission: "categorias", dashboard: { domain: "Conteúdo", indicator: "Ativas" } },
  guia_comercial: { label: "Guia comercial", description: "Empresas, contatos, imagens e dados do Guia Comercial.", route: "/admin/guia", group: "Viva Urânia", icon: "guide", keywords: ["empresas", "negócios", "guia"], primaryAction: "Cadastrar empresa", permission: "guia_comercial", dashboard: { domain: "Viva Urânia", indicator: "Empresas" } },
  guia_verificacao: { label: "Verificação do Guia", description: "Qualidade e revisão periódica dos cadastros comerciais.", route: "/admin/guia-verificacao", group: "Viva Urânia", icon: "checkStore", keywords: ["qualidade", "cadastros"], permission: "guia_comercial", dashboard: { domain: "Viva Urânia", indicator: "Diagnóstico" } },
  turismo: { label: "Turismo", description: "Atrativos, lugares, mapas e informações turísticas.", route: "/admin/turismo", group: "Viva Urânia", icon: "tourism", keywords: ["lugares", "mapa", "atrativos"], primaryAction: "Adicionar local", permission: "turismo", dashboard: { domain: "Viva Urânia", indicator: "Locais" } },
  turismo_verificacao: { label: "Verificação de Turismo", description: "Conferência de dados dos atrativos turísticos.", route: "/admin/turismo-verificacao", group: "Viva Urânia", icon: "tourism", keywords: ["revisão", "turismo"], permission: "turismo", dashboard: { domain: "Viva Urânia", indicator: "Revisões" } },
  telefones_uteis: { label: "Telefones úteis", description: "Contatos importantes e serviços exibidos no app.", route: "/admin/telefones-uteis", group: "Viva Urânia", icon: "phone", keywords: ["telefone", "contato"], primaryAction: "Novo telefone", permission: "configuracoes", dashboard: { domain: "Viva Urânia", indicator: "Contatos" } },
  motoristas: { label: "Motoristas", description: "Motoristas particulares e contatos locais.", route: "/admin/motoristas", group: "Viva Urânia", icon: "car", keywords: ["transporte", "corridas"], primaryAction: "Novo motorista", permission: "configuracoes", dashboard: { domain: "Viva Urânia", indicator: "Motoristas" } },
  iniciativas: { label: "Iniciativas da Comunidade", description: "Projetos, ações e campanhas da comunidade.", route: "/admin/iniciativas", group: "Viva Urânia", icon: "initiative", keywords: ["comunidade", "ações"], primaryAction: "Nova iniciativa", permission: "configuracoes", dashboard: { domain: "Viva Urânia", indicator: "Iniciativas" } },
  vantagens: { label: "Viva Vantagens", description: "Cupons, ofertas e benefícios de parceiros.", route: "/admin/vantagens", group: "Viva Urânia", icon: "ticket", keywords: ["cupons", "benefícios"], primaryAction: "Nova vantagem", permission: "guia_comercial", dashboard: { domain: "Viva Urânia", indicator: "Ativas" } },
  links: { label: "Links", description: "Vitrine de links, WhatsApp, aplicativo e atalhos oficiais.", route: "/admin/links", group: "Viva Urânia", icon: "link", keywords: ["urânia links", "bio"], primaryAction: "Novo link", permission: "links", dashboard: { domain: "Viva Urânia", indicator: "Ativos" } },
  publicidade: { label: "Publicidade", description: "Campanhas, assinantes, posições, mídia e métricas comerciais.", route: "/admin/publicidade", group: "Comercial", icon: "ads", keywords: ["anúncios", "comercial", "assinantes"], primaryAction: "Nova campanha", permission: "publicidade", dashboard: { domain: "Comercial", indicator: "Campanhas" } },
  melhores: { label: "Melhores de Urânia", description: "Edições, categorias, indicados, votos e apuração.", route: "/admin/melhores", group: "Comercial", icon: "award", keywords: ["prêmio", "votação", "melhores"], primaryAction: "Nova edição", permission: "melhores", dashboard: { domain: "Comercial", indicator: "Edições" } },
  comunicacao: { label: "Comunicação", description: "Newsletters, assinantes, disparos e relacionamento.", route: "/admin/comunicacao", group: "Comunicação", icon: "mail", keywords: ["email", "newsletter"], primaryAction: "Nova newsletter", permission: "comunicacao", dashboard: { domain: "Comunicação", indicator: "Assinantes" } },
  notificacoes: { label: "Notificações do app", description: "Push, aparelhos cadastrados e histórico do Viva Urânia.", route: "/admin/viva-urania", group: "Comunicação", icon: "bell", keywords: ["push", "app", "viva"], primaryAction: "Nova notificação", permission: "notificacoes", dashboard: { domain: "Comunicação", indicator: "Envios" } },
  colaboradores_voluntarios: { label: "Colaborações", description: "Pessoas interessadas em colaborar com iniciativas locais.", route: "/admin/colaboracoes", group: "Comunicação", icon: "people", keywords: ["voluntários", "colaboração"], primaryAction: "Nova colaboração", permission: "colaboradores", dashboard: { domain: "Comunicação", indicator: "Novos" } },
  submissoes: { label: "Submissões públicas", description: "Empresas e eventos enviados pelo público para análise.", route: "/admin/submissoes", group: "Comunicação", icon: "submission", keywords: ["envios", "público"], permission: "submissoes", dashboard: { domain: "Comunicação", indicator: "Pendentes" } },
  midia: { label: "Mídia", description: "Biblioteca de imagens do CMS, uploads, versões e limpeza segura.", route: "/admin/midia", group: "Sistema", icon: "media", keywords: ["galeria", "biblioteca", "imagens", "upload"], permission: "configuracoes", dashboard: { domain: "Sistema", indicator: "Biblioteca" } },
  configuracoes_site: { label: "Configurações", description: "Chaves, textos e ajustes globais do portal.", route: "/admin/configuracoes", group: "Sistema", icon: "settings", keywords: ["site", "config"], primaryAction: "Nova configuração", permission: "configuracoes", dashboard: { domain: "Sistema", indicator: "Ajustes" } },
  usuarios: { label: "Usuários", description: "Equipe administrativa, papéis e permissões.", route: "/admin/usuarios", group: "Sistema", icon: "people", keywords: ["admin", "permissões", "equipe"], primaryAction: "Novo usuário", permission: "usuarios", dashboard: { domain: "Sistema", indicator: "Ativos" } },
  importacao: { label: "Importar JSON", description: "Migração assistida de conteúdo antigo e lotes controlados.", route: "/admin/importacao", group: "Sistema", icon: "import", keywords: ["json", "migração", "importação"], permission: "importacao", dashboard: { domain: "Sistema", indicator: "Ferramenta" } }
};

export const ADMIN_MODULE_GROUPS = ["Operação", "Conteúdo", "Viva Urânia", "Comercial", "Comunicação", "Sistema"].map(label => ({
  label,
  items: Object.entries(ADMIN_MODULES)
    .filter(([, module]) => module.group === label)
    .map(([key, module]) => ({ key, view: key, module: module.permission || key, ...module }))
}));

export const ADMIN_MODULE_LIST = Object.entries(ADMIN_MODULES).map(([key, module]) => ({ key, view: key, module: module.permission || key, ...module }));

export function getAdminModule(key = "dashboard") {
  return ADMIN_MODULES[key] || ADMIN_MODULES.dashboard;
}

export function adminModulesForNavigation() {
  return ADMIN_MODULE_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => ({ ...item }))
  }));
}

export function renderAdminModuleIcon(keyOrModule, extraClass = "") {
  const module = typeof keyOrModule === "string" ? getAdminModule(keyOrModule) : keyOrModule;
  const svg = ADMIN_MODULE_ICONS[module?.icon] || ADMIN_MODULE_ICONS.dashboard;
  return `<span class="admin-module-icon ${extraClass}" aria-hidden="true">${svg}</span>`;
}
