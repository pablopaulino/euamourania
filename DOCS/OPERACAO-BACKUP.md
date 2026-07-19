# Operação e backup

Este documento resume a rotina de operação do portal.

## Rotina editorial

1. Criar notícia.
2. Definir categoria.
3. Inserir imagem principal.
4. Conferir título, resumo e SEO.
5. Definir data e hora de publicação.
6. Salvar rascunho ou publicar.
7. Verificar página pública.

Redatores devem enviar para aprovação. Super Admin pode publicar diretamente.

## Rotina do Guia

1. Cadastrar empresa.
2. Definir categoria.
3. Inserir imagem.
4. Preencher WhatsApp, endereço e horário.
5. Marcar recomendado quando fizer sentido.
6. Conferir página individual e categoria pública.

## Rotina de Turismo

1. Cadastrar ponto turístico.
2. Inserir imagem.
3. Preencher descrição, localização e horário.
4. Conferir página individual.

## Rotina de Eventos

Para evento anual:

1. Criar evento principal.
2. Preencher história e SEO.
3. Criar edição por ano.
4. Preencher programação, cartaz, imagens e SEO.
5. Conferir páginas públicas.

Para evento pontual:

1. Usar agenda simples.
2. Definir data, hora e status.

## Rotina de publicidade

1. Criar anunciante.
2. Criar campanha.
3. Escolher imagem da biblioteca.
4. Definir posições.
5. Definir período.
6. Publicar.
7. Verificar impressões e cliques.

## Rotina de newsletter

1. Criar campanha ou gerar resumo mensal.
2. Revisar assunto e conteúdo.
3. Enviar teste.
4. Corrigir se necessário.
5. Enviar manualmente.
6. Conferir métricas.

## Backup

Antes de migrações grandes:

- exportar tabelas críticas;
- salvar cópia do SQL executado;
- conferir se há rollback;
- executar primeiro em ambiente seguro quando possível.

Tabelas críticas:

- notícias;
- guia_comercial;
- turismo;
- eventos;
- eventos_principais;
- eventos_edicoes;
- usuários administrativos;
- permissões;
- publicidade;
- newsletter;
- mídia;
- Melhores de Urânia.

## Restauração

Testar periodicamente:

- restaurar backup em projeto separado;
- conferir tabelas;
- conferir permissões;
- testar login;
- testar páginas públicas.

## Incidentes comuns

- Deploy falhou por limite de funções: consolidar APIs.
- Conteúdo não aparece: verificar status, data e RLS.
- Imagem não aparece: verificar URL, Storage e permissões.
- Métricas divergentes: verificar fonte, período e timezone.
- Página não indexa: verificar canonical, sitemap e status HTTP.
