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

Fase 2:

- página pública;
- votação;
- API segura;
- antifraude.

Fase 3:

- lançamento manual dos votos do Instagram;
- apuração;
- cálculo ponderado;
- publicação de resultado.

Fase 4:

- SEO;
- analytics;
- sitemap;
- documentação final;
- polimento.
