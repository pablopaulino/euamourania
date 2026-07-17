# Eventos 2.0 — Eu Amo Urânia

O módulo Eventos 2.0 separa a agenda simples do acervo permanente de eventos tradicionais.

## Estrutura

- `eventos`: agenda simples já existente. Continua funcionando.
- `eventos_principais`: página permanente do evento, como Festa do Peão ou Festival Gastronômico.
- `eventos_edicoes`: edição anual ou específica vinculada a um evento principal.
- `eventos_noticias`: vínculo opcional entre notícias e eventos/edições.

## URLs públicas

- Lista geral: `/eventos/`
- Evento principal: `/eventos/slug-do-evento`
- Edição: `/eventos/slug-do-evento/2026`
- Compatibilidade antiga: `/eventos/detalhes.html?slug=...`

## Como cadastrar

1. Execute `supabase/migrations/20260717_eventos_2_0.sql` no Supabase.
2. No painel, abra `Eventos principais`.
3. Cadastre o evento permanente com nome, slug, descrição, história e imagem de capa.
4. Copie o `id` do evento principal.
5. Abra `Edições`.
6. Cadastre a edição com `evento_id`, ano, título, datas, programação, cartaz, banner, galeria e status.

Por enquanto, o campo `evento_id` é preenchido manualmente para evitar uma refatoração grande do painel. Em uma melhoria futura, ele pode virar um seletor visual de eventos.

## JSON em campos de galeria

Use `[]` quando não houver itens.

Exemplo:

```json
[
  {
    "url": "assets/eventos/festa-do-peao-2026.jpg",
    "legenda": "Cartaz oficial da edição 2026"
  }
]
```

## SEO

O sitemap inclui automaticamente:

- eventos principais ativos;
- edições vinculadas a eventos principais ativos;
- imagens de capa, banner ou cartaz quando existirem.

As páginas públicas também atualizam título, descrição, imagem social e dados estruturados básicos de Event.

## Observação

O módulo foi feito para conviver com a agenda antiga. Assim, eventos pontuais continuam na tabela `eventos`, enquanto eventos anuais/tradicionais usam `eventos_principais` e `eventos_edicoes`.
