# Variáveis de ambiente

Este projeto usa variáveis públicas no front-end e variáveis sensíveis no Vercel.

## Front-end público

Arquivo:

- `assets/js/supabase-config.js`

Valores:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` ou Publishable Key pública

Essas chaves podem ficar no navegador porque são públicas e dependem das políticas RLS do Supabase.

## Vercel Environment Variables

Configure em Production e Preview quando a função também for usada em ambiente de prévia.

### Supabase

- `SUPABASE_SERVICE_ROLE_KEY`

Uso: APIs administrativas e operações que não podem ser feitas diretamente pelo navegador.

Nunca expor no front-end.

### Brevo

- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`

Uso: envio de newsletters, testes, campanhas e e-mails assistidos.

### Google

- `GA_MEASUREMENT_ID`
- `GA4_PROPERTY_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
- `SEARCH_CONSOLE_SITE_URL`

Uso:

- medição no site;
- consultas seguras de GA4;
- consultas seguras do Search Console.

`GOOGLE_SERVICE_ACCOUNT_JSON` deve ficar como JSON completo em variável sensível.

### Melhores de Urânia

- `MELHORES_VOTO_SECRET`
- segredo do Cloudflare Turnstile, se usado em função segura.

Uso:

- validação de voto;
- assinatura/segurança;
- proteção contra abuso.

### App/notificações

- `EXPO_ACCESS_TOKEN`

Uso: envio de notificações push, quando o app estiver integrado.

## Boas práticas

- Não versionar `.env` real.
- Não copiar secret key em prints ou mensagens.
- Separar chave pública de chave sensível.
- Conferir se Preview e Production têm as mesmas variáveis quando necessário.
- Depois de mudar variável na Vercel, fazer novo deploy.
