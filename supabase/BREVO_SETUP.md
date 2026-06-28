# Configuração da Brevo

1. No Supabase SQL Editor, execute `supabase/migrations/20260628_comunicacao_newsletter.sql`.
2. Na Brevo, valide o remetente que será usado nos e-mails.
3. Na Vercel, abra o projeto > Settings > Environment Variables.
4. Cadastre `BREVO_API_KEY` com a chave da API v3 da Brevo para Production, Preview e Development.
5. Cadastre opcionalmente `BREVO_SENDER_EMAIL` com o e-mail remetente verificado. Sem essa variável, será usado `euamourania@gmail.com`.
6. Faça um novo deploy para as variáveis entrarem em vigor.

Nunca coloque a chave Brevo em HTML, JavaScript público, Supabase ou GitHub. A função `/api/newsletter-send` só aceita uma sessão de administrador autorizada.

## Teste recomendado

Crie uma newsletter como rascunho e use **Teste** antes do primeiro envio real. O envio usa a API transacional oficial da Brevo com versões personalizadas em lote.

## Métricas

A versão inicial registra enviados, aberturas, cliques e descadastros. O campo de entregues e a estrutura de envios já estão preparados para integrar os webhooks transacionais da Brevo futuramente.
