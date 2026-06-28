# Variáveis de ambiente

Configure em Vercel > Project Settings > Environment Variables e replique em Preview e Production conforme necessário.

| Variável | Onde | Sigilo | Finalidade |
|---|---|---|---|
| `SUPABASE_URL` | Vercel/API | pública | URL do projeto |
| `SUPABASE_ANON_KEY` | Vercel/API e config público | pública | Publishable Key sujeita a RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | somente Vercel | secreta | operações server-side autorizadas |
| `BREVO_API_KEY` | somente Vercel | secreta | envio de e-mail |
| `SITE_URL` | Vercel | pública | domínio canônico |

O frontend usa somente Project URL e Publishable/Anon Key em `assets/js/supabase-config.js`. Nunca coloque Secret/Service Role ou `BREVO_API_KEY` em HTML, JavaScript público, commits, logs ou capturas.

Após alterar uma variável, faça novo deploy. Valide login, leitura pública, newsletter de teste e descadastro. Em caso de vazamento, revogue a chave no provedor, gere outra e atualize a Vercel imediatamente.