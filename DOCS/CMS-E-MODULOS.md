# CMS e módulos administrativos

O painel administrativo é o centro de operação do Eu Amo Urânia. Ele deve ser consistente, responsivo, seguro e fácil de usar.

## Visão geral

A tela inicial deve mostrar dados úteis do portal:

- notícias publicadas;
- rascunhos;
- aprovações pendentes;
- empresas cadastradas;
- eventos ativos;
- campanhas publicitárias;
- assinantes;
- colaboradores;
- audiência rápida;
- últimas atividades;
- alertas importantes.

## Notícias

Recursos:

- criar, editar e excluir notícia;
- slug automático;
- subtítulo;
- resumo;
- categoria;
- imagem principal;
- legenda;
- autor;
- data e hora de publicação;
- status público;
- status editorial;
- destaque;
- SEO title;
- SEO description;
- imagem de compartilhamento;
- editor rico;
- prévia;
- salvar rascunho;
- publicar, quando permitido.

Regras:

- Super Admin pode publicar diretamente;
- Redator envia para aprovação;
- Editor aprova, publica ou solicita ajustes;
- edição de notícia antiga não altera posição pública, exceto se a data de publicação for alterada.

## Aprovações

Fila editorial com:

- matérias em revisão;
- comentários de ajustes;
- autor;
- data de envio;
- ações de aprovar, aprovar e publicar ou solicitar ajustes.

## Guia comercial

Recursos:

- cadastro de empresas;
- categoria;
- descrição;
- imagem;
- WhatsApp;
- Instagram;
- endereço;
- horário;
- recomendado;
- status;
- página individual;
- páginas por categoria;
- importação por JSON.

No site público, empresas recomendadas devem receber destaque visual sem quebrar a consistência dos cards.

## Turismo

Recursos:

- pontos turísticos;
- imagem;
- descrição;
- localização;
- horário;
- destaque;
- página individual;
- SEO;
- relação com notícias, Guia e eventos.

## Eventos

### Agenda simples

Para eventos pontuais.

### Eventos principais

Para eventos permanentes/anuais, como festas tradicionais.

### Edições

Cada edição pode ter página própria por ano, com SEO, conteúdo, cartaz, galeria e detalhes.

## Publicidade

Gerencia campanhas internas:

- anunciante;
- logo;
- imagem;
- formatos;
- posições;
- status;
- período;
- prioridade;
- métricas;
- biblioteca de mídia.

Os anúncios devem aparecer de forma natural no site, sem banner fixo gigante no topo.

## Comunicação

Recursos:

- assinantes;
- interesses;
- campanhas de newsletter;
- envio de teste;
- envio manual;
- agendamento;
- histórico;
- descadastro;
- newsletter mensal assistida.

## Audiência

Central de análise:

- páginas mais acessadas;
- notícias mais acessadas;
- empresas mais acessadas;
- pontos turísticos;
- eventos;
- cliques;
- pesquisas;
- publicidade;
- comparação por período;
- exportação CSV.

## Colaborações

Recebe cadastros voluntários de pessoas interessadas em colaborar com pautas, fotos, relatos ou textos.

O cadastro não cria vínculo, remuneração, obrigação de produção ou garantia de publicação.

## Mídia

Permite:

- upload;
- seleção de imagens;
- recorte;
- reutilização;
- identificação de imagens em uso.

## Configurações

Deve manter apenas campos realmente úteis e seguros para edição:

- nome do site;
- descrição;
- contato;
- redes sociais;
- textos públicos editáveis;
- imagens públicas específicas que realmente aparecem no site.

Não é recomendado expor configurações técnicas, assets fixos, favicon ou logos estruturais para edição casual.

## Usuários

Gerencia usuários administrativos, função, status, último login e permissões.

## Importar JSON

Ferramenta para migração ou importação assistida. Não deve ser fonte principal do site público.
