# CMS e módulos

## Visão geral

O painel reúne Notícias, Guia, Turismo, Eventos, Links, Categorias, Publicidade, Comunicação, Estatísticas, Configurações e Importação. Acesso exige Supabase Auth e registro ativo em `usuarios_admin`.

## Fluxo editorial

Crie como rascunho, complete título/slug/resumo/conteúdo/imagem/categoria/SEO e use a prévia. Redatores enviam para aprovação; Editores, Administradores e Super Admins revisam, solicitam ajustes, aprovam ou publicam. O estado editorial é separado do status público e a proteção também existe no banco. Consulte `FLUXO-EDITORIAL-E-AUDIENCIA.md`.

`destaque` controla a área especial da home e o topo de notícias; sem itens ativos a área desaparece.

## Audiência

A Central de audiência usa eventos próprios do Supabase, comparação de períodos, origens, dispositivos, conteúdos, cliques, pesquisas, publicidade e exportação CSV. Não armazena IP nem dados pessoais. GA4 e Search Console permanecem opcionais e devem usar credenciais somente no backend.

## Comunicação

Assinantes ficam no Supabase. Campanhas podem ser rascunho, teste, envio ou agendamento conforme a API. O botão de teste exige destinatário e usa a função segura da Vercel; a chave Brevo nunca chega ao painel.

## Publicidade

Campanhas combinam criativo, período, prioridade e posições. Exibição só ocorre quando ativa e dentro do período. Impressões/cliques são registrados sem reservar espaço para campanha inexistente.

## Categorias

Categorias têm tipo, ordem e status. Antes de excluir, confira a contagem de uso. Prefira inativar categorias históricas para preservar referências.

## Padrão de operação

Use busca/filtros, confirme exclusões, observe mensagens de sucesso/erro e não feche formulário com alterações pendentes. Após operações críticas, confira a página pública em janela anônima.
