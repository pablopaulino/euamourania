# Eu Amo Urânia — portal com Supabase

Esta branch mantém o visual público do site e troca os arquivos JSON por um CMS conectado ao Supabase. Notícias, guia comercial e links já são carregados do banco; o painel também gerencia turismo, eventos, banners, categorias e configurações.

## 1. Criar e preparar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, copie todo o conteúdo de `supabase/schema.sql` e execute.
3. Em **Project Settings > API**, copie a URL do projeto e a chave **Publishable** (em projetos antigos ela pode aparecer como `anon`).
4. Preencha `assets/js/supabase-config.js`:

```js
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "SUA_CHAVE_PUBLICAVEL";
```

A chave publicável pode ficar no site. Nunca coloque `service_role`, secret key ou senha administrativa em HTML/JavaScript público. A proteção dos dados é feita pelas políticas RLS já incluídas no `schema.sql`.

## 2. Criar o primeiro administrador

1. No painel do Supabase, abra **Authentication > Users > Add user**.
2. Crie o usuário com e-mail e senha.
3. No **SQL Editor**, execute o comando abaixo, trocando o e-mail e o nome:

```sql
insert into public.usuarios_admin (id, email, nome)
select id, email, 'Administrador'
from auth.users
where email = 'seu-email@exemplo.com'
on conflict (id) do update
set ativo = true, nome = excluded.nome, email = excluded.email;
```

4. Acesse `/admin/login.html` no endereço publicado do site.

Somente usuários autenticados e ativos em `usuarios_admin` podem criar, editar ou excluir conteúdo.

## 3. Migrar os JSON existentes

Os arquivos `news-data.json` e `guia-data.json` foram mantidos apenas para a migração. Depois de configurar as tabelas:

```powershell
npm install @supabase/supabase-js
$env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
$env:SUPABASE_SECRET_KEY="SUA_SECRET_KEY"
node scripts/migrate-json.mjs
```

Use a secret key somente no seu computador durante essa importação. Não grave a chave no repositório. O script transforma títulos em slugs, importa as notícias como publicadas e os itens do guia como publicados. Ele pode ser executado novamente, pois atualiza registros com o mesmo slug.

## 4. Usar o painel

Acesse `/admin/` ou `/admin/login.html`. O menu reúne:

- Dashboard com totais e status;
- Notícias com editor visual, imagem, categoria, destaque, publicação e SEO;
- Guia comercial com contato, endereço, redes sociais e recomendação;
- Turismo, links, eventos, banners e categorias;
- Configurações gerais do portal.

### Publicar uma notícia

1. Entre em **Notícias > Novo cadastro**.
2. Digite o título; o slug é criado automaticamente e pode ser ajustado.
3. Preencha resumo, conteúdo, imagem, categoria e dados de SEO.
4. Escolha `rascunho` para guardar sem mostrar no site ou `publicado` para exibir.
5. Ao publicar sem informar data, o painel usa a data e hora atuais.

A URL pública usa o slug:

```text
/news-details.html?slug=titulo-da-noticia
```

### Publicar um item do guia

1. Entre em **Guia comercial > Novo cadastro**.
2. Preencha nome, categoria, descrição, imagem e formas de contato.
3. Marque **Recomendado** quando desejar destaque.
4. Altere o status para `publicado` e salve.

O guia público consulta os itens publicados e permite filtrar por categoria.

### Editar a página de links

Entre em **Links**, cadastre título, URL, ícone/emoji e ordem. Apenas itens com status `ativo` aparecem ao público.

## 5. Estrutura principal

```text
admin/                       painel e login
assets/js/pages/             carregamento das páginas públicas
assets/js/services/          cliente e serviços do Supabase
assets/js/supabase-config.js configuração pública do projeto
scripts/migrate-json.mjs     importação única dos JSON antigos
supabase/schema.sql          tabelas, índices, gatilhos e RLS
```

## 6. Segurança e publicação

- RLS já está ativado em todas as tabelas.
- Visitantes leem apenas registros publicados/ativos.
- Administradores autenticados têm CRUD pelo painel.
- O conteúdo HTML das notícias é higienizado com DOMPurify antes de aparecer na página pública.
- O painel usa Supabase Auth e sessão persistente no navegador.
- Hospede o site normalmente em GitHub Pages, Netlify, Vercel ou outro servidor estático.
- Em produção, use HTTPS e uma senha forte para cada administrador.

## 7. Antes de colocar no ar

- Execute `supabase/schema.sql`.
- Preencha URL e chave publicável em `assets/js/supabase-config.js`.
- Crie o usuário no Auth e registre-o em `usuarios_admin`.
- Rode a migração dos JSON e revise os conteúdos no painel.
- Teste login, rascunho, publicação, edição e exclusão.
- Abra notícias, notícia individual, guia e links no celular e no computador.

Enquanto as credenciais não forem preenchidas, as páginas mostram uma mensagem de configuração em vez de quebrar o layout.
