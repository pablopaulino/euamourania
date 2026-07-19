# Troubleshooting

## Site abriu sem CSS

Possíveis causas:

- rota quebrada;
- caminho relativo errado;
- rewrite interferindo em assets;
- cache do navegador;
- deploy incompleto.

Verificar:

- console do navegador;
- Network;
- `vercel.json`;
- caminhos de CSS e JS;
- status do deploy.

## Notícia não aparece

Verificar:

- status público é `publicado`;
- data de publicação não está no futuro;
- `published_at` está preenchido;
- categoria existe;
- RLS permite leitura pública;
- slug não está duplicado.

## Notícia aparece fora de ordem

Verificar se a consulta está ordenando por:

- correto: `published_at desc`;
- errado: `updated_at desc`.

## Imagem não aparece

Verificar:

- URL absoluta ou caminho interno válido;
- arquivo existe;
- Supabase Storage está público quando necessário;
- campo não está vazio;
- fallback está configurado.

## Admin não salva

Verificar:

- usuário autenticado;
- função e permissões;
- RLS;
- campos obrigatórios;
- formato de URL/imagem;
- console do navegador.

## Menu do admin muda ou some

Verificar:

- função do usuário;
- cache de permissões;
- lógica de menu ativo;
- erro JavaScript após trocar de módulo.

## Métricas inconsistentes

Verificar:

- fonte usada pelo card;
- período selecionado;
- timezone;
- cache;
- eventos duplicados;
- tipo do evento;
- agregação SQL.

## Vercel não publicou

Verificar:

- GitHub conectado;
- outage do GitHub/Vercel;
- branch correta;
- deploy em andamento;
- erro de limite de Serverless Functions;
- variáveis ausentes.

## Google não indexa

Verificar:

- URL retorna 200;
- não tem `noindex`;
- canonical aponta para a própria URL;
- está no sitemap;
- conteúdo não é duplicado;
- imagem e metadados existem;
- página não depende apenas de JS para o conteúdo principal.

## Supabase acusa Security Definer View

Isso aparece quando uma view usa `SECURITY DEFINER`.

Ação:

- avaliar se é necessário;
- preferir `SECURITY INVOKER` quando possível;
- ajustar view sem quebrar RLS;
- não rodar rollback sem entender impacto.
