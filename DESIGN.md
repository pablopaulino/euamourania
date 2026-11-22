---
name: Eu Amo Urânia — painel administrativo
description: Padrão visual do CMS para redigir, revisar, consultar e administrar conteúdo.
colors:
  action: "#30494a"
  action-hover: "#203738"
  accent: "#f26722"
  canvas: "#f5f5f7"
  surface: "#ffffff"
  inset: "#edf2f1"
  text: "#111827"
  secondary: "#4b5563"
  muted: "#606c79"
  border: "rgba(17, 24, 39, 0.08)"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
rounded:
  field: "8px"
  panel: "14px"
  button: "999px"
spacing:
  compact: "8px"
  field: "12px"
  group: "16px"
  section: "24px"
components:
  primary-button:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
---

## Overview

Este padrão se aplica ao `/admin`. Use o Editor de Notícias como referência para redação, Configurações para formulários com grupos e Agenda para listas com filtros. Os três pilotos definem como distinguir a área principal de trabalho, os controles e as informações auxiliares.

## Colors

Use o cinza do canvas entre áreas de trabalho, o branco para o painel principal e o verde-acinzentado para uma área auxiliar, como a assistência editorial. A ação principal usa petróleo e texto branco. O laranja identifica o item atual no menu e o foco por teclado. O texto da seleção usa a cor principal escura.

Reserve verde, âmbar e vermelho para estados de negócio. Escreva o significado junto à cor, por exemplo “Publicado”, “Pendente” ou “Erro”. Ao combinar texto e fundo, confira contraste de pelo menos 4,5:1 para texto comum.

## Typography

Use Inter com a pilha de sistema como alternativa. Título da página, título de grupo, rótulo de campo e texto auxiliar têm funções distintas. Use um título de grupo quando ele identifica o conteúdo seguinte. Nos indicadores, mantenha rótulo, valor e descrição nessa ordem de leitura, com espaço suficiente para números e nomes compridos.

## Layout

O menu, o título da página e as abas de seção pertencem ao shell. Monte o conteúdo em `#app-content`, que fornece a margem responsiva de 16 a 32 px. Use 16 px dentro de grupos e 24 px entre blocos independentes como ponto de partida.

No celular, distribua indicadores curtos em duas colunas e dê largura inteira a descrições extensas. Restrinja a rolagem horizontal à tabela ou à faixa de abas que precisa dela. No Editor de Notícias, a área de redação aparece antes da prévia no celular. Nas Assinaturas Viva, confira tanto a lista quanto o detalhe de uma empresa.

## Elevation & Depth

Use uma moldura por grupo de trabalho. Dentro de um painel, separe seções com título, espaço vertical ou um divisor fino. Reserve um fundo auxiliar para informação que merece agrupamento, como prévia e checklist. Barras de ações usam fundo sólido e divisor superior. Mantenha sombras mais perceptíveis para elementos sobrepostos, como diálogos.

## Shapes

Painéis usam raio de 14 px. Campos usam 8 px e uma borda visível para indicar edição. Ações principais e secundárias usam contorno arredondado. Diferencie ação primária, secundária e destrutiva pelo tratamento e pelo rótulo, preservando o foco visível.

## Components

- **Listas.** Reúna busca, filtros, contador, resultados e estado vazio em uma superfície. Separe a barra de filtros dos resultados com um divisor. Quando a criação já aparece no cabeçalho, a ação repetida no estado vazio recebe tratamento secundário.
- **Formulários.** Alinhe rótulos acima dos campos. Agrupe campos relacionados com um título e espaço regular. Mantenha limites visíveis no editor de texto e nos controles de upload.
- **Abas.** A navegação de seção permanece no shell. Dentro do módulo, use abas discretas com fundo suave no item ativo. Preserve as indicações de seleção e foco.
- **Indicadores.** Em painéis já delimitados, use pequenas áreas tonais sem sombra própria. Ajuste a altura ao conteúdo. Verifique estados vazios, valores longos e números diferentes de zero.

## Do's and Don'ts

Implemente cores e medidas comuns em `admin/admin-theme.css`, navegação em `admin/admin-shell.css` e componentes em `admin/admin-components.css`. Consulte `admin/resource-layouts.css` para listas e formulários compartilhados. Reserve a folha do módulo para necessidades específicas, como o espaço de redação ou os controles de renovação.

Antes de incorporar um módulo, percorra uma tarefa completa com teclado e dados representativos. Confira o resultado em 390, 768 e 1360 px e com zoom de 200%. Observe se o primeiro campo de trabalho continua alcançável, se os rótulos quebram corretamente, se a seleção continua legível e se tabelas extensas mantêm a rolagem dentro do painel.
