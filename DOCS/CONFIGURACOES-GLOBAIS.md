# Configurações globais

As configurações globais permitem editar informações públicas importantes sem mexer no código.

## O que deve ser editável

- nome do site;
- descrição do site;
- e-mail de contato;
- WhatsApp;
- Instagram;
- Facebook;
- YouTube;
- imagem padrão de compartilhamento;
- texto do rodapé;
- textos institucionais específicos;
- conteúdo da página Urânia;
- imagens públicas específicas que aparecem como conteúdo.

## O que não deve ser edição comum

- favicon;
- logo principal estrutural;
- logo branca estrutural;
- ícones internos;
- caminhos técnicos;
- cores estruturais do sistema;
- blocos JSON complexos que podem quebrar layout;
- assets internos usados como fallback técnico.

## Imagem padrão de compartilhamento

Usada quando a página não possui imagem própria.

Regras:

- deve ser pública;
- deve ter boa resolução;
- deve representar a marca;
- não deve ser ícone pequeno;
- páginas de notícia, empresa, turismo e evento devem preferir sua própria imagem.

## Salvamento

Se uma configuração não salva:

- verificar permissão do usuário;
- verificar RLS;
- conferir se o campo aceita caminho interno, URL ou imagem da biblioteca;
- conferir console do navegador.
