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

## Resultados

Resultado publicado é snapshot histórico.

Depois de publicado:

- não recalcular automaticamente;
- alterações exigem ação administrativa consciente;
- manter metodologia e data de publicação.

## Páginas públicas

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
