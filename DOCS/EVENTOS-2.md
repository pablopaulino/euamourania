# Eventos 2.0

O módulo de Eventos 2.0 separa eventos pontuais de eventos permanentes ou anuais.

## Tipos

### Agenda simples

Eventos comuns, com data de início e fim.

Exemplos:

- palestra;
- show;
- reunião;
- feira pontual.

### Eventos principais

Páginas permanentes para eventos recorrentes ou importantes.

Exemplos:

- Festa do Peão;
- Festival Gastronômico;
- festas tradicionais.

### Edições

Cada edição representa um ano ou uma ocorrência específica de um evento principal.

Exemplo:

- `/eventos/festa-do-peao-de-urania`
- `/eventos/festa-do-peao-de-urania/2026`

## Página do evento principal

Deve conter:

- nome;
- slug;
- descrição curta;
- história;
- imagem;
- categoria;
- status;
- SEO title;
- SEO description;
- Open Graph;
- cards das edições.

## Página da edição

Deve conter:

- ano;
- título;
- descrição;
- período;
- local;
- cartaz/banner;
- programação;
- atrações;
- galeria;
- patrocinadores;
- links;
- SEO title;
- SEO description.

## Painel

No admin:

- “Agenda simples” gerencia eventos pontuais.
- “Eventos principais” gerencia páginas permanentes.
- “Edições” deve permitir escolher o evento principal sem exigir que o usuário copie ID manualmente.

## SEO

Ambos devem ser indexáveis:

- evento principal;
- edição.

Sitemap deve incluir as duas rotas quando ativas.
