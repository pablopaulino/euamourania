# Viva Urânia — diagnóstico de produto e benchmark de mercado

**Data:** 3 de setembro de 2026
**Público:** produto e operação do Viva Urânia
**Objetivo:** identificar o que o app já entrega, onde se diferencia e quais evoluções têm maior potencial de recorrência e alcance entre usuários comuns.

## Resposta executiva

O Viva Urânia já ultrapassa o modelo de “guia de empresas”: reúne descoberta local, turismo, agenda, notícias, serviços úteis, motoristas, iniciativas comunitárias, votação local, favoritos, notificações e uma camada inicial de IA/roteiros. Seu principal diferencial é a **curadoria editorial e verificável de uma única cidade**, algo que Google Maps, redes sociais e marketplaces não fazem com a mesma identidade local.

O próximo ganho não é criar muitos módulos. É transformar o conteúdo existente em três hábitos recorrentes:

1. **Abrir hoje:** saber o que está acontecendo, aberto ou útil agora.
2. **Planejar:** salvar, receber lembrete, abrir rota e compartilhar uma programação.
3. **Participar:** indicar algo, corrigir informação, acompanhar uma campanha ou iniciativa — sempre com revisão editorial.

## Escopo e método

O inventário foi extraído do app Expo/React Native atual, em especial das rotas, Home, busca, analytics, notificações e Guia Inteligente. O benchmark compara padrões de produto documentados por Google Maps, Eventbrite, Colab, Viaje Paraná+ e Android Developers. Não foram usados dados de audiência, retenção, receita ou pesquisas com usuários, pois não foram disponibilizados; portanto, prioridades de impacto são hipóteses de produto a serem validadas por métricas e entrevistas curtas.

## Inventário atual do Viva Urânia

| Pilar | O que já existe | Observação de maturidade |
| --- | --- | --- |
| Home contextual | saudação, clima, busca, parceiros, descoberta do dia, turismo, motoristas, eventos, categorias, notícias, telefones e favoritos recentes | Muito forte como porta de entrada; risco de ficar longa se todos os blocos crescerem. |
| Guia Comercial | busca, categorias, parceiros/destaques com rodízio, horário, contatos, rota, redes, favoritos e chamada comercial | Diferencial importante para empresas e moradores. |
| Turismo | lista, busca, detalhes editoriais, localização, rota, contatos, favoritos e lugares relacionados | Base excelente para roteiro e descoberta. |
| Eventos | próximos/em andamento, histórico, eventos recorrentes, edições, programação, local e rota | Mais completo do que uma agenda simples. |
| Notícias | feed, categorias, página de matéria, relacionadas e compartilhamento | Bom motor editorial, ainda pouco conectado a hábitos de retorno. |
| Serviços locais | telefones úteis, chamada/WhatsApp/rota; motoristas com busca e CTA para WhatsApp | Resolve tarefas reais rapidamente. |
| Comunidade | iniciativas, ações vinculadas, contatos, formas de ajuda e sugestões moderadas | Diferencial de identidade; depende de conteúdo ativo. |
| Participação | indicar empresa, enviar evento e sugerir iniciativa; correção de informação em detalhes | Boa base de contribuição com revisão. |
| Engajamento | favoritos, login, notificações, compartilhamento, haptics e tema claro/escuro | Favoritos são apresentados como salvos no aparelho; não há coleções/alertas temáticos visíveis no app. |
| Guia Inteligente | conversa, busca determinística/IA, cards reais, roteiros e salvar roteiro com login | Promissor, mas precisa ser confiável antes de ser o principal argumento de aquisição. |
| Reconhecimento local | Melhores de Urânia, votação e vencedores | Ativo sazonal de alto potencial para aquisição e compartilhamento. |
| Dados e operação | Supabase, analytics próprios de tela/clique/impressão, RLS, painel editorial e notificações | Boa fundação para decisão orientada a dados. |

## Onde o Viva está à frente

### 1. Curadoria de uma cidade, e não só busca genérica

Google Maps é muito forte em busca por proximidade, filtros e dados de Places, inclusive “aberto agora”, avaliações e atributos. Mas ele é horizontal. O Viva combina empresas, programação, história, notícias e instituições de Urânia em uma experiência editorial própria. Isso é mais próximo de um **guia vivo da cidade** do que de um mapa.

### 2. Agenda com memória

O app trata eventos concluídos como histórico e já diferencia edições de eventos grandes. Esse detalhe é raro em guias locais pequenos: preserva cultura da cidade e melhora o valor da agenda ao longo do tempo. Plataformas como Eventbrite também tratam recorrência e múltiplas datas como casos próprios, validando a direção de manter edições e programação estruturadas.

### 3. Serviços práticos na mesma experiência

Telefones úteis, motoristas e links de WhatsApp/rota convertem intenção em ação sem exigir que o usuário procure fora do app. Para uma cidade pequena, isso pode valer mais do que recursos sofisticados de marketplace.

### 4. Comunidade com moderação

O Viva tem uma direção mais segura que uma rede social aberta: iniciativa, Pix informado e sugestão passam por administração. O Colab mostra que participação cívica pode gerar engajamento, mas também exige fluxo de acompanhamento, moderação e capacidade real de resposta. O modelo editorial do Viva é adequado para o estágio atual.

## O que falta — por ordem de valor provável

### Prioridade 1 — “Meu Viva”: preferências e notificações úteis

**Lacuna:** o app possui permissão de notificação e navegação por deep link, mas não há preferências temáticas aparentes nem um centro de alertas/atividades para o usuário controlar o que recebe.

**Proposta enxuta:** criar “Meu Viva” dentro de Perfil/Configurações, com escolhas simples:

- eventos e agenda;
- notícias importantes;
- promoções de parceiros;
- iniciativas da comunidade;
- Prêmio Melhores de Urânia.

Adicionar uma caixa de entrada de notificações no app, com itens lidos/não lidos e destino profundo. Não enviar marketing por padrão: pedir opt-in separado para promoções.

**Por que agora:** Eventbrite combina descoberta, favoritos, compartilhamento e calendário; seu material também ilustra notificações contextualizadas por interesse. O ganho aqui é transformar conteúdo que já existe em retorno semanal, sem exigir grande criação de dados.

**Métrica de sucesso:** permissão concedida, taxa de abertura por tema, retenção de 7/28 dias e descadastros por categoria.

### Prioridade 2 — Agenda realmente acionável

**Lacuna:** há eventos excelentes, mas não há evidência de “lembrar-me”, salvar evento, adicionar ao calendário do celular ou agenda semanal/mensal.

**Proposta:**

- botão “Lembrar deste evento”;
- adicionar ao calendário do aparelho (arquivo/integração de calendário, sem venda de ingresso);
- lembrete configurável: dia anterior e/ou duas horas antes;
- visualização “Hoje / esta semana / calendário”;
- filtro por família de evento, quando o volume justificar.

**Por que agora:** é uma utilidade comprovada em apps de eventos e conecta diretamente com notificações. O Eventbrite oferece like, compartilhamento e adição a calendário/Wallet; o Viva pode oferecer a parte que importa ao município sem virar plataforma de ingressos.

**Métrica:** eventos salvos, lembretes disparados/abertos, rotas abertas e compartilhamentos.

### Prioridade 3 — Coleções compartilháveis, não apenas favoritos

**Lacuna:** favoritos existem, mas são apresentados como locais ao aparelho e não há listas com propósito.

**Proposta:** manter favoritos simples e, para usuários logados, permitir 3 coleções iniciais:

- “Quero conhecer”;
- “Fim de semana em Urânia”;
- “Comer em Urânia”.

Permitir adicionar nota curta e compartilhar uma URL pública. Não criar seguidores, feed ou comentários.

**Por que agora:** o Google Maps mantém listas como um mecanismo central de descoberta e compartilhamento. Listas são sociais sem trazer o custo de moderação de uma rede social.

**Métrica:** coleções criadas, itens por coleção, compartilhamentos e retorno por link compartilhado.

### Prioridade 4 — Mapa de descoberta, com consentimento de localização

**Lacuna:** cada detalhe abre rota, mas não há uma visão de descoberta no mapa reunindo turismo, eventos e serviços próximos.

**Proposta:** uma tela opcional “Perto de você”, inicialmente com Turismo, Eventos hoje e Telefones úteis. Pedir localização apenas ao abrir a tela; oferecer Urânia como padrão sem permissão. Mostrar distância, horário e rota. Comércio pode entrar depois, quando qualidade de coordenadas estiver consistente.

**Por que agora:** Google Maps e o Viaje Paraná+ usam localização, rotas temáticas e calendário como parte da descoberta. O Viva tem um trunfo: pode filtrar o excesso e mostrar apenas conteúdo curado.

**Métrica:** permissão concedida, rota aberta, clique por distância e retorno à tela.

### Prioridade 5 — Qualidade e atualidade dos dados

**Lacuna:** horários, telefones e endereços desatualizados destroem confiança mais rapidamente do que a falta de recursos. Já existe “corrigir informação”, mas falta fechar o ciclo percebido pelo usuário.

**Proposta:**

- exibir “informação revisada em …” nos perfis relevantes;
- marcar para revisão itens sem atualização há 90/180 dias;
- após uma correção, mostrar ao autor “recebemos sua sugestão” e, se aprovado, “informação atualizada”;
- painel administrativo com fila, responsável e prazo de revisão.

**Por que agora:** atributos e horários são a base da descoberta de locais. A documentação do Google Places trata horário atual, períodos especiais e exceções como dados próprios; isso mostra o quanto o tema é estrutural, não decorativo.

**Métrica:** idade média dos dados, correções recebidas/aprovadas, erros de link e contatos sem sucesso.

### Prioridade 6 — Guia Inteligente confiável antes de “mais IA”

**Lacuna:** a fundação já existe, mas o histórico recente mostra respostas inconsistentes em algumas intenções. Um chatbot que erra telefones, horários ou eventos reduz confiança.

**Proposta:** investir em cobertura determinística e observabilidade antes de ampliar linguagem:

- testes por intenção: empresa, categoria, telefone, turismo, evento, iniciativa, aberto agora e amanhã;
- respostas com fonte/data (“dados cadastrados em…”);
- registrar intenção não resolvida e clique em sugestão;
- IA apenas para explicar, comparar e montar o texto a partir de registros reais;
- botão de feedback “isso ajudou?” em respostas relevantes.

**Métrica:** taxa de resposta com cards válidos, zero resultado por intenção, abandono após resposta, avaliação útil e erro por fluxo.

### Prioridade 7 — Widget de Android, depois de estabilizar os hábitos

**Proposta:** um único widget “Hoje em Urânia” com clima, próximo evento e um CTA rotativo para agenda/notícia/telefone útil. Nada de widget cheio de ações.

**Por que não agora:** widgets funcionam como uma prévia acionável e podem atualizar conteúdo, mas exigem uma rotina de conteúdo confiável. Android recomenda escolher um caso primário e testar tamanhos/form factors.

**Métrica:** instalações do widget, cliques e abertura do app atribuída ao widget.

## O que não recomendo agora

| Ideia | Motivo para adiar |
| --- | --- |
| Avaliações abertas de empresas | custo alto de moderação, conflitos locais e competição direta com Google Maps. |
| Rede social, feed ou seguidores | baixa relação custo/benefício no estágio atual; coleções compartilháveis entregam valor semelhante com muito menos risco. |
| Compra de ingressos/pagamentos | suporte, reembolso, fiscal, antifraude e operação mudariam o negócio. O app pode encaminhar para o organizador. |
| Disponibilidade em tempo real de motoristas | cria expectativa operacional semelhante a um app de corrida. Manter contato/WhatsApp é correto. |
| Chatbot genérico sem fontes locais | aumenta custo e chance de alucinação; não é um diferencial sustentável. |
| Portal/app de parceiro agora | a experiência do morador e a qualidade do conteúdo têm retorno maior no estágio atual. |

## Proposta de sequência: próximos 12 meses

### Ciclo 1 — confiança e retorno (4–8 semanas)

1. Preferências de notificação + caixa de entrada.
2. Salvar/lembrar/adicionar eventos ao calendário.
3. Métricas de funil: abertura, busca, detalhe, rota, WhatsApp, favorito, evento salvo.
4. Fila de revisão de informações e indicador de atualização.

### Ciclo 2 — descoberta pessoal (6–10 semanas)

1. Coleções sincronizadas e compartilháveis.
2. “Perto de você” com localização opcional.
3. Página “Hoje em Urânia” mais explícita na Home: agenda + aberto agora + sugestão editorial.
4. Melhorias determinísticas do Guia Inteligente, guiadas por logs reais.

### Ciclo 3 — alcance orgânico (contínuo)

1. Links públicos excelentes para empresa, evento, notícia, turismo e iniciativa.
2. Cartões de compartilhamento consistentes para WhatsApp e Instagram.
3. Campanhas sazonais: Melhores, festa do peão, festival gastronômico, Natal e férias.
4. Widget “Hoje em Urânia”, somente após o Ciclo 1 provar uso recorrente.

## Indicadores que precisam entrar no painel de produto

Sem estes indicadores, o time estará decidindo por impressão visual:

- usuários ativos diário, semanal e mensal;
- retenção D1, D7 e D28 por coorte;
- origem da instalação e do primeiro acesso;
- percentual que concede notificação e abertura por tema;
- busca sem resultado e termos mais buscados;
- funil empresa: impressão → detalhe → WhatsApp/rota/site;
- funil evento: impressão → detalhe → salvar → lembrete aberto → rota;
- favoritos/coleções por usuário;
- conteúdo sem atualização há mais de 90 dias;
- intenção do Guia Inteligente, resposta válida e abandono.

Os eventos analíticos existentes já cobrem parte relevante do funil (visualizações, favoritos, busca, notificação, cliques e Guia). O próximo passo é consolidá-los num painel com métricas de retenção e conversão, não criar rastreamento invasivo.

## Decisão recomendada

Para aumentar retorno e alcance, a prioridade recomendada é:

1. **Agenda salvável + lembretes.**
2. **Preferências e central de notificações.**
3. **Dados locais sempre atualizados.**
4. **Coleções compartilháveis.**
5. **Mapa “Perto de você”.**
6. **Guia Inteligente confiável.**
7. **Widget Android.**

Essa sequência fortalece o motivo para abrir o Viva toda semana sem diluir a proposta em recursos caros de operar.

## Fontes consultadas

- [Google Maps Help — Explore com favoritos locais e conteúdo adaptado a local/horário](https://support.google.com/maps/answer/10014587?hl=en)
- [Google Maps — listas para salvar e compartilhar lugares](https://blog.google/products-and-platforms/products/maps/google-maps-updates-summer-travel-2024/)
- [Google Places API — filtros por proximidade, horário e atributos](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Eventbrite — descoberta, favoritos, compartilhamento e calendário](https://www.eventbrite.com/help/en-us/articles/783059/)
- [Eventbrite — eventos recorrentes e múltiplas datas](https://www.eventbrite.com/help/en-us/articles/692566/create-a-recurring-or-timed-entry-event-in-eventbrites-new-recurring-event/)
- [Colab — serviços, reportes e participação cidadã](https://www.colab.com.br/sou-cidadao/)
- [Viaje Paraná+ — geolocalização, rotas temáticas, agenda e indicadores](https://www.planejamento.pr.gov.br/sites/default/arquivos_restritos/files/documento/2024-02/Mensagem%20ALEP%202023.pdf)
- [Android Developers — princípios e casos de uso para widgets](https://developer.android.com/design/ui/mobile/guides/widgets)
