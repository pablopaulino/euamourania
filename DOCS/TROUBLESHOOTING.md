# Solução de problemas

## Site sem dados

Confirme rede, Project URL/Publishable Key, status do Supabase, consulta no console e política RLS. Não contorne RLS expondo Service Role.

## Admin não entra

Confirme usuário no Auth, e-mail verificado, registro ativo em `usuarios_admin`, horário do dispositivo e console. Saia, limpe apenas a sessão do site e tente novamente.

## Newsletter de teste falha

Confira sessão administrativa, `BREVO_API_KEY` na Vercel, remetente validado no Brevo, destinatário válido e logs da função. Após alterar variável, faça novo deploy.

## Conteúdo não aparece

Verifique status, data de publicação, slug único, categoria ativa e cache. Abra em janela anônima.

## Imagem quebrada

Teste URL HTTPS, permissão do bucket, tipo/tamanho e CORS. Use placeholder público até corrigir.

## Deploy falha

Leia primeiro o check do GitHub e os logs da Vercel. Reproduza com `npm test`. Corrija em branch; se produção estiver comprometida, promova o último deployment saudável.