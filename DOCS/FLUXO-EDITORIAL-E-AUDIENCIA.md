# Fluxo editorial e audiência

## Fluxo editorial

O sistema separa o status público da notícia do status editorial.

### Status público

- `rascunho`
- `publicado`
- `arquivado`

Controla se a notícia aparece no site.

### Status editorial

- `rascunho`
- `em_revisao`
- `ajustes_solicitados`
- `aprovado`
- `publicado`
- `arquivado`

Controla o processo interno de aprovação.

## Regras por função

Redator:

- cria notícia;
- edita próprias notícias;
- salva rascunho;
- envia para aprovação;
- não publica.

Editor:

- vê fila de aprovação;
- solicita ajustes com comentário;
- aprova;
- aprova e publica;
- define data/hora de publicação.

Administrador e Super Admin:

- têm as ações do Editor;
- Super Admin pode publicar diretamente.

## Datas

O público vê notícias por data de publicação, não por data de edição.

Regras:

- `published_at` controla ordenação e exibição pública;
- `updated_at` é apenas auditoria interna;
- notícia futura só aparece quando a data chegar.

## Audiência

A audiência registra eventos internos do portal.

Eventos rastreados:

- visualização de página;
- visualização de notícia;
- visualização de empresa;
- visualização de turismo;
- visualização de evento;
- clique em WhatsApp;
- clique externo;
- busca;
- impressão de anúncio;
- clique em anúncio.

## Dashboard

Deve mostrar:

- visualizações totais;
- comparação com período anterior;
- notícias mais acessadas;
- empresas mais acessadas;
- turismo mais acessado;
- eventos mais acessados;
- páginas mais acessadas;
- pesquisas;
- cliques;
- publicidade.

## Fonte dos dados

Fonte interna principal:

- Supabase, via `analytics_eventos` e agregações.

Fontes externas complementares:

- GA4;
- Search Console.

Sempre documentar quando um card usar fonte externa.

O sistema não grava IP para garantir a privacidade dos usuários.

A API Google utiliza cache por dez minutos e tem autenticação. Nunca exponha o JSON da conta de serviço.

O sistema não grava IP para garantir a privacidade dos usuários.

A API Google utiliza cache por dez minutos e tem autenticação. Nunca exponha o JSON da conta de serviço.
