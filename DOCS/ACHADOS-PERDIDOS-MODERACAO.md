# Moderação de Achados e Perdidos

Acesse **Viva Urânia → Achados e Perdidos** no painel administrativo. A tela mostra anúncios pendentes, com detalhes e foto quando houver. Um Super Admin pode aprovar ou rejeitar após confirmação; a verificação também é feita no banco.

Ao aprovar, o aplicativo passa a exibir o anúncio como ativo. A rotina existente do aplicativo registra a data de publicação e prepara um rascunho de notificação; a aprovação não envia o push automaticamente. Uma decisão simultânea ou dados alterados fazem a tela atualizar a lista antes de uma nova decisão.

A migração `20261031_admin_achados_perdidos.sql` exige a estrutura e o gatilho do aplicativo e cria funções de listagem e decisão restritas a Super Admin. Não altera as permissões existentes de administradores nem modifica o fluxo de criação de anúncios no aplicativo. A publicação do site não aplica a migração automaticamente.
