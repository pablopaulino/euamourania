#!/usr/bin/env node
/**
 * Teste isolado da chamada real ao Gemini.
 * Lê duas páginas públicas, chama redigir() e imprime o JSON resultante.
 * NÃO salva nada no banco. NÃO exige banco configurado.
 *
 * Uso:
 *   GEMINI_API_KEY=<chave> GEMINI_MODEL=gemini-2.5-flash-lite GEMINI_FREE_TIER_CONFIRMED=true \
 *     node scripts/test-gemini-real.mjs
 *
 * Ou coloque as variáveis no arquivo .env.local (nunca comite esse arquivo).
 *
 * Fontes usadas: páginas públicas da Câmara Municipal de Urânia (robots.txt permissivo)
 * com conteúdo verificável e sem informações privadas.
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Carrega .env.local se existir (sem dependência de dotenv)
const envPath = join(__dir, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const apiKey = process.env.GEMINI_API_KEY;
const model  = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const confirmed = process.env.GEMINI_FREE_TIER_CONFIRMED === 'true';

if (!apiKey) {
  console.error(`
GEMINI_API_KEY não encontrada.

Configure-a de uma das seguintes formas (nunca no código):

  1. Variável de ambiente na sessão:
       $env:GEMINI_API_KEY = "sua-chave"
       $env:GEMINI_MODEL = "gemini-2.5-flash-lite"
       $env:GEMINI_FREE_TIER_CONFIRMED = "true"
       node scripts/test-gemini-real.mjs

  2. Arquivo .env.local na raiz do projeto (adicione ao .gitignore se não estiver):
       GEMINI_API_KEY=sua-chave
       GEMINI_MODEL=gemini-2.5-flash-lite
       GEMINI_FREE_TIER_CONFIRMED=true

  A chave deve pertencer a um projeto Google AI Studio SEM faturamento vinculado.
  Confirme em https://aistudio.google.com que o projeto usa a faixa gratuita.
`);
  process.exit(1);
}

if (!confirmed) {
  console.error('Configure GEMINI_FREE_TIER_CONFIRMED=true após confirmar que o projeto não tem faturamento.');
  process.exit(1);
}

const { lerPagina } = require('../lib/editorial-fontes');
const { redigir }   = require('../lib/editorial-redacao');

// Fontes públicas para o teste: páginas verificáveis da Câmara de Urânia e
// do site da Prefeitura. Se ambas estiverem inacessíveis no momento, o script
// informa o erro sem chamar o Gemini.
// Substitua por URLs recentes que tenham publicado_em e texto suficiente.
const URLS_TESTE = [
  'https://urania.sp.leg.br',         // página principal — será trocada por link real abaixo
  'https://www.urania.sp.gov.br',     // prefeitura
];

console.log('=== Teste real do Gemini — sem gravação no banco ===\n');
console.log(`Modelo: ${model}`);
console.log(`Fontes de teste: ${URLS_TESTE.join(', ')}\n`);

async function main() {
  // Passo 1: leitura das páginas
  const lidas = [];
  for (const url of URLS_TESTE) {
    process.stdout.write(`Lendo ${url} … `);
    try {
      const page = await lerPagina(url);
      lidas.push(page);
      console.log(`OK (${page.texto.length} chars, publicado_em: ${page.publicado_em ?? 'não encontrado'})`);
    } catch (err) {
      console.log(`FALHOU: ${err.message}`);
    }
  }

  if (lidas.length === 0) {
    console.error('\nNenhuma página lida com sucesso. Verifique as URLs e a conexão.');
    process.exit(1);
  }

  // Passo 2: verificar elegibilidade (sem salvar)
  const { elegivel } = require('../lib/editorial-pautas');
  const elegiveis = lidas.filter(p => elegivel(p));
  console.log(`\nPáginas lidas: ${lidas.length} | Elegíveis: ${elegiveis.length}`);

  if (elegiveis.length === 0) {
    console.log('\nNenhuma página elegível (sem data recente ou texto insuficiente ou sem menção a Urânia).');
    console.log('Ajuste URLS_TESTE para páginas com data de publicação reconhecível e conteúdo sobre Urânia.');
    process.exit(0);
  }

  // As URLs deste teste manual são comunicados da Câmara de Urânia.
  const oficial=elegiveis.find(p=>['urania.sp.leg.br','www.urania.sp.leg.br'].includes(new URL(p.url).hostname));
  if(!oficial) throw Error('Informe uma página oficial da Câmara para este teste.');
  const fontesParaRedacao=[oficial],fonteUnicaOficial=true;

  // Passo 4: chamada real ao Gemini
  console.log('\nChamando Gemini … (pode levar até 45 s)');
  const inicio = Date.now();
  try {
    const draft = await redigir({ fontes: fontesParaRedacao, apiKey, model, fonteUnicaOficial });
    const elapsed = ((Date.now() - inicio) / 1000).toFixed(1);
    console.log(`\nResposta recebida em ${elapsed}s\n`);

    if (!draft) {
      console.log('Resultado: modelo classificou como informação insuficiente (apta: false). Nenhum rascunho seria criado.');
      process.exit(0);
    }

    console.log('=== RASCUNHO GERADO (não salvo) ===\n');
    console.log('Título:         ', draft.titulo);
    console.log('Resumo:         ', draft.resumo);
    console.log('SEO título:     ', draft.titulo_seo);
    console.log('SEO descrição:  ', draft.descricao_seo);
    console.log('Categoria:      ', draft.categoria);
    console.log('Revisão reforçada:', draft.revisao_reforcada);
    console.log('Pendências:     ', draft.pendencias.join('; '));
    console.log('Fontes usadas:  ', draft.fontes.map(f => f.url).join(', '));
    console.log('\nConteúdo HTML:\n');
    console.log(draft.conteudo_html);
    console.log('\n=== FIM DO RASCUNHO ===');
    console.log('\nNenhum dado foi salvo. Para criar rascunho real, use o botão "Executar agora" no painel.');
  } catch (err) {
    console.error(`\nErro na chamada ao Gemini: ${err.message}`);
    if (err.code === 'GEMINI_QUOTA') console.error('Cota atingida. Aguarde antes de nova tentativa.');
    process.exit(1);
  }
}

main();
