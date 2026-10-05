# Melhores de Urânia

O módulo **Melhores de Urânia** gerencia a premiação anual criada pelo Eu Amo Urânia.

## Conceito

A premiação reconhece empresas, profissionais, projetos e pessoas que contribuem com a cidade.

Usar sempre:

- correto: **indicados**;
- evitar: “finalistas”.

## Estrutura

- edição;
- categorias;
- indicados;
- indicações públicas;
- votação;
- auditoria;
- apuração;
- resultados;
- páginas públicas;
- estatísticas internas.

## Edição

Uma edição representa um ano.

Campos importantes:

- ano;
- slug;
- status;
- datas de indicação;
- datas de votação;
- regulamento;
- metodologia;
- resultado publicado;
- textos editáveis;
- SEO.

Não deve existir edição duplicada para o mesmo ano.

## Categorias

Cada categoria pertence a uma edição.

Regras:

- slug único dentro da edição;
- ordem configurável;
- visibilidade pública;
- limite de indicados quando aplicável.

## Indicados

Cada indicado pertence a uma categoria da mesma edição.

Regras:

- não duplicar indicado na mesma categoria;
- pode ter vínculo opcional com empresa do Guia;
- imagem pode vir da biblioteca;
- status controla visibilidade.

## Votação

Esta é a camada pública da Fase 2: as páginas da edição leem dados publicados,
enquanto o voto é enviado à API segura. O segredo `MELHORES_VOTO_SECRET` fica
somente no backend; votos individuais não são expostos na leitura pública.

Obrigatório:

- Cloudflare Turnstile;
- `MELHORES_VOTO_SECRET`;
- rate limit;
- sanitização centralizada;
- auditoria.

## Retenção de votos

Durante a votação:

- manter voto individual.

Após encerramento:

- manter votos individuais por 7 dias;
- permitir auditoria;
- consolidar dados;
- remover votos individuais;
- preservar estatísticas oficiais.

## RLS e permissões

As tabelas do prêmio usam RLS. A leitura e as alterações administrativas são
controladas por `tem_permissao_admin('melhores', ação)`, conforme a ação exigida
pela policy (`ler`, `criar`, `editar` ou `excluir`). As regras de leitura pública
ficam limitadas aos dados e estados explicitamente publicados pelas policies.

A função `melhores_limpar_votos_expirados()` não concede `EXECUTE` ao frontend
autenticado; a limpeza ocorre pela rotina de retenção configurada no backend.

## Resultados

Na Fase 3, os votos externos são registrados em `melhores_instagram_votos`.
A apuração combina os canais conforme seus pesos, calcula a pontuação_final
e publica um snapshot de resultados após revisão administrativa.

Resultado publicado é snapshot histórico.

Depois de publicado:

- não recalcular automaticamente;
- alterações exigem ação administrativa consciente;
- manter metodologia e data de publicação.

## Páginas públicas

A Fase 4 registra a audiência das páginas e interações com a edição; a
migração correspondente é `20260712_melhores_urania_fase4_audiencia.sql`.

A Fase 5 recebe indicações em `/api/melhores-indicar`, com validação do
período, categoria, Turnstile e limite de envios. O formulário público pede
apenas categoria e nome do indicado; a moderação ocorre no painel.

Rotas:

- `/melhores-de-urania/`;
- `/melhores-de-urania/:ano/`;
- `/melhores-de-urania/:ano/regulamento/`;
- `/melhores-de-urania/:ano/metodologia/`;
- `/melhores-de-urania/:ano/resultados/`;
- `/melhores-de-urania/:ano/categorias/:slug/`.

## Checklist antes da primeira edição

- edição ativa criada;
- categorias revisadas;
- indicados cadastrados;
- regulamento revisado;
- metodologia revisada;
- Turnstile configurado;
- segredo de voto configurado;
- teste de voto feito;
- sitemap validado;
- página mobile revisada.
