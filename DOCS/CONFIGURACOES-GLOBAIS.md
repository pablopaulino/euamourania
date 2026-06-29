# Configurações globais do site

Acesse **CMS > Configurações**. Somente Super Admin ou usuário com permissão extra `configuracoes:editar` pode salvar.

## Mapeamento

- **Geral:** nome, slogan, descrição institucional, endereço, horário, rodapé e copyright.
- **Contatos e redes:** e-mail, WhatsApp, canal, Instagram, Facebook, YouTube e TikTok.
- **Imagens globais:** logos, favicon, compartilhamento, placeholders de notícia/guia/turismo/evento e logo do schema.
- **Home · Hero:** imagem, texto alternativo, chamadas, título, texto, botões e tópicos.
- **Home · Cards e turismo:** títulos, cards, imagens do Borboletário, textos e links.
- **Home · Essência/WhatsApp/newsletter:** todos os textos e chamada do canal.
- **Quem somos:** hero, história, textos, valores, CTA, botão e link.
- **Navegação e páginas legais:** menu, rodapé, termos e privacidade.
- **SEO:** title/description padrão, imagem social, palavras-chave, autor, publicador, logo e domínio.

## Campos JSON

`menu_itens`, `rodape_links`, `home_cards`, `home_topicos` e `quem_valores` usam JSON. O painel valida a sintaxe antes de salvar. Menus aceitam `titulo`, `url`, `ativo` e `nova_aba`. A ordem do array é a ordem pública.

## Imagens

Os campos aceitam URL HTTPS ou caminho público iniciado por `/assets/`. Arquivos locais atuais permanecem como fallback para que uma configuração vazia ou falha de rede não quebre o layout. Eles não são obrigatórios: ao cadastrar uma URL, todas as páginas passam a usá-la.

Fallbacks locais remanescentes:

- logo horizontal;
- favicon/placeholder institucional;
- fotos atuais do hero e Borboletário;
- ícone externo do WhatsApp.

Todos, exceto o ícone vetorial do WhatsApp, têm substituição no painel. O ícone não contém identidade ou conteúdo editorial.

## SEO e compartilhamento

A home é entregue por `/api/home`, que injeta title, description, canonical, Open Graph e Twitter Card diretamente no HTML para robôs do WhatsApp/Facebook. O navegador aplica também as configurações globais às páginas estáticas. Notícias continuam usando metadados próprios e seus fallbacks existentes.

## Segurança e HTML

Termos e Política aceitam HTML institucional. No site, tags executáveis, atributos `on*` e URLs `javascript:` são removidos. Nunca coloque scripts, chaves, tokens ou códigos de integração em `configuracoes_site`.

## Teste recomendado

Altere uma informação por vez e abra janela anônima: logo, hero, WhatsApp, Instagram, texto da home, rodapé, imagem social, canal, Quem Somos e SEO. Para validar compartilhamento, use a URL da home após o cache de até cinco minutos.