# Fluxo editorial e audiência

## Instalação

Execute `supabase/migrations/20260630_fluxo_editorial_audiencia.sql` e depois `supabase/migrations/20260701_super_admin_publicacao_direta.sql` no SQL Editor antes de publicar o frontend. As migrações preservam o status público, marcam notícias já publicadas como editorialmente aprovadas e não coletam IP.

## Fluxo editorial

O campo `noticias.status` continua controlando a presença pública: `rascunho`, `publicado` ou `arquivado`. O novo `status_editorial` controla o processo interno: `rascunho`, `em_revisao`, `ajustes_solicitados` ou `aprovado`.

1. Redator, Editor ou Administrador salva e revisa a própria matéria.
2. Em **Notícias**, abre o rascunho e usa **Enviar para aprovação**.
3. A matéria fica bloqueada para o autor durante a revisão.
4. Editor, Administrador ou Super Admin abre **Aprovações**. Um Editor ou Administrador não pode aprovar a própria matéria; outro responsável deve revisá-la.
5. O revisor usa a prévia e escolhe:
   - **Solicitar ajustes**, com comentário obrigatório;
   - **Aprovar**, mantendo a notícia como rascunho aprovado;
   - **Aprovar e publicar**, respeitando data e horário escolhidos.
6. Uma notícia com publicação futura só aparece quando `publicado_em <= now()`.

O **Super Admin** é a única exceção: o editor mostra **Publicar agora** e a RPC `publicar_noticia_super_admin` aprova e publica em uma única operação. Ele não precisa criar uma solicitação de aprovação.

As RPCs `enviar_noticia_revisao`, `revisar_noticia` e `publicar_noticia_super_admin` validam propriedade, função, estado e publicação no banco. Alterar botões ou chamadas pelo navegador não contorna o RLS. Não existe cópia integral do conteúdo nem comparação de versões; somente as decisões editoriais são registradas em `cms_atividades`.

## Central de audiência

A área **Audiência** permite períodos de 7, 30, 90 dias ou personalizados e apresenta:

- visualizações e visitantes pseudônimos por sessão;
- comparação com o período anterior;
- notícias, empresas, eventos e turismo mais acessados;
- páginas, origens e dispositivos;
- cliques em WhatsApp, Instagram e links externos;
- buscas realizadas no portal;
- campanhas publicitárias;
- gráfico diário e exportação CSV.

O identificador de sessão é aleatório, fica no `sessionStorage` e não identifica a pessoa. O sistema não grava IP, e-mail ou telefone. Eventos repetidos na mesma página e sessão são limitados por 30 minutos.

## Google Analytics e Search Console

As métricas próprias funcionam mesmo se o Google estiver temporariamente indisponível. A integração complementar usa:

- `GA_MEASUREMENT_ID`;
- `GA4_PROPERTY_ID`;
- `GOOGLE_SERVICE_ACCOUNT_JSON`;
- `SEARCH_CONSOLE_SITE_URL`.

O site consulta `/api/google-config` e recebe somente o ID público de medição. O GA4 é carregado apenas depois de o visitante escolher **Aceitar** no aviso de cookies. A recusa mantém o portal disponível e não carrega a tag do Google.

O painel autenticado consulta `/api/google-audience`, que valida a permissão `insights:ler`, gera um token OAuth da conta de serviço no backend e combina GA4 Data API e Search Console API. As respostas ficam em cache por dez minutos.

Conceda à conta de serviço somente leitura na propriedade GA4 e acesso de leitura no Search Console. Nunca exponha o JSON da conta de serviço no frontend, em logs ou no GitHub.

## Validação por função

- **Redator:** cria rascunho próprio, envia, perde edição enquanto aguarda e volta a editar após ajustes.
- **Editor:** envia as próprias matérias para aprovação; revisa, solicita ajustes, aprova e publica matérias de outras pessoas.
- **Administrador:** envia as próprias matérias para aprovação e revisa matérias de outras pessoas.
- **Super Admin:** pode publicar diretamente e também revisar qualquer matéria.
- **Visualizador:** consulta audiência, sem ações de escrita.
- **Demais funções:** não acessam a fila nem os relatórios sem permissão explícita.

