# Fluxo editorial e audiência

## Instalação

Execute `supabase/migrations/20260630_fluxo_editorial_audiencia.sql` no SQL Editor antes de publicar o frontend. A migração preserva o status público, marca notícias já publicadas como editorialmente aprovadas e não coleta IP.

## Fluxo editorial

O campo `noticias.status` continua controlando a presença pública: `rascunho`, `publicado` ou `arquivado`. O novo `status_editorial` controla o processo interno: `rascunho`, `em_revisao`, `ajustes_solicitados` ou `aprovado`.

1. O Redator salva e revisa a própria matéria.
2. Em **Notícias**, abre o rascunho e usa **Enviar para aprovação**.
3. A matéria fica bloqueada para o Redator.
4. Editor, Administrador ou Super Admin abre **Aprovações**.
5. O revisor usa a prévia e escolhe:
   - **Solicitar ajustes**, com comentário obrigatório;
   - **Aprovar**, mantendo a notícia como rascunho aprovado;
   - **Aprovar e publicar**, respeitando data e horário escolhidos.
6. Uma notícia com publicação futura só aparece quando `publicado_em <= now()`.

As RPCs `enviar_noticia_revisao` e `revisar_noticia` validam propriedade, função, estado e publicação no banco. Alterar botões ou chamadas pelo navegador não contorna o RLS. Não existe cópia integral do conteúdo nem comparação de versões; somente as decisões editoriais são registradas em `cms_atividades`.

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

As métricas próprias funcionam sem Google. Para uma etapa futura, configure no backend da Vercel:

- `GA4_PROPERTY_ID`;
- `GOOGLE_SERVICE_ACCOUNT_JSON`;
- `SEARCH_CONSOLE_SITE_URL`.

Conceda à conta de serviço somente leitura na propriedade GA4 e no Search Console. Antes de ativar scripts que criem cookies, revise o consentimento/LGPD. Nunca exponha o JSON da conta de serviço no frontend.

## Validação por função

- **Redator:** cria rascunho próprio, envia, perde edição enquanto aguarda e volta a editar após ajustes.
- **Editor:** enxerga a fila, solicita ajustes, aprova e publica; não exclui notícia.
- **Administrador/Super Admin:** mesmas ações editoriais e acesso completo conforme RBAC.
- **Visualizador:** consulta audiência, sem ações de escrita.
- **Demais funções:** não acessam a fila nem os relatórios sem permissão explícita.

