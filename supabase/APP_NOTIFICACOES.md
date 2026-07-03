# Notificações do Viva Urânia

Esta funcionalidade é isolada do conteúdo do portal. Empresas, turismo, eventos,
notícias, CMS e site público não são modificados.

## 1. Banco de dados

No SQL Editor do Supabase, execute integralmente:

`supabase/migrations/20260703_app_push_notifications.sql`

A migração cria apenas:

- `app_push_tokens`
- `app_notificacoes`
- `app_push_falhas`
- duas funções RPC para ativar e desativar um aparelho
- políticas RLS e permissões administrativas

## 2. Segurança do envio

Crie um Expo Access Token na conta proprietária do projeto EAS. Na Vercel,
adicione a variável:

`EXPO_ACCESS_TOKEN`

Mantenha também:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

O token da Expo é secreto e nunca pode ser colocado no aplicativo, HTML,
JavaScript público, Supabase Publishable Key ou GitHub.

Ative **Enhanced Security for Push Notifications** no projeto Expo depois de
confirmar que `EXPO_ACCESS_TOKEN` está configurado no servidor.

## 3. Android

No Firebase Console:

1. Crie ou selecione um projeto.
2. Registre o Android `br.com.euamourania.app`.
3. Configure uma credencial FCM v1 para o projeto EAS.
4. Envie a credencial usando `eas credentials`.
5. Gere um novo APK/AAB.

Notificações remotas não funcionam no Expo Go no Android. Use Development Build,
APK preview ou AAB instalado pela Play Store.

## 4. Operação

Depois da migração e do deploy:

1. Instale o novo build em um aparelho físico.
2. Abra **Mais > Configurações**.
3. Ative **Notificações** e autorize o sistema.
4. Abra `/admin/notificacoes-app.html`.
5. Crie um rascunho, revise e clique em **Enviar**.

O painel mostra aparelhos ativos, Android/iPhone, envios aceitos e falhas.

## 5. Armazenamento

Somente tokens ativos e falhas de envio são guardados. Não há rastreamento de
localização, contatos ou conteúdo pessoal. Falhas antigas podem ser removidas
periodicamente, por exemplo após 90 dias.

## 6. Conformidade

Antes de publicar o build:

- atualizar a política de privacidade para informar o uso de push tokens;
- revisar a seção Segurança dos dados no Google Play;
- informar que notificações são opcionais e podem ser desativadas no app ou no
  sistema operacional.
