# Usuários administrativos e permissões

## Arquitetura

O Supabase Auth autentica cada pessoa. A tabela `usuarios_admin` define função, status e permissões extras. `admin_permissoes_funcao` contém a matriz padrão. A função `tem_permissao_admin(modulo, acao)` é usada pelas policies RLS; portanto esconder um botão não é a proteção principal.

A criação, alteração e exclusão de contas passa por `/api/admin-users`. Essa função aceita somente sessão de Super Admin e usa `SUPABASE_SERVICE_ROLE_KEY` exclusivamente no backend da Vercel. A chave nunca aparece no HTML, JavaScript público ou respostas da API.

## Funções

| Função | Acesso |
|---|---|
| Super Admin | Total, incluindo usuários, configurações e importação |
| Administrador | Conteúdo, guia, turismo, eventos, publicidade, comunicação, links e relatórios; sem usuários/configurações sensíveis |
| Editor | Notícias, publicação e categorias de notícias; sem exclusão |
| Redator | Cria rascunhos e edita somente notícias próprias; não publica |
| Comercial | Guia e publicidade; cria e edita, sem excluir campanhas |
| Comunicação | Newsletters e links; visualiza assinantes e envia campanhas |
| Visualizador | Dashboard e relatórios, sem escrita |

## Instalação

1. Execute, nesta ordem, no SQL Editor:
   - `supabase/migrations/20260628_admin_rbac.sql`
   - `supabase/migrations/20260628_admin_rbac_02_acoes.sql`
2. Confirme que `euamourania@gmail.com` aparece em `usuarios_admin` como `super_admin` e ativo.
3. Na Vercel, configure `SUPABASE_SERVICE_ROLE_KEY` somente nos ambientes necessários e faça novo deploy.
4. Nunca envie essa chave por mensagem, formulário ou commit.

## Uso

Acesse `/admin/usuarios.html`. O Super Admin pode criar conta com senha temporária, editar nome/e-mail/função, trocar senha, ativar, desativar e excluir. Não é permitido desativar/excluir a própria conta nem remover o último Super Admin ativo.

## Checklist por função

### Super Admin
- Login e acesso a todos os módulos.
- Criar, editar, desativar e excluir outro usuário.
- Bloqueio ao tentar excluir/desativar a própria conta.
- Configurações e importação disponíveis.

### Administrador
- CRUD de conteúdo, guia, turismo e eventos.
- CRUD de publicidade, newsletter e links.
- Usuários, importação e configurações sensíveis ocultos e bloqueados.
- Não consegue alterar Super Admin pela API.

### Editor
- Criar/editar/publicar notícia.
- Criar/editar categoria de notícias.
- Exclusão, publicidade, comunicação, usuários e configurações bloqueados.

### Redator
- Criar notícia como rascunho.
- Editar notícia própria.
- Tentativa de editar notícia alheia ou publicar deve falhar no RLS.

### Comercial
- Acessar guia e publicidade.
- Criar/editar empresa e campanha.
- Exclusão de campanha, notícias e comunicação bloqueadas.

### Comunicação
- Criar, editar, testar e enviar newsletter.
- Visualizar assinantes sem alterar/excluir.
- Gerenciar links.
- Notícias, publicidade e configurações bloqueadas.

### Visualizador
- Visualizar dashboard e estatísticas.
- Nenhum botão de criação/edição/exclusão.
- Tentativas diretas de escrita devem falhar no RLS.

## Auditoria de segurança

Para cada função, teste também uma chamada direta pelo console ou cliente REST. A resposta esperada para operação não autorizada é erro de RLS/403. Revise periodicamente contas inativas, último login e a existência de pelo menos dois Super Admins de confiança.