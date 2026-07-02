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
4. Escolha o formato do anúncio e, se desejar, cadastre um criativo específico para celular.
5. Escolha período, status, prioridade e posições.
6. Para pop-up, configure frequência, atraso e botão de fechar.
7. Confira a prévia para desktop e celular e salve como rascunho ou ative.

Campanhas ativas só aparecem dentro do período configurado. Quando não existe campanha para uma posição, o site não cria espaço vazio.

## Formatos e criativos

Cada campanha pode usar um dos formatos:

- **Automático**: adapta o criativo ao espaço disponível.
- **Super banner (970 × 250)**: indicado para topo e rodapé.
- **Horizontal (728 × 90)**: indicado entre listagens e seções.
- **Retângulo (336 × 280)**: indicado no meio de conteúdos.
- **Quadrado (1:1)**: indicado entre cartões.
- **Vertical (300 × 600)**: preparado para espaços laterais.
- **Nativo**: combina imagem, título, texto e botão com uma apresentação editorial identificada como publicidade.

O criativo principal continua sendo usado no desktop. O campo **Imagem para celular** é opcional e permite uma arte mais legível em telas pequenas; na ausência dela, o site adapta a imagem principal. Título público e texto público são opcionais e aparecem principalmente no formato nativo.

As escolhas são armazenadas em `configuracao_futura`, portanto esta melhoria não exige uma nova migração SQL e continua compatível com campanhas antigas.

## Posições públicas

O painel informa o formato recomendado ao lado de cada posição. As posições “entre” agora são inseridas de fato dentro do conteúdo:

- notícias: após o quarto cartão;
- guia comercial: após o sexto estabelecimento;
- turismo: após o terceiro cartão;
- eventos: após o terceiro evento;
- notícia individual: aproximadamente no meio do texto.

Topo, final e rodapé continuam disponíveis em cada área. Uma campanha marcada para **Todas as páginas** aparece uma única vez por página, e a mesma campanha não é repetida em vários espaços da mesma visita.

Quando houver mais de uma campanha elegível no mesmo espaço, o site cria uma rotação discreta, com navegação manual e intervalo configurável entre 5 e 30 segundos. A rotação pausa durante interação e respeita a preferência de movimento reduzido do visitante.

## Métricas

Impressões e cliques são registrados por uma função segura do banco. Uma impressão só é contabilizada quando o anúncio fica realmente visível na tela. O dashboard apresenta campanhas ativas, agendadas e encerradas, total de impressões, cliques, CTR, evolução diária e ocupação das posições.

## Segurança

- O navegador continua usando somente a Project URL e a Publishable Key.
- Criação, edição, exclusão, upload e leitura administrativa dependem de `usuarios_admin`.
- Visitantes só conseguem ler campanhas ativas e dentro do período.
- Uploads aceitam imagens, GIF, MP4 e WebM até 15 MB.

## Preparação futura

A estrutura já separa anunciantes, campanhas, posições e métricas diárias. O campo `configuracao_futura` permite evoluir para horários, limites, recorrência, cobrança e painel do anunciante sem alterar os registros atuais.
