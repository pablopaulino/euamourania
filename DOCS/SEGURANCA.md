# Segurança

Segurança no Eu Amo Urânia depende de três camadas: permissões no painel, RLS no Supabase e APIs seguras na Vercel.

## Regras essenciais

- Nunca expor `SUPABASE_SERVICE_ROLE_KEY`.
- Nunca expor `BREVO_API_KEY`.
- Nunca expor credenciais Google.
- Nunca expor segredo do Turnstile.
- Nunca confiar apenas em botão escondido no front-end.
- Toda ação sensível deve ser validada no backend, RPC ou RLS.

## Autenticação

O painel usa Supabase Auth.

Recomendado:

- ativar MFA para administradores;
- usar senhas fortes;
- desativar usuários que não participam mais;
- revisar permissões periodicamente.

## Funções administrativas

Funções previstas:

- Super Admin;
- Administrador;
- Editor;
- Redator;
- Comercial;
- Comunicação;
- Visualizador.

Cada função deve enxergar apenas os menus permitidos e também ser bloqueada no banco caso tente executar ação manualmente pelo navegador.

## RLS

Todas as tabelas administrativas ou sensíveis devem ter Row Level Security.

Diretrizes:

- conteúdo público: leitura apenas quando publicado/ativo;
- conteúdo administrativo: leitura/escrita por permissão;
- métricas: leitura por administradores autorizados;
- votos: inserção pública validada, leitura restrita;
- assinantes: proteção contra exposição indevida.

## Dados pessoais e LGPD

Evitar coletar:

- IP puro;
- documentos;
- dados sensíveis;
- localização precisa sem necessidade.

Quando coletar contato:

- informar finalidade;
- permitir descadastro quando aplicável;
- restringir acesso no painel;
- não usar para finalidade incompatível.

## Votação do Melhores de Urânia

Obrigatório:

- Turnstile ativo;
- `MELHORES_VOTO_SECRET`;
- rate limit;
- sanitização;
- auditoria;
- retenção de votos individuais por 7 dias após encerramento;
- consolidação antes da limpeza.

## APIs

APIs devem:

- validar método HTTP;
- validar origem quando necessário;
- sanitizar entrada;
- limitar payload;
- tratar erros sem expor segredo;
- usar Service Role somente no servidor;
- retornar mensagens claras e seguras.

## Publicidade e newsletter

Links e conteúdos enviados por anunciantes ou campanhas devem ser tratados como dados não confiáveis:

- validar URLs;
- sanitizar textos;
- evitar HTML perigoso;
- bloquear scripts no conteúdo;
- preservar descadastro em e-mails.

## Backup e recuperação

Antes de alterações grandes:

- exportar dados críticos;
- conferir migração;
- testar em ambiente seguro;
- manter plano de reversão.

Teste de restauração deve ser feito periodicamente.
