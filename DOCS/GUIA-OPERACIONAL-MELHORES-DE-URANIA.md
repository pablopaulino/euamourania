# Guia operacional — Melhores de Urânia

Este guia explica o uso diário do módulo **Melhores de Urânia** no CMS.

## 1. Acessar o módulo

No painel administrativo, acesse:

`Melhores de Urânia`

O módulo possui:

- Visão geral;
- Edições;
- Categorias;
- Indicados;
- Instagram;
- Apuração;
- Resultados.

## 2. Criar uma edição

1. Clique em **Nova edição**.
2. Preencha nome, ano e slug.
3. Defina status inicial como `planejamento`.
4. Configure períodos de indicação, votação e divulgação.
5. Configure pesos:
   - Site;
   - Instagram.
6. Os dois pesos precisam somar 100.
7. Salve.

Exemplos:

- Site: 50 / Instagram: 50;
- Site: 60 / Instagram: 40.

## 3. Criar categorias

1. Abra a aba **Categorias**.
2. Escolha a edição.
3. Clique em **Nova categoria**.
4. Preencha nome, slug, descrição, ordem e regras.
5. Salve.

A ordem define a posição em que a categoria aparece nas telas públicas e administrativas.

## 4. Criar indicados

1. Abra a aba **Indicados**.
2. Escolha edição e categoria.
3. Clique em **Novo indicado**.
4. Se o indicado já existir no Guia Comercial, selecione em **Vincular ao Guia Comercial**.
5. O painel pode reaproveitar nome, imagem, contato e endereço.
6. Marque se está aprovado e se possui consentimento/autorização.
7. Salve.

Para aparecer na votação pública, o indicado precisa estar:

- com status `ativo`;
- aprovado;
- com visibilidade pública;
- vinculado a uma categoria ativa e pública.

## 5. Abrir votação pública

Antes de abrir:

- edição criada;
- pesos somando 100;
- categorias ativas;
- indicados ativos e aprovados;
- regulamento preenchido;
- metodologia preenchida;
- data/hora de início e fim conferidas.

Para abrir:

1. Altere o status da edição para `votacao_aberta`.
2. Confira a página pública:

`/melhores-de-urania/ANO/`

O voto é enviado por API segura da Vercel. O navegador não grava diretamente em `melhores_votos`.

## 6. Encerrar e apurar

Depois do fim da votação:

1. Altere a edição para `apuracao`.
2. Lance os votos do Instagram.
3. Confira a prévia de apuração.
4. Revise pesos, empates e metodologia.
5. Publique o resultado oficial.

## 7. Resultado oficial

Ao publicar o resultado, o sistema grava um snapshot histórico em `melhores_resultados`.

Depois de publicado, o resultado oficial não é recalculado automaticamente.

Página pública:

`/melhores-de-urania/ANO/resultados/`

## 8. Retenção dos votos individuais

Os votos individuais ficam disponíveis durante a votação e por 7 dias após o encerramento.

Depois desse prazo:

- o sistema consolida os dados;
- remove os votos individuais;
- preserva estatísticas e resultados oficiais;
- registra auditoria.

## 9. Audiência

A Fase 4 registra eventos básicos do Melhores de Urânia:

- abertura da página principal;
- abertura de edição;
- clique em chamadas da home/lista;
- início de voto;
- voto concluído;
- erro de voto;
- abertura da página de resultados.

Esses dados ajudam a entender adesão da votação e interesse por edição.

## 10. Checklist final

Antes de divulgar:

- página principal `/melhores-de-urania/` abrindo;
- página da edição abrindo;
- votação testada;
- resultado testado, se já publicado;
- bloco da home aparecendo quando houver edição pública;
- eventos de audiência liberados pela migração da Fase 4;
- sitemap e URLs amigáveis mantidos.
