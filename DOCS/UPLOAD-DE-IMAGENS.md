# Upload de imagens no CMS

O painel aceita imagens enviadas diretamente do computador sem depender de links externos.

## Configuração

Execute `supabase/migrations/20260701_cms_media_upload.sql` no SQL Editor. A migração cria o bucket público `cms-media`, limita cada arquivo a 8 MB e aceita JPG, PNG, WebP, GIF e AVIF.

As políticas do Storage usam as mesmas permissões do CMS. Cada usuário só pode enviar arquivos para os módulos nos quais pode criar ou editar conteúdo. Nenhuma chave secreta é usada no navegador.

## Como usar

1. Abra o formulário de notícia, empresa, ponto turístico, evento ou newsletter.
2. No campo de imagem, clique em **Enviar imagem**.
3. Escolha o arquivo e aguarde a confirmação.
4. A URL pública e a prévia serão preenchidas automaticamente.
5. Salve o conteúdo normalmente.

No editor de notícia, turismo e newsletter, **Inserir imagem no texto** envia o arquivo e adiciona a imagem na posição atual do editor.

O campo de URL permanece disponível para imagens já hospedadas em outro serviço.
