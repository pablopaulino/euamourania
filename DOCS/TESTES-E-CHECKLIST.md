# Testes e checklist

## Comandos

Validação rápida:

```bash
npm run validate
```

Suíte completa:

```bash
npm test
```

Servidor local:

```bash
npm run serve
```

## Testes automatizados existentes

O projeto possui testes para:

- validação geral;
- RBAC;
- configurações globais;
- fluxo editorial e audiência;
- integrações Google;
- upload de mídia;
- layout da biblioteca;
- Melhores de Urânia;
- votação pública;
- apuração;
- Guia;
- notícias;
- Turismo;
- navegação pública;
- performance;
- busca;
- publicidade;
- AdSense;
- WhatsApp oficial;
- SEO;
- Google News;
- rodapé;
- colaboração voluntária;
- newsletter mensal;
- Eventos 2.0.

## Checklist público

- Home carrega sem deformar.
- Menu funciona no desktop e celular.
- Notícias listam corretamente.
- Notícia individual abre por slug.
- Compartilhamento funciona.
- Guia carrega empresas.
- Empresa individual abre e compartilha com imagem correta.
- Categorias do Guia abrem.
- Turismo carrega lugares.
- Atração individual abre.
- Eventos abrem.
- Evento principal abre.
- Edição de evento abre.
- Links abre.
- Urânia abre.
- Colabore abre e envia.
- Melhores de Urânia abre.
- Newsletter pública funciona.
- Anúncios aparecem sem cobrir conteúdo.

## Checklist admin

- Login funciona.
- Logout funciona.
- Permissões escondem menus corretamente.
- Notícias: criar, editar, publicar, rascunho e excluir.
- Aprovações: enviar, aprovar e solicitar ajustes.
- Guia: criar, editar, recomendar e excluir.
- Turismo: criar, editar, destacar e excluir.
- Eventos simples: criar e editar.
- Eventos principais: criar e editar.
- Edições: criar e editar.
- Publicidade: criar campanha e verificar posições.
- Comunicação: criar newsletter, teste e envio.
- Colaborações: visualizar cadastro.
- Mídia: upload, selecionar e identificar uso.
- Usuários: ativar/desativar e alterar função.
- Configurações: salvar campos essenciais.
- Audiência: filtros e rankings.

## Checklist de dados

- Notícias públicas ordenam por `published_at`.
- Rascunhos não aparecem no site.
- Conteúdo futuro não aparece antes da data.
- Categorias novas geram páginas públicas.
- Sitemaps incluem novas rotas.
- Métricas batem com a fonte definida.
- Imagens em uso aparecem como protegidas.

## Checklist antes de deploy

- `npm run validate` passou.
- `npm test` passou ou falhas foram documentadas.
- Sem arquivos acidentais no commit.
- Sem segredo no código.
- Vercel tem variáveis necessárias.
- Migrações SQL necessárias já foram executadas.
- Deploy na Vercel ficou `Ready`.
