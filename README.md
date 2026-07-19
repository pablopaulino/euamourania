# Eu Amo Urânia

Portal local e CMS do **Eu Amo Urânia**, criado para reunir notícias, guia comercial, turismo, eventos, links, comunicação, publicidade, audiência, colaboradores e o módulo **Melhores de Urânia**.

O projeto usa uma base simples no front-end público, com HTML, CSS e JavaScript, e uma estrutura profissional de dados e administração com Supabase, Vercel e integrações externas.

## Documentação oficial

A documentação principal foi reorganizada em:

- [Documentação completa do sistema](DOCS/SISTEMA-COMPLETO.md)
- [Índice da documentação](DOCS/README.md)
- [Arquitetura](DOCS/ARQUITETURA.md)
- [Banco de dados e Supabase](DOCS/BANCO-E-SUPABASE.md)
- [CMS e módulos administrativos](DOCS/CMS-E-MODULOS.md)
- [Variáveis de ambiente](DOCS/VARIAVEIS-DE-AMBIENTE.md)
- [Deploy, Vercel e APIs](DOCS/VERCEL-APIS-DEPLOY.md)
- [Segurança](DOCS/SEGURANCA.md)
- [Testes e checklist](DOCS/TESTES-E-CHECKLIST.md)

## Stack principal

- Front-end público: HTML, CSS e JavaScript modular.
- CMS administrativo: páginas em `/admin`, Supabase Auth, RBAC e RLS.
- Banco de dados: Supabase Postgres.
- Storage: Supabase Storage para biblioteca de mídia.
- Backend seguro: Vercel Serverless Functions em `/api`.
- Deploy: Vercel, com GitHub como origem.
- E-mail: Brevo.
- Analytics: eventos internos no Supabase, com suporte a GA4 e Search Console.
- Proteção de votação: Cloudflare Turnstile e segredo de voto.

## Como rodar localmente

Requisitos:

- Node.js 20 ou superior.
- Projeto Supabase configurado.
- Variáveis públicas no front-end e variáveis sensíveis no Vercel.

Comandos principais:

```bash
npm run validate
npm test
npm run serve
```

## Configuração essencial

1. Execute o `supabase/schema.sql`.
2. Execute as migrações em `supabase/migrations/`, na ordem cronológica.
3. Configure `assets/js/supabase-config.js` com:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` ou publishable key pública.
4. Configure as variáveis sensíveis no Vercel.
5. Crie o usuário administrador no Supabase Auth.
6. Registre esse usuário em `usuarios_admin` como `super_admin`.
7. Faça o deploy pela branch `main`.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, credenciais Google ou segredos de votação no código público.

## URLs principais

- Site público: `https://euamourania.com.br`
- Painel administrativo: `https://euamourania.com.br/admin`
- Notícias: `/news/` e `/noticias/:slug`
- Guia: `/guia.html`, `/guia/:slug` e páginas por categoria do guia
- Turismo: `/turismo.html` e `/turismo/:slug`
- Eventos: `/eventos/`, `/eventos/:slug` e `/eventos/:slug/:ano`
- Melhores de Urânia: `/melhores-de-urania/`
- Links: `/links`
- Urânia: `/urania/`
- Colabore: `/colabore/`

## Observações importantes

- O site público não deve depender de JSON para conteúdo dinâmico principal.
- Os arquivos JSON antigos são legado ou base de importação.
- A ordenação pública de notícias deve respeitar a data de publicação, não `updated_at`.
- Conteúdos em rascunho, arquivados ou agendados para o futuro não devem aparecer publicamente.
- O painel pode exibir dados internos de atualização, mas isso não deve interferir na experiência pública.

## Manutenção

Ao criar ou alterar módulo, tabela, API, variável de ambiente, regra de permissão, rota pública ou rotina de deploy, atualize a documentação correspondente em `DOCS/`.
