# Divulgação gradual — Melhores de Urânia 2026

A apuração aprovada permanece guardada em `melhores_resultados`, sem publicação direta. A migração `20261117195140_melhores_revelacao_por_categoria.sql` registra os 21 horários no esquema privado e cria a vitrine do Viva Urânia. Não execute de novo após aplicá-la: ela pressupõe uma única edição em apuração, uma apuração preparada, nenhum resultado publicado e nenhuma campanha de aplicativo para a edição.

A migração `20261117201711_melhores_revelacao_funcoes_privadas.sql` mantém as funções de verificação de horário fora do esquema público da API.

As categorias são liberadas de 23 a 29/11/2026 às 10h, 15h e 20h de Brasília. A consulta pública expõe somente o vencedor da categoria cujo horário já passou; votos e colocações completas permanecem ocultos até o fechamento final. As políticas da vitrine do app limitam a leitura ao mesmo conjunto de vencedores. O app existente usa cache de dez minutos e não garante atualização automática de uma tela aberta; pode ser necessário reabrir a tela ou o aplicativo.

A tarefa `melhores-publicacao-agendada`, já existente, conclui o snapshot oficial após o último horário, em 29/11/2026 às 20h de Brasília. A apuração e a vitrine ficam bloqueadas para edição até lá. Antes do primeiro anúncio, o cancelamento no painel remove o cronograma e a cópia preparada; depois do primeiro, o cancelamento é bloqueado para preservar os resultados já anunciados. A campanha do app fica configurada até 30/11/2027.

A página de resultados consulta o banco sem cache e atualiza a cada 30 segundos enquanto estiver aberta. A publicação pelo Instagram é independente; não existe verificação automática do estado do Instagram.

Desde 23/11, a versão instalada do Viva Urânia pode abrir a lista nativa de vencedores durante a divulgação gradual. Na consulta da campanha feita pelo aplicativo, a API apresenta a etapa de resultado e a data da categoria mais recente já anunciada. A Home usa essa data para mostrar o destaque no dia do anúncio. A lista inclui somente as categorias liberadas, inclusive para quem entra no aplicativo com uma conta administrativa. O painel conserva o status oficial “Em apuração” até a conclusão agendada.

## Verificação local

`scripts/test-melhores-revelacao.mjs` usa dados fictícios e PGlite. Instale `@electric-sql/pglite` em ambiente de testes ou forneça o módulo pela variável `PGLITE_MODULE`. O teste cobre os 21 horários, transação revertida se uma categoria não corresponder, sigilo, acesso do app, cancelamento e conclusão final. Não utiliza dados de produção.
