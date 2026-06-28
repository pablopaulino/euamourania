# Ativação do módulo Publicidade

O novo módulo substitui a gestão simples de banners por campanhas completas. Nenhuma Secret Key é usada ou necessária.

## Instalação no Supabase

1. Abra o painel do projeto no Supabase.
2. Entre em **SQL Editor** e crie uma consulta nova.
3. Copie integralmente o conteúdo de `supabase/migrations/20260628_publicidade_cms.sql`.
4. Execute e confirme que aparece **Success. No rows returned**.
5. Recarregue `/admin/publicidade.html`.

A migração pode ser executada novamente. Banners antigos com imagem são importados sem duplicação.

## Criar uma campanha

1. Acesse `/admin/publicidade.html` com um administrador autorizado.
2. Clique em **Nova campanha**.
3. Informe campanha, empresa, tipo e mídia.
4. Escolha período, status, prioridade e posições.
5. Para pop-up, configure frequência, atraso e botão de fechar.
6. Salve como rascunho ou ative.

Campanhas ativas só aparecem dentro do período configurado. Quando não existe campanha para uma posição, o site não cria espaço vazio.

## Métricas

Impressões e cliques são registrados por uma função segura do banco. O dashboard apresenta campanhas ativas, agendadas e encerradas, total de impressões, cliques, CTR e evolução diária.

## Segurança

- O navegador continua usando somente a Project URL e a Publishable Key.
- Criação, edição, exclusão, upload e leitura administrativa dependem de `usuarios_admin`.
- Visitantes só conseguem ler campanhas ativas e dentro do período.
- Uploads aceitam imagens, GIF, MP4 e WebM até 15 MB.

## Preparação futura

A estrutura já separa anunciantes, campanhas, posições e métricas diárias. O campo `configuracao_futura` permite evoluir para horários, limites, recorrência, cobrança e painel do anunciante sem alterar os registros atuais.
