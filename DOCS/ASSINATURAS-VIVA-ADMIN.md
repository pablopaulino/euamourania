# Assinaturas Viva no painel administrativo

A central de assinaturas fica em `/admin/viva-assinaturas.html` e aparece no grupo **Comercial** do menu como **Assinaturas Viva**. O acesso exige a permissão `guia_comercial` para edição.

A tela mostra o total de assinaturas ativas, as que vencem em até 15 dias e as que aguardam confirmação de pagamento. A tabela permite buscar empresas pelo nome, filtrar por status e abrir a edição ou renovação de cada empresa. O formulário usa a RPC `admin_salvar_assinatura_viva`, mantém o histórico e confirma o resultado com um aviso flutuante.

Os dados vêm de `guia_comercial`, `viva_assinaturas` e `viva_assinaturas_historico`. A publicação do site pela branch `main` não aplica migrations do Supabase automaticamente; a estrutura de assinaturas deve estar disponível no banco antes de usar a central.
