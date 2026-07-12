# Auditoria do painel: métricas e estatísticas

## Origem oficial dos dados

- **Cards de conteúdo do dashboard:** tabelas principais do Supabase (`noticias`, `guia_comercial`, `eventos`, `categorias`, `turismo`, `links` e `campanhas_publicitarias`).
- **Páginas mais acessadas:** eventos próprios em `analytics_eventos`, tipo `page_view`.
- **Notícias lidas / notícias mais acessadas:** eventos próprios em `analytics_eventos`, tipo `noticia_view`.
- **Empresas mais acessadas:** eventos próprios em `analytics_eventos`, tipo `guia_view`, complementados por cliques quando usados na Central de Audiência.
- **Turismo e eventos mais acessados:** eventos próprios em `analytics_eventos`, tipos `turismo_view` e `evento_view`.
- **Cliques em WhatsApp, Instagram, links externos e buscas:** eventos próprios em `analytics_eventos`.
- **Campanhas publicitárias:** visão `publicidade_resumo` e eventos de publicidade.
- **Google Analytics 4 e Search Console:** dados complementares, exibidos separadamente na Central de Audiência. Eles não substituem as métricas próprias do portal.

## Problema encontrado

A listagem de **Páginas mais acessadas** usava eventos recentes da tabela `analytics_eventos`, mas a tela antiga de **Estatísticas** buscava **Notícias mais acessadas** e **Empresas mais acessadas** pelo contador acumulado `visualizacoes` das tabelas de conteúdo.

Isso criava uma mistura de fontes:

- páginas refletiam o período recente;
- notícias e empresas refletiam contador acumulado;
- ao editar, recarregar ou filtrar, os blocos podiam parecer desatualizados.

Também havia uma condição de corrida no site público: o módulo de audiência é carregado de forma adiada para melhorar performance. Em notícias individuais, a página podia disparar o evento `noticia:renderizada` antes de o módulo de audiência estar pronto. Nessa situação, o `page_view` era registrado, mas o `noticia_view` podia não ser registrado.

## Correções aplicadas

- A notícia individual agora registra `noticia_view` mesmo quando o módulo de audiência entra depois da renderização.
- Cards públicos de guia, turismo e eventos passam a ser observados também quando o módulo de audiência já encontra os cards na página.
- A tela antiga de **Estatísticas** passou a usar eventos do mesmo período para rankings de notícias e empresas, em vez do contador acumulado.
- A Central de Audiência soma visualizações e cliques por conteúdo sem duplicar o mesmo item no ranking.

## Critério de conferência

Para validar se está correto:

1. Acesse uma notícia publicada pelo navegador.
2. Aguarde alguns segundos.
3. No painel, abra **Audiência**.
4. Verifique:
   - `Visualizações` aumenta por `page_view`;
   - `Notícias lidas` aumenta por `noticia_view`;
   - a notícia aparece em **Conteúdos mais acessados** dentro do período escolhido.

Os dados próprios podem levar alguns segundos para aparecer, mas não dependem do Google Analytics.

