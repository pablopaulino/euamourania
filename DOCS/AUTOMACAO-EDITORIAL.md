# Automação editorial

Em **Notícias → Automação editorial**, cada execução registra até cinco pautas dos últimos sete dias. Com um rascunho habilitado, a vaga é de Urânia. Com dois, a segunda vaga é para um fato regional ou nacional com impacto para moradores. Uma vaga pode ficar vazia quando falta confirmação. Cada rascunho entra na lista de Notícias para revisão humana.

## Banco e configuração

No SQL Editor do Supabase, aplique os arquivos que ainda faltam, na ordem abaixo. Quando as duas primeiras migrações já estiverem instaladas, execute apenas a terceira.

1. `supabase/migrations/20261109_automacao_editorial_base.sql`
2. `supabase/migrations/20261110_automacao_editorial_execucao.sql`
3. `supabase/migrations/20261121181239_automacao_editorial_v2.sql`

A terceira migração preserva os rascunhos e classifica como oficiais os cadastros municipais reconhecidos anteriormente. Os demais cadastros começam como Portal. Para conferir após a aplicação:

```sql
select nome, confiabilidade, escopo, ativa from public.editorial_fontes order by nome;
select ativa, limite_pautas, limite_materias from public.editorial_configuracao where id=1;
```

No Google AI Studio, confira o projeto da chave, o acesso ao modelo escolhido, a faixa Free e a ausência de faturamento vinculado. Na Vercel, configure no ambiente correspondente:

| Variável | Valor ou finalidade |
| --- | --- |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` no Preview, com descoberta por sites e RSS |
| `GEMINI_API_KEY` | Chave do projeto gratuito, somente no servidor |
| `GEMINI_FREE_TIER_CONFIRMED` | `true` após conferir o faturamento do projeto da chave |
| `SUPABASE_URL` | URL do banco correspondente ao ambiente |
| `SUPABASE_PUBLISHABLE_KEY` | Verificação da permissão de quem executa manualmente |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial exclusiva do servidor |
| `CRON_SECRET` | Segredo usado pela Vercel no agendamento de produção |

A trava depende da conferência do projeto da chave pelo administrador. Com o modelo 3.5, a execução usa apenas sites/RSS para descoberta e até duas chamadas de redação. As cotas efetivas podem limitar a disponibilidade. A busca integrada do 3.5 exige plano pago e fica desabilitada. [Preços do Gemini](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite)

## Descoberta e revisão

A rotina consulta até 20 fontes cadastradas em paralelo. Só o modo legado 2.5, para projetos com acesso, também usa pesquisa do Gemini. Da pesquisa entram apenas referências presentes em `groundingMetadata.groundingChunks[].web.uri`. O leitor consulta até 30 URLs, com cinco segundos por recurso, respeita robots.txt e valida o destino das referências do Google. Para o RSS, a data do item complementa a página quando ela não informa uma data válida.

A triagem compara título e URL com o acervo publicado e com as pautas dos últimos sete dias. Um comunicado de domínio cadastrado e marcado como Oficial pode gerar rascunho sozinho, com atribuição e revisão reforçada. Uma pauta de portal exige páginas sobre o mesmo fato em dois domínios distintos. A classificação geográfica considera o título e o texto lido. O editor confirma a abrangência e o impacto local antes de publicar.

O painel mostra as fontes de cada pauta, seu escopo e o motivo da seleção ou descarte. O texto, a categoria e os campos de SEO passam por validação antes da gravação. As referências do rascunho usam os links das páginas consultadas. A legenda e o prompt ficam disponíveis para copiar. A seleção da imagem, a conferência de direitos e a publicação cabem ao editor.

## Conferência no Preview e em produção

1. No Hobby, confira **Settings → Functions → Fluid Compute**. A função `api/admin-users.js`, que atende a rota editorial, tem duração de 120 segundos e orçamento de trabalho de 100 segundos contado desde a entrada no handler. A margem permite registrar um encerramento parcial. [Duração das funções Vercel](https://vercel.com/docs/functions/configuring-functions/duration)
2. Faça o deploy de Preview com o código, as variáveis e o banco pretendidos. O botão **Executar agora** grava rascunhos nesse banco mesmo com o cron pausado.
3. Cadastre ou edite uma fonte oficial de Urânia e uma regional. Confira os endereços antes de marcar Oficial, ative as fontes, escolha dois rascunhos e salve.
4. Clique em **Executar agora**. Confira as últimas pautas, os links, as datas e os campos de imagem. Abra o rascunho pelo título em **Notícias**, revise a matéria e confira que está sem imagem anexada e sem data de publicação. Edite um título e verifique em nova execução que a edição foi preservada.
5. Em produção, confira as variáveis desse ambiente e repita a execução manual antes de ativar o cron. Ao ativá-lo, confira o histórico após a janela das 9h de São Paulo (12h UTC). O intervalo configurado controla em quais dias a rotina executa.

O banco impede execuções simultâneas e recupera um lock abandonado após cinco minutos. Uma limitação temporária do Gemini impõe cinco minutos de espera. Uma cota explicitamente diária impõe até 24 horas. O histórico registra falha ou execução parcial, preservando os rascunhos já gravados.

## Testes locais

```sh
node --test tests/editorial*.test.js
node scripts/test-automacao-editorial-db.mjs
```

A suíte de aplicação usa provedores simulados. A suíte de banco aplica as três migrações em PostgreSQL isolado com PGlite e verifica permissões, gravação e preservação das edições humanas. O checklist de Preview exercita a chave, as cotas, as fontes e a hospedagem reais.
