# CMS e módulos

## Visão geral

O painel reúne Notícias, Guia, Turismo, Eventos, Links, Categorias, Publicidade, Comunicação, Estatísticas, Configurações e Importação. Acesso exige Supabase Auth e registro ativo em `usuarios_admin`.

## Fluxo editorial

Crie como rascunho, complete título/slug/resumo/conteúdo/imagem/categoria/SEO e use a prévia. Redatores, Editores e Administradores enviam as próprias matérias para aprovação e não podem revisar o próprio envio. O Super Admin pode publicar diretamente. O estado editorial é separado do status público e a proteção também existe no banco. Consulte `FLUXO-EDITORIAL-E-AUDIENCIA.md`.

`destaque` controla a área especial da home e o topo de notícias; sem itens ativos a área desaparece.

## Audiência

A Central de audiência usa eventos próprios do Supabase, comparação de períodos, origens, dispositivos, conteúdos, cliques, pesquisas, publicidade e exportação CSV. Não armazena IP nem dados pessoais. GA4 e Search Console permanecem opcionais e devem usar credenciais somente no backend.

## Comunicação

Assinantes ficam no Supabase. Campanhas podem ser rascunho, teste, envio ou agendamento conforme a API. O botão de teste exige destinatário e usa a função segura da Vercel; a chave Brevo nunca chega ao painel.

## Publicidade

Campanhas combinam criativo, período, prioridade, formato e posições. O CMS oferece formatos automático, super banner, horizontal, retângulo, quadrado, vertical e nativo, além de imagem específica para celular e prévia responsiva. Posições intermediárias entram dentro das listagens ou do texto, e campanhas concorrentes no mesmo espaço podem alternar em um carrossel acessível.

A exibição só ocorre quando a campanha está ativa e dentro do período. Uma impressão é registrada somente quando o anúncio fica visível, cliques continuam protegidos pela função do banco e nenhuma posição reserva espaço quando não há campanha. A visão geral também mostra a ocupação dos espaços publicitários.

## Categorias

Categorias têm tipo, ordem e status. Antes de excluir, confira a contagem de uso. Prefira inativar categorias históricas para preservar referências.

## Padrão de operação

Use busca/filtros, confirme exclusões, observe mensagens de sucesso/erro e não feche formulário com alterações pendentes. Após operações críticas, confira a página pública em janela anônima.
