# Eu Amo Urânia — portal com Supabase

Esta branch mantém o visual público do site e troca os arquivos JSON por um CMS conectado ao Supabase. Notícias, guia comercial e links são carregados do banco; o painel também gerencia turismo, eventos, banners, categorias e configurações.

## 1. Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor**, copie `supabase/schema.sql` e execute.
3. Em **Settings > API Keys**, copie a Project URL e a chave **Publishable** (`sb_publishable_...`).
4. Preencha `assets/js/supabase-config.js`:

```js
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_...";
```

A chave publicável pode ficar no site. Nunca coloque Secret Key, `service_role` ou senha administrativa no código público. A proteção dos dados é feita pelas políticas RLS incluídas no schema.

## 2. Criar o primeiro administrador

1. No Supabase, abra **Authentication > Users > Add user**.
2. Crie o usuário com e-mail e senha.
3. No **SQL Editor**, execute, trocando o e-mail e o nome:

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

## 3. Migrar os JSON sem Secret Key

Os arquivos `news-data.json` e `guia-data.json` foram mantidos apenas para importação. O script entra como o administrador criado acima e usa somente a Publishable Key com as regras RLS.

```powershell
npm install @supabase/supabase-js
$env:SUPABASE_URL="https://SEU-PROJETO.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
$env:ADMIN_EMAIL="seu-email@exemplo.com"
$env:ADMIN_PASSWORD="SUA-SENHA-LOCAL"
node scripts/migrate-json.mjs
```

A senha fica somente no terminal local e não deve ser gravada no repositório. Depois da migração, feche o terminal ou remova as variáveis. O script transforma títulos em slugs e pode ser executado novamente, pois atualiza registros com o mesmo slug.

## 4. Usar o painel

Acesse `/admin/` ou `/admin/login.html`. O menu reúne:

- Dashboard com totais e status;
- Notícias com editor visual, imagem, categoria, destaque, publicação e SEO;
- Guia comercial com contato, endereço, redes sociais e recomendação;
- Turismo, links, eventos, banners e categorias;
- Configurações gerais do portal.

### Publicar uma notícia

1. Entre em **Notícias > Novo cadastro**.
2. Digite o título; o slug é criado automaticamente.
3. Preencha resumo, conteúdo, imagem, categoria e SEO.
4. Escolha `rascunho` ou `publicado` e salve.

A URL pública usa o slug: `/news-details.html?slug=titulo-da-noticia`.

### Publicar um item do guia

1. Entre em **Guia comercial > Novo cadastro**.
2. Preencha nome, categoria, descrição, imagem e contato.
3. Marque **Recomendado** quando desejar destaque.
4. Mude o status para `publicado` e salve.

### Editar a página de links

Entre em **Links**, cadastre título, URL, ícone/emoji e ordem. Apenas itens `ativos` aparecem ao público.

## 5. Estrutura

```text
admin/                       painel e login
assets/js/pages/             páginas públicas
assets/js/services/          cliente e serviços Supabase
assets/js/supabase-config.js configuração pública
scripts/migrate-json.mjs     importação autenticada dos JSON
supabase/schema.sql          tabelas, índices, gatilhos e RLS
```

## 6. Segurança e publicação

- RLS está ativado em todas as tabelas.
- Visitantes leem apenas registros publicados/ativos.
- Administradores autenticados têm CRUD pelo painel.
- O HTML das notícias é higienizado antes de ser exibido.
- Hospede em GitHub Pages, Netlify, Vercel ou outro servidor estático.
- Para testar localmente, use um servidor HTTP; não abra diretamente por `file://`.

## 7. Checklist

- Execute `supabase/schema.sql`.
- Preencha a Project URL e a Publishable Key.
- Crie o usuário no Auth e registre-o em `usuarios_admin`.
- Rode a migração dos JSON.
- Teste login, rascunho, publicação, edição e exclusão.
- Teste notícias, notícia individual, guia e links no celular e computador.
