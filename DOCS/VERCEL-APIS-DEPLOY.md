# Vercel, APIs e deploy

## Fluxo

1. Trabalhe em branch.
2. Abra PR e aguarde a validação automática.
3. Teste o Preview da Vercel.
4. Faça merge em `main`.
5. Confirme o domínio `euamourania.com.br` e execute `npm run smoke`.

## Rotas

`vercel.json` mantém URLs amigáveis de notícias e redireciona links antigos. Funções em `api/` entregam metadados dinâmicos, sitemaps e operações protegidas de comunicação.

## Contrato das APIs

- Validar método, sessão, autorização administrativa e payload.
- Nunca devolver chaves ou detalhes internos de erro.
- Responder JSON com status HTTP correto.
- Aplicar limites de tamanho, lotes e idempotência em envios.

## Rollback

Na Vercel, escolha o último deployment saudável e promova-o novamente. Se houver migração de banco incompatível, siga a reversão prevista no arquivo da migração ou restaure o backup testado. Não apague dados para corrigir deploy.

## Verificação pós-deploy

Home, notícias por slug, guia, turismo, eventos, links, login/logout, CRUD principal, newsletter de teste, banners, sitemap, robots e ausência de erros no console.