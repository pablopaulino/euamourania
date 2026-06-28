# Eu Amo Urânia

Portal local e CMS do Eu Amo Urânia, publicado na Vercel e integrado ao Supabase. Mantém uma experiência pública responsiva e oferece administração de notícias, guia comercial, turismo, eventos, links, categorias, publicidade, comunicação/newsletter, configurações e métricas.

## Arquitetura

- HTML, CSS e JavaScript modular no frontend.
- Supabase Postgres, Auth, Storage, RPC e RLS.
- Funções serverless da Vercel para operações seguras, Open Graph e sitemaps.
- Brevo para envio de newsletters, sem expor a API Key.
- GitHub Actions para validação e smoke test.

## Configuração rápida

1. Em um projeto novo, execute `supabase/schema.sql`; em ambiente existente, aplique `supabase/migrations` na ordem.
2. Preencha somente Project URL e Publishable Key em `assets/js/supabase-config.js`.
3. Configure as variáveis server-side na Vercel conforme `DOCS/VARIAVEIS-DE-AMBIENTE.md`.
4. Crie o usuário no Supabase Auth e autorize-o em `usuarios_admin`.
5. Publique pela `main` e valide `https://euamourania.com.br/admin/`.

Nunca coloque Secret/Service Role ou `BREVO_API_KEY` no frontend ou no repositório.

## Desenvolvimento e validação

Requer Node.js 20 ou superior.

```bash
npm test
npm run smoke
```

`npm test` verifica sintaxe, referências HTML, arquivos essenciais e padrões de segredo. `npm run smoke` testa as rotas essenciais do ambiente publicado e a proteção da API de newsletter.

## Operação

- Notícias usam URLs amigáveis em `/noticias/slug-da-materia` e metadados dinâmicos.
- Conteúdo público vem do Supabase; JSON legado serve somente para migração/arquivo e não para exibição.
- O painel exige Supabase Auth e autorização em `usuarios_admin`.
- Publicidade respeita status, período, prioridade e posição.
- Comunicação gerencia assinantes, campanhas, teste, envio, métricas e descadastro.

## Documentação

Comece por [`DOCS/README.md`](DOCS/README.md). Há guias de arquitetura, banco/RLS, deploy, variáveis, segurança, CMS, SEO/performance/acessibilidade, operação/backup, manuais, testes, troubleshooting e roadmap.

## Produção

- Site: https://euamourania.com.br
- Administração: https://euamourania.com.br/admin/

Antes de cada merge: CI verde, Preview verificado, nenhum segredo no diff e checklist de `DOCS/TESTES-E-CHECKLIST.md` concluído.