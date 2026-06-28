# Segurança

## Modelo

Supabase Auth autentica; `usuarios_admin` autoriza. RLS é a barreira principal do banco. APIs serverless repetem autenticação e autorização antes de usar credenciais privilegiadas.

## Regras obrigatórias

- Frontend: somente Publishable/Anon Key.
- Service Role e Brevo: somente variáveis da Vercel.
- Conteúdo HTML editorial deve ser sanitizado antes de renderizar.
- Uploads devem validar tipo, tamanho e nome.
- Exclusões exigem confirmação; ações administrativas relevantes entram em `cms_atividades`.
- Mensagens públicas não devem revelar stack traces ou configuração.

## Rotina

Mensalmente: revisar administradores, dependências, logs e políticas RLS. Trimestralmente: testar restauração. Ao desligar um colaborador: remover de `usuarios_admin`, encerrar sessões e revisar atividades.

## Incidente

1. Conter acesso e retirar a função afetada do ar se necessário.
2. Revogar/rotacionar credenciais.
3. Preservar logs e identificar alcance.
4. Corrigir e testar em Preview.
5. Restaurar serviço e registrar causa/ação preventiva.

## Pendências recomendadas

CSP baseada em nonce/hash, rate limit centralizado, MFA obrigatório para administradores, monitoramento de erros e alertas de comportamento anormal.