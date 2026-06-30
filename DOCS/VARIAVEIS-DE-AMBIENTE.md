# Variáveis de ambiente

Configure em Vercel > Project Settings > Environment Variables e replique em Preview e Production conforme necessário.

| Variável | Onde | Sigilo | Finalidade |
|---|---|---|---|
| `SUPABASE_URL` | Vercel/API | pública | URL do projeto |
| `SUPABASE_ANON_KEY` | Vercel/API e config público | pública | Publishable Key sujeita a RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | somente Vercel | secreta | operações server-side autorizadas |
| `BREVO_API_KEY` | somente Vercel | secreta | envio de e-mail |
| `SITE_URL` | Vercel | pública | domínio canônico |
| `GA4_PROPERTY_ID` | somente Vercel | interna | propriedade do Google Analytics 4, quando ativada |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | somente Vercel | secreta | credencial de leitura das APIs Google |
| `SEARCH_CONSOLE_SITE_URL` | somente Vercel | interna | propriedade verificada do Search Console |

O frontend usa somente Project URL e Publishable/Anon Key em `assets/js/supabase-config.js`. Nunca coloque Secret/Service Role, `BREVO_API_KEY` ou `GOOGLE_SERVICE_ACCOUNT_JSON` em HTML, JavaScript público, commits, logs ou capturas.

Após alterar uma variável, faça novo deploy. Valide login, leitura pública, newsletter de teste e descadastro. Em caso de vazamento, revogue a chave no provedor, gere outra e atualize a Vercel imediatamente.
