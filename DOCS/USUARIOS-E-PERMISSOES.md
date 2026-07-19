# Usuários e permissões

O CMS usa Supabase Auth e controle de acesso por função.

## Funções

### Super Admin

- acesso total;
- cria, edita e desativa usuários;
- altera configurações sensíveis;
- publica, edita e exclui qualquer conteúdo;
- pode publicar notícia sem aprovação.

### Administrador

- gerencia quase todos os módulos;
- não deve excluir Super Admin;
- não deve alterar configurações sensíveis.

### Editor

- gerencia notícias;
- aprova matérias;
- publica notícias;
- edita categorias de notícias;
- não acessa publicidade, newsletter, usuários ou configurações sensíveis.

### Redator

- cria notícias;
- edita apenas as próprias notícias;
- salva rascunhos;
- envia para aprovação;
- não publica sem aprovação.

### Comercial

- acessa Guia comercial e Publicidade;
- cria e edita empresas e campanhas;
- não acessa notícias, newsletter ou configurações sensíveis.

### Comunicação

- acessa newsletter, links e assinantes;
- cria campanhas de e-mail;
- visualiza assinantes;
- não altera notícias nem configurações sensíveis.

### Visualizador

- visualiza painel e relatórios;
- não cria, edita ou exclui.

## Proteção obrigatória

Cada ação deve ser protegida em quatro níveis:

1. menu do painel;
2. botão/ação da tela;
3. API/RPC;
4. RLS no Supabase.

## Boas práticas

- desativar usuários antigos;
- revisar permissões antes do lançamento;
- usar MFA em contas administrativas;
- não compartilhar login;
- registrar ações em `cms_atividades`.
