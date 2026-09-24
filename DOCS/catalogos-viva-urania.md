# Catálogos do Viva Urânia — contrato 1

## Estado e implantação

Este módulo é administrativo. Nesta etapa não existe rota pública de catálogo, leitura pelo aplicativo, carrinho ou pedido. As migrations ficam locais até autorização expressa. Aplicar, nessa ordem, `20260924_viva_catalogos.sql` e `20260924_viva_catalogos_midias.sql` em um ambiente de homologação antes de produção. Uma conta administrativa com acesso ao Guia Comercial é necessária para testar o painel. A rota é `/admin/catalogos` e o atalho na edição da empresa abre `/admin/catalogos?empresa=<uuid>`.

## Modelo relacional

| Tabela | Finalidade | Pai |
| --- | --- | --- |
| `catalogos` | Nome, empresa, status, origem, revisão, datas de revisão/sincronização | `guia_comercial` |
| `catalogo_categorias` | Agrupamento, ordem, ativo | catálogo |
| `catalogo_produtos` | Conteúdo, preço em centavos, status, disponibilidade, SKU, observações | categoria e catálogo |
| `catalogo_produto_imagens` | Primeira imagem principal, demais galeria | produto e catálogo |
| `catalogo_variantes` | Combinação genérica de atributos e preço absoluto | produto e catálogo |
| `catalogo_grupos_opcoes` | Mínimo/máximo e seleção única/múltipla | produto e catálogo |
| `catalogo_opcoes` | Adicional em centavos, disponibilidade, quantidade e eventual produto vinculado para combo | grupo e catálogo |

Cada produto herda a empresa do catálogo; não há coluna redundante de empresa no produto. IDs internos UUID são usados para FKs e poderão sustentar métricas futuras. Cada nó também tem `key` estável dentro do catálogo para importação, exportação e reconciliação. IDs externos opcionais ficam junto de `source`/origem. Índices únicos impedem repetição de `key` e de identificador externo no escopo correspondente; FK composta `(catalogo_id,id)` impede referências entre catálogos. Produtos usam índice de busca textual em português.

Catálogo aceita `rascunho`, `ativo`, `inativo`, `em_revisao` e `desatualizado`. `source` aceita `manual`, `json` e `externa`. Produto usa status `ativo`/`inativo` e disponibilidade `disponivel`/`indisponivel`; regras por horário são uma fase futura. `last_reviewed_at` e `last_synced_at` permitem indicar a idade dos dados. A arquitetura conserva os dados de origem, sem deixar o fornecedor externo definir o formato consumido pelo Viva.

Preços são inteiros em **centavos de BRL**: `price_cents=2990` significa R$ 29,90. `fixo` usa preço base; `a_partir` também usa preço base, apresentado como mínimo futuro; `variacoes` exige variantes, cada uma com preço absoluto. `promo_price_cents` precisa ser menor ou igual ao preço correspondente. O preço da opção é um **acréscimo**, não o preço total de outro produto. O produto referenciado numa opção prepara combos; somas e regras de checkout ainda não são calculadas.

As tabelas estão privadas por RLS, sem política para `anon`. Leitura exige permissão `guia_comercial:ler`. Escritas diretas por `authenticated` são revogadas; as RPCs verificam ações `criar`, `editar` e `excluir` e executam toda a alteração numa transação. A revisão numérica impede sobrescrever mudanças de outro administrador. O modelo não concede acesso ao futuro parceiro. Sua identidade e escopo por empresa terão política própria.

## JSON oficial

O documento tem `version: 1`, `catalog` e a árvore de categorias, produtos, imagens, variantes, grupos e opções. O exemplo completo e importável está em [catalogo-exemplo-v1.json](../modelos/catalogo-exemplo-v1.json). Os campos de cada objeto são fechados: campos desconhecidos produzem erro. `key`, `name` e `order` são obrigatórios em catálogo e em cada nó; outras propriedades obrigatórias estão refletidas no exemplo e validadas no painel e no servidor.

`key` pode ter até 120 caracteres ASCII, iniciando por letra ou número e continuando com letras, números, ponto, sublinhado, dois pontos ou hífen. Cada `key` deve ser única em toda a árvore de um catálogo. Para atualização, exporte o catálogo existente, conserve as `key` e importe no editor daquele mesmo catálogo. O UUID do banco não faz parte do arquivo, nem o ID da empresa: a empresa é escolhida no painel. `external_id` deve ser estável e representa o identificador do conector quando existir. Não se deve gerar uma `key` nova a cada sincronização.

`images` é uma lista de objetos `{url,alt}`; índice zero é a principal. URLs precisam ser HTTPS públicas. O upload e a biblioteca do CMS são reutilizados. A limpeza de mídia reconhece imagens de catálogos depois da segunda migration. O array de imagens tem no máximo 20 elementos por produto.

`variants[].attributes` é um mapa pequeno de 1 a 10 pares nome/valor, como `{ "Tamanho": "M", "Cor": "Preta" }`. Essa é a única estrutura sem colunas individuais: representa a combinação genérica, enquanto variantes e preços são linhas relacionais. Duas variantes do mesmo produto não podem ter combinação idêntica. `option_groups[].min` maior que zero implica escolha obrigatória; `max` limita a quantidade. `selection: "unica"` exige `max: 1`. Uma opção pode ter `product_key` apontando para outro produto do mesmo catálogo e `quantity`; referências circulares são rejeitadas.

Os limites atuais são 5 MB por documento, 200 categorias, 5.000 produtos por catálogo, 300 variantes, 40 grupos por produto e 100 opções por grupo. São limites operacionais da primeira versão; aumentar requer rever painel, RPC e validação juntos.

## Operações

Criar exige selecionar empresa existente. A lista mostra empresa, status, origem, quantidade de categorias/produtos, atualização e última sincronização; há busca e filtros. Edição manual tem dados gerais, categorias, produtos, galeria, variações e opções progressivas. A ordem numérica é persistida. Visualização respeita perfil somente leitura. Duplicar gera novas `key`, limpa IDs externos e inicia rascunho. Desativar troca o status; excluir requer confirmação e permissão.

**Importar JSON** aceita arquivo ou texto, valida antes de confirmar e mostra contagens. Num catálogo novo, cria apenas para a empresa escolhida; `key`/identificador externo duplicado gera erro. Num catálogo existente, a `key` raiz precisa corresponder àquela já aberta. A importação no editor substitui o rascunho local; o botão Salvar envia um *snapshot* integral à RPC, que preserva UUIDs das `key` iguais, atualiza valores, cria novos itens e remove ausentes. Remoções existentes exigem `excluir`. Um erro ou revisão desatualizada cancela a transação inteira. Não há sincronização automática de conectores nesta etapa.

**Exportar JSON** gera exatamente a versão 1 e pode ser reimportada. Para backup consistente, primeiro salve as mudanças: exportar antes do salvamento baixa o rascunho em edição. Timestamps `created_at` e `updated_at` ficam no banco, fora do contrato de transporte.

## Testes e próximos passos

`npm run test:catalogos` testa o contrato e os cenários restaurante, floricultura e loja. `npm run test:catalogos:database` executa migrations, operações, políticas e reversão de erro num PostgreSQL WASM local. `npm run test:catalogos:browser` percorre o editor em Edge headless com banco isolado, incluindo criação, preço, importação, exportação, mídia, visualização e tamanho móvel. Para os dois últimos, instale apenas no diretório local de teste: `npm install --prefix outputs/catalogos-tools --no-save --package-lock=false @electric-sql/pglite playwright`. O teste de navegador usa o Edge instalado na máquina. Essas dependências não fazem parte da aplicação.

Ficam para fases futuras: catálogo público e leitura do aplicativo, disponibilidades por horário, fluxo de moderação do parceiro, mapeamento de integrações externas, atualização incremental/automática, carrinho, pedido, confirmação via estabelecimento, checkout sem processamento pelo Viva e métricas. Antes da exibição pública, será preciso decidir quais status podem aparecer e como sinalizar valores e disponibilidade sujeitos à confirmação do estabelecimento.
