# Banco de dados e Supabase

O Supabase é a base principal do portal. Ele fornece banco Postgres, Auth, Storage, RPCs, RLS e políticas de acesso.

## Configuração inicial

1. Execute `supabase/schema.sql`.
2. Execute as migrações em `supabase/migrations/`, em ordem cronológica.
3. Configure `assets/js/supabase-config.js` com URL e chave pública.
4. Configure variáveis sensíveis no Vercel.
5. Crie o primeiro usuário no Supabase Auth.
6. Cadastre esse usuário como `super_admin` em `usuarios_admin`.

## Tabelas principais

### Conteúdo

- `noticias`
- `categorias`
- `guia_comercial`
- `turismo`
- `eventos`
- `eventos_principais`
- `eventos_edicoes`
- `links`
- `configuracoes_site`

### Administração

- `usuarios_admin`
- tabelas de permissões/funções
- `cms_atividades`
- tabelas auxiliares de auditoria

### Mídia

- biblioteca de imagens;
- metadados;
- referências de uso;
- arquivos no Supabase Storage.

### Publicidade

- anunciantes;
- campanhas;
- posições;
- métricas;
- compatibilidade com formatos responsivos.

### Comunicação

- assinantes;
- newsletters;
- envios;
- métricas de e-mail;
- newsletter mensal assistida.

### Audiência

- `analytics_eventos`;
- agregações e rankings;
- eventos de visualização, clique, pesquisa, publicidade e conteúdos.

### Melhores de Urânia

- edições;
- categorias;
- indicados;
- votos;
- resultados consolidados;
- auditoria;
- indicações públicas;
- métricas.

## RLS e permissões

Todas as tabelas sensíveis devem ter RLS ativo.

Regras gerais:

- leitura pública apenas para conteúdo publicado/ativo;
- escrita administrativa apenas para usuários autenticados com permissão;
- ações sensíveis apenas para Super Admin ou função autorizada;
- Service Role apenas em APIs seguras;
- votos, newsletter e formulários públicos devem usar validação, rate limit e sanitização.

## Datas importantes

### Notícias

- `published_at` ou campo equivalente controla publicação pública e ordenação.
- `updated_at` é auditoria interna.
- notícia futura não aparece antes da data/hora.

### Eventos

- eventos simples usam data de início/fim;
- eventos principais são páginas permanentes;
- edições representam anos ou ocorrências específicas.

### Melhores de Urânia

- votação e indicação obedecem janela da edição;
- votos individuais ficam 7 dias após encerramento;
- depois da limpeza, permanecem dados consolidados.

## Storage e imagens

O Storage deve armazenar imagens enviadas pelo painel. Campos de imagem também podem aceitar:

- URL pública externa;
- caminho interno de assets;
- URL pública do Supabase Storage.

A biblioteca deve identificar uso em notícias, Guia, Turismo, Eventos, Publicidade, Urânia e demais páginas editáveis.

## Migrações

Boas práticas:

- migrações devem ser idempotentes quando possível;
- evitar SQL destrutivo sem confirmação;
- documentar impacto;
- testar em ambiente seguro;
- criar rollback apenas quando o risco justificar;
- nunca rodar rollback sem entender o que ele remove.
