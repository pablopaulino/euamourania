# Vercel, APIs e deploy

O deploy oficial do portal é feito na Vercel, com a branch `main` como produção.

## Funções serverless

Pasta:

- `api/`

Funções principais:

- `home.js`: HTML dinâmico da home.
- `noticia.js`: página de notícia com metadados dinâmicos.
- `sitemaps.js`: sitemap e news sitemap.
- `rss.js`: feed RSS.
- `newsletter-send.js`: envio de newsletter.
- `newsletter-track.js`: rastreamento de e-mail.
- `google-audience.js`: dados do GA4/Search Console.
- `google-config.js`: configuração de integração Google.
- `admin-users.js`: ações administrativas de usuários.
- `melhores-votar.js`: votação e rotinas do Melhores de Urânia.
- `melhores-indicar.js`: indicações públicas.
- `push-send.js`: notificações do app.

## Rewrites e redirects

Arquivo:

- `vercel.json`

Responsável por:

- URLs amigáveis de notícias;
- compatibilidade com links antigos;
- rotas do Guia;
- rotas de Turismo;
- rotas de Eventos;
- rotas do Melhores de Urânia;
- links limpos;
- sitemaps;
- RSS;
- headers de segurança.

## Cron

O Vercel Cron roda tarefas programadas, como limpeza segura de votos individuais do Melhores de Urânia após o período de retenção.

## Limite do plano Hobby

O plano Hobby possui limite de funções serverless. Se o deploy falhar com erro de limite, consolide funções ou remova APIs desnecessárias antes de publicar.

## Processo de publicação

Antes de publicar:

```bash
npm run validate
npm test
```

Depois:

1. Commit na branch correta.
2. Push para GitHub.
3. Conferir deploy na Vercel.
4. Abrir site público.
5. Testar `/admin`.
6. Testar páginas principais.

## Checklist pós-deploy

- Home abre.
- Notícias listam.
- Notícia individual abre por slug.
- Guia e empresas abrem.
- Turismo e atrações abrem.
- Eventos e edições abrem.
- Melhores de Urânia abre.
- Links abre.
- Login admin funciona.
- Sitemaps respondem.
- Console do navegador não mostra erro crítico.
