# Melhores de Urânia

O módulo **Melhores de Urânia** cria a base profissional para premiações anuais por votação popular dentro do portal Eu Amo Urânia.

Esta documentação cobre a **Fase 1**: banco, estrutura administrativa inicial, auditoria, permissões, edições, categorias e indicados.

## Antes de executar a migração

Arquivo da migração:

`supabase/migrations/20260712_melhores_urania_fase1.sql`

Execute o SQL no Supabase somente depois de revisar este documento.

A migração não altera tabelas públicas existentes do portal, como notícias, turismo, guia comercial, newsletter ou publicidade. Ela apenas:

- adiciona permissões do novo módulo em `admin_permissoes_funcao`;
- cria tabelas novas com prefixo `melhores_`;
- cria índices, constraints, RLS, auditoria e funções de retenção;
- agenda a limpeza automática de votos se `pg_cron` estiver disponível.

## Tabelas criadas

### `melhores_edicoes`

Representa cada edição anual, como 2026, 2027 e 2028.

Guarda:

- nome;
- ano;
- slug;
- descrição;
- regulamento;
- metodologia;
- imagem de capa;
- períodos de indicação e votação;
- status;
- pesos do site e Instagram;
- critério de desempate;
- controle de retenção dos votos individuais.

Constraints importantes:

- `ano` único;
- `slug` único;
- status limitado aos estados oficiais;
- períodos com início menor que fim;
- pesos entre 0 e 100;
- `peso_site + peso_instagram = 100`.

### `melhores_categorias`

Categorias da edição, como Melhor Restaurante, Melhor Loja, Personalidade do Ano.

Guarda:

- edição;
- nome;
- slug;
- imagem;
- ícone;
- ordem;
- status;
- limite de indicados;
- regras de indicação/voto;
- visibilidade pública.

Constraints importantes:

- slug único dentro da mesma edição;
- status controlado;
- limite de indicados positivo quando preenchido.

### `melhores_indicados`

Indicados/finalistas de uma categoria.

Guarda:

- edição;
- categoria;
- vínculo opcional com `guia_comercial`;
- nome;
- slug;
- imagem;
- descrição;
- redes sociais;
- contato;
- status;
- aprovação;
- consentimento/autorização.

Constraints importantes:

- categoria precisa pertencer à mesma edição;
- slug único dentro da categoria;
- nome único dentro da categoria;
- chaves compostas impedem relacionamento entre edições diferentes.

### `melhores_indicacoes`

Base para indicações públicas futuras.

Na Fase 1 a tabela existe, mas a página pública de indicação ainda não é implementada.

### `melhores_votos`

Base para votos individuais futuros.

Na Fase 1 a tabela existe para preparar segurança, auditoria e retenção. A votação pública será criada na Fase 2 por API/RPC segura.

O frontend público não terá permissão para gravar diretamente nessa tabela.

### `melhores_consolidados`

Guarda dados consolidados permanentes antes da limpeza dos votos individuais.

Exemplos:

- total por edição;
- total por categoria;
- total por indicado;
- votos válidos;
- votos suspeitos;
- votos bloqueados;
- percentuais.

### `melhores_resultados`

Representa apenas o resultado oficial publicado.

Importante: depois de publicado, é snapshot histórico. Não deve ser recalculado automaticamente.

### `melhores_auditoria`

Registra ações administrativas do módulo com:

- usuário;
- ação;
- entidade;
- entidade afetada;
- valores anteriores;
- valores posteriores;
- data.

## Índices principais

A migração cria índices para:

- buscar edição por status/ano;
- listar categorias por edição/ordem;
- listar indicados por edição/categoria;
- evitar nome duplicado dentro da categoria;
- auditar ações por edição e entidade;
- consultar votos por edição, categoria e indicado;
- impedir voto válido duplicado por identificador/categoria.

## RLS e permissões

Todas as tabelas novas usam RLS.

Administração:

- `super_admin`: acesso total por wildcard já existente;
- `administrador`: cria, edita, exclui e gerencia;
- `editor`: leitura;
- `comercial`: leitura;
- `visualizador`: leitura.

Leitura pública futura:

- edições/categorias/indicados só ficam visíveis publicamente quando o status da edição permitir;
- resultados só ficam públicos quando `publicado = true`;
- votos individuais nunca são públicos.

## Retenção dos votos individuais

Durante a votação:

- cada voto fica registrado individualmente em `melhores_votos`.

Após o encerramento/publicação:

- os votos individuais ficam disponíveis por 7 dias;
- a função `melhores_limpar_votos_expirados()` consolida os dados em `melhores_consolidados`;
- depois remove os registros individuais da edição;
- registra a limpeza em `melhores_auditoria`.

Se `pg_cron` estiver disponível no Supabase, a migração tenta agendar a rotina automaticamente todos os dias às 03:17.

Se `pg_cron` não estiver disponível, a função continua criada e poderá ser agendada depois pelo Supabase.

## Impacto esperado no banco

Impacto baixo na Fase 1:

- apenas novas tabelas e funções;
- nenhuma alteração destrutiva;
- nenhuma alteração de layout público;
- nenhuma dependência nova no site público;
- sem exposição de chaves secretas;
- sem gravação pública de votos ainda.

## Próximas fases

## Fase 2 — página pública e votação segura

A Fase 2 adiciona:

- página principal pública em `/melhores-de-urania/`;
- página por edição em `/melhores-de-urania/ANO/`;
- listagem pública de categorias;
- listagem pública de indicados aprovados;
- botão de voto;
- API segura `/api/melhores-votar`;
- proteção inicial contra duplicidade e abuso;
- inclusão das edições públicas no sitemap.

### Segurança da votação

O navegador não grava votos diretamente no Supabase.

O voto passa por:

`site público → /api/melhores-votar → Supabase com Service Role no backend`

A API valida:

- edição existe;
- status da edição é `votacao_aberta`;
- data/hora atual está dentro do período de votação;
- categoria pertence à edição;
- categoria está ativa e visível;
- indicado pertence à mesma edição e categoria;
- indicado está ativo e aprovado;
- visitante ainda não votou naquela categoria.

### Variáveis de ambiente

Obrigatórias no Vercel:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`.

Recomendada:

- `MELHORES_VOTO_SECRET`.

`MELHORES_VOTO_SECRET` é usada para gerar hashes técnicos dos votos. Ela não deve ficar no frontend.

Se ela não existir, a API usa a Service Role como fallback de segredo, mas o ideal é criar uma variável própria.

### Privacidade

A API não armazena IP bruto.

Ela usa:

- cookie técnico HttpOnly;
- hash de IP;
- hash de user agent;
- identificador técnico por edição/categoria.

Esses dados servem para auditoria e prevenção de fraude.

### Retenção

Os votos individuais seguem a regra da Fase 1:

- ficam disponíveis durante a votação;
- permanecem por 7 dias após o encerramento;
- depois são consolidados;
- os registros individuais são removidos.

## Próximas fases planejadas

Fase 3:

- lançamento manual dos votos do Instagram;
- apuração;
- cálculo ponderado;
- publicação de resultado.

## Fase 3 — Instagram, apuração e resultado oficial

A Fase 3 adiciona a parte administrativa de apuração:

- tabela `melhores_instagram_votos`;
- lançamento manual de votos do Instagram por indicado;
- comprovante/print opcional;
- data de coleta;
- observação interna;
- prévia de apuração ponderada;
- publicação do resultado oficial;
- página pública `/melhores-de-urania/ANO/resultados/`.

### Instagram manual

O sistema não depende da API do Instagram.

O administrador lança manualmente, por categoria e indicado:

- votos coletados;
- comprovante;
- observação;
- data da coleta.

O lançamento é único por:

`edição + categoria + indicado`

Se o mesmo indicado for lançado novamente, o registro é atualizado.

### Apuração

A apuração usa a view `melhores_apuracao_previa`.

O cálculo não soma votos brutos de bases diferentes.

Primeiro normaliza cada canal:

```text
percentual_site = votos_site_do_indicado / total_site_da_categoria
percentual_instagram = votos_instagram_do_indicado / total_instagram_da_categoria
```

Depois aplica os pesos da edição:

```text
pontuação_final =
  percentual_site × peso_site +
  percentual_instagram × peso_instagram
```

### Publicação do resultado

A função `melhores_publicar_resultado`:

- exige permissão administrativa;
- exige edição encerrada, em apuração ou já publicada;
- apaga snapshot anterior da edição;
- grava novo snapshot em `melhores_resultados`;
- marca vencedores e finalistas;
- registra auditoria;
- atualiza a edição como `resultado_publicado`;
- consolida os votos individuais.

Depois de publicado, `melhores_resultados` é o resultado oficial histórico.

Ele não é recalculado automaticamente.

Fase 4:

- SEO;
- analytics;
- sitemap;
- documentação final;
- polimento.

## Fase 4 — audiência, SEO e integração pública

A Fase 4 adiciona polimento e integração do módulo com o restante do portal:

- bloco discreto na home quando existir edição pública ativa ou resultado publicado;
- eventos de audiência específicos do Melhores de Urânia;
- breadcrumbs em dados estruturados nas páginas públicas;
- teste automatizado de integração;
- documentação operacional atualizada.

### Migração da Fase 4

Execute no Supabase:

`supabase/migrations/20260712_melhores_urania_fase4_audiencia.sql`

Ela libera novos tipos de evento em `analytics_eventos` e na RPC pública `registrar_evento_site`.

Para não quebrar eventos históricos já gravados, a constraint passa a aceitar tipos técnicos seguros no formato:

`letras_numeros_underline`

Tipos adicionados:

- `melhores_index_view`;
- `melhores_edition_view`;
- `melhores_results_view`;
- `melhores_vote_start`;
- `melhores_vote_complete`;
- `melhores_vote_error`;
- `melhores_cta_click`.

Esses eventos não armazenam IP, e-mail ou telefone. Eles servem para acompanhar abertura das páginas, cliques em chamadas, início de voto, voto concluído, erro de voto e visualização de resultados.

### SEO

As páginas públicas do Melhores de Urânia passam a declarar breadcrumbs em JSON-LD. As URLs amigáveis continuam:

- `/melhores-de-urania/`;
- `/melhores-de-urania/ANO/`;
- `/melhores-de-urania/ANO/resultados/`.

### Impacto

Baixo impacto:

- nenhuma tabela pública existente é alterada;
- nenhuma funcionalidade existente é removida;
- a home só exibe o bloco se houver edição pública;
- se o Supabase estiver indisponível, o bloco da home simplesmente não aparece;
- os eventos de audiência não bloqueiam navegação nem voto.

## Fase 5 — indicações públicas e moderação

A Fase 5 ativa a etapa de indicações públicas antes da votação.

Entregas:

- formulário público na página da edição;
- API segura `/api/melhores-indicar`;
- gravação em `melhores_indicacoes` com status `pendente`;
- validação de edição, período e categoria;
- aceite obrigatório do regulamento;
- proteção simples contra muitas indicações em sequência;
- aba **Indicações** no painel administrativo;
- ações de moderação:
  - aprovar;
  - rejeitar;
  - marcar como duplicada;
  - marcar como spam;
  - excluir;
  - converter em indicado rascunho.

### Fluxo

```text
visitante → formulário público → /api/melhores-indicar → melhores_indicacoes
admin → painel → moderação → indicado oficial em rascunho
```

### Regras públicas

O formulário só aparece como ativo quando:

- a edição está com status `indicacoes_abertas`;
- a data atual está entre `indicacoes_inicio` e `indicacoes_fim`;
- a categoria está ativa;
- a categoria está visível publicamente;
- a categoria permite indicação pública.

### Segurança

O navegador não grava diretamente em `melhores_indicacoes`.

A API usa `SUPABASE_SERVICE_ROLE_KEY` apenas no backend da Vercel e nunca expõe a chave ao visitante.

As indicações entram como `pendente` e precisam de revisão humana antes de virar indicado oficial.
