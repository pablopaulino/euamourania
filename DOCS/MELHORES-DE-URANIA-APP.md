# Integração Melhores de Urânia com o app Viva Urânia

Este documento descreve a camada administrativa que permite publicar, revisar e encerrar a exibição temporária do **Melhores de Urânia** no aplicativo **Viva Urânia**, sem precisar lançar uma nova versão do app.

## Decisão técnica

As tabelas oficiais do prêmio continuam sendo a fonte de verdade:

- `melhores_edicoes`
- `melhores_categorias`
- `melhores_indicados`
- `melhores_resultados`

Mesmo assim, foi mantida uma camada mínima para o app:

- `app_melhores_campanhas`
- `app_melhores_vencedores`

Essa camada é necessária porque o app precisa controlar coisas que não pertencem ao resultado oficial do prêmio:

- período temporário de exibição na Home;
- texto do banner;
- botão e link oficial;
- ativar/desativar sem alterar a edição oficial;
- exibir/ocultar vencedores sem Guia Comercial;
- preservar snapshot de nome, imagem, descrição e contatos exibidos no app.

O snapshot evita que um vencedor desapareça se a empresa do Guia Comercial for alterada, arquivada ou removida depois da premiação.

## Migração

Arquivo:

`supabase/migrations/20260713_app_melhores_urania.sql`

Rollback:

`supabase/rollbacks/20260713_app_melhores_urania_rollback.sql`

Não execute automaticamente. Revise e aplique manualmente no SQL Editor do Supabase.

## Segurança e RLS

A migração garante que:

- o público só leia campanhas ativas, dentro do período e ligadas a edição com `resultado_publicado`;
- o público só leia vencedores ativos de campanhas públicas;
- vencedores avulsos só aparecem se a campanha permitir;
- admins precisam de permissões `melhores`;
- importação usa a RPC `app_melhores_importar_vencedores`;
- nenhum resultado rascunho ou não publicado é exposto ao app.

## Painel administrativo

No módulo **Melhores de Urânia**, foi adicionada a aba:

**Exibição no aplicativo**

Ela permite:

- criar campanha do app;
- vincular edição;
- configurar título, subtítulo, botão, link oficial, datas e ordem;
- controlar status;
- importar vencedores oficiais publicados;
- revisar inconsistências;
- cadastrar vencedor avulso;
- vincular vencedor ao Guia Comercial;
- arquivar vencedor da exibição mobile;
- ativar, agendar, desativar, encerrar ou arquivar campanha;
- visualizar preview textual do banner e do vencedor.

## Importação oficial

O botão **Importar vencedores da edição** usa somente:

- `melhores_resultados.publicado = true`;
- `melhores_resultados.vencedor = true`;
- `melhores_resultados.colocacao = 1`;
- edição com status `resultado_publicado`.

O processo copia snapshot mínimo para `app_melhores_vencedores` e mantém vínculos com:

- resultado oficial;
- categoria;
- indicado;
- empresa do Guia, quando existir.

## Vencedores sem Guia

Um vencedor pode ser exibido sem vínculo com `guia_comercial`.

Nesse caso, ele:

- aparece na página interna do prêmio no app;
- não cria empresa no Guia;
- não aparece como empresa do Guia;
- mantém nome, imagem, descrição e contatos próprios.

## Encerramento

A visibilidade não depende de cron.

O app e o banco validam:

- `ativo`;
- `status`;
- `exibir_inicio`;
- `exibir_fim`;
- edição oficial publicada.

Ao terminar o período, a campanha deixa de aparecer no app, mas os dados continuam salvos para histórico administrativo.

## Analytics

O painel documenta os eventos futuros necessários. O app ainda precisa enviar:

- `app_bestof_banner_view`
- `app_bestof_banner_click`
- `app_bestof_campaign_view`
- `app_bestof_winner_click`
- `app_bestof_whatsapp_click`
- `app_bestof_instagram_click`
- `app_bestof_official_result_click`

Até esses eventos existirem, o painel não inventa métricas.

## Como aplicar

1. Fazer backup do banco.
2. Executar `supabase/migrations/20260713_app_melhores_urania.sql` no SQL Editor.
3. Entrar no painel.
4. Abrir **Melhores de Urânia > Exibição no aplicativo**.
5. Criar campanha.
6. Vincular edição com resultado publicado.
7. Importar vencedores.
8. Revisar alertas.
9. Ativar ou agendar.

Nenhum novo build do app é necessário após a campanha estar ativa.
