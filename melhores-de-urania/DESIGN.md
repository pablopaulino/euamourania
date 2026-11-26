---
name: Prêmio Melhores de Urânia
description: Sistema visual da experiência pública do Prêmio e de suas prévias.
colors:
  canvas: "#FFFFFF"
  surface: "#F7F6F4"
  media: "#F3F2EF"
  divider: "#EAE7E2"
  text: "#181615"
  secondary: "#6B6560"
  action: "#C62119"
  action-hover: "#9E1812"
  amber: "#C88A2E"
  label-text: "#805518"
typography:
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  editorial-emphasis:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontStyle: "italic"
rounded:
  media: "16px"
  control: "8px"
---

## Superfícies

O fundo branco predomina. O neutro suave agrupa conteúdo auxiliar. Divisórias de 1 px e espaço vertical organizam as páginas. O cabeçalho e o rodapé pertencem ao Prêmio, com saídas discretas para o portal e o aplicativo.

## Cores e tipo

Reserve carmesim para a ação principal, seleção de navegação, progresso da votação, selo de vencedor e ênfase editorial. Use âmbar em detalhes de ano e categoria, com o tom mais escuro para rótulos de texto. Use Inter na interface e Instrument Serif em itálico em trechos curtos das manchetes.

## Componentes

- As molduras de participantes e vencedores têm proporção quadrada, fundo neutro e raio de 16 px. Logos e fotos preservam o enquadramento completo. Quando não há imagem, a inicial ocupa a mesma moldura.
- O histórico agrupa os resultados públicos por ano e categoria. O seletor mantém o ano atual visível e acessível por teclado.
- Na votação, a barra fina comunica o progresso. A escolha e a confirmação ficam na mesma tela. O modal de conclusão devolve o foco à página ao fechar.
- A transparência usa divisórias, classificação e detalhes expansíveis. A versão de impressão prioriza o relatório e conserva os dados públicos selecionados.

A base está em `assets/css/melhores-public.css`. Votação, indicação e transparência têm folhas próprias com os mesmos tokens.
