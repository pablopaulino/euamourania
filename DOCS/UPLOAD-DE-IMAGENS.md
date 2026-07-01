# Upload de imagens no CMS

O painel aceita imagens enviadas diretamente do computador sem depender de links externos.

## Configuração

Execute `supabase/migrations/20260701_cms_media_upload.sql` no SQL Editor. A migração cria o bucket público `cms-media`, limita cada arquivo a 8 MB e aceita JPG, PNG, WebP, GIF e AVIF.

As políticas do Storage usam as mesmas permissões do CMS. Cada usuário só pode enviar arquivos para os módulos nos quais pode criar ou editar conteúdo. Nenhuma chave secreta é usada no navegador.

## Como usar

1. Abra o formulário de notícia, empresa, ponto turístico, evento ou newsletter.
2. No campo de imagem, clique em **Enviar imagem**.
3. Escolha o arquivo e aguarde a confirmação.
4. Escolha o formato, ajuste zoom, rotação e enquadramento arrastando a imagem.
5. A versão otimizada em WebP, a URL pública e a prévia serão criadas automaticamente.
6. Salve o conteúdo normalmente.

No editor de notícia, turismo e newsletter, **Inserir imagem no texto** envia o arquivo e adiciona a imagem na posição atual do editor.

O campo de URL permanece disponível para imagens já hospedadas em outro serviço.

## Originais e limpeza segura

Quando **Guardar o arquivo original por 7 dias** estiver marcado, o CMS preserva o arquivo recebido e publica a versão editada. O original não pode ser removido pela limpeza antes desse prazo.

O Super Admin encontra **Mídia** no menu do painel. Essa biblioteca informa quais imagens estão em uso e permite limpar somente arquivos que:

- não aparecem em notícias, guia, turismo, eventos, newsletters, publicidade ou configurações;
- foram enviados há mais de sete dias.

Imagens em uso nunca são disponibilizadas para exclusão. Ao excluir uma notícia, seus arquivos ficam protegidos por sete dias e depois podem ser removidos pela limpeza, desde que não tenham sido reutilizados.
