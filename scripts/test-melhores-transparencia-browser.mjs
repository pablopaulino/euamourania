import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from '../outputs/catalogos-tools/node_modules/playwright/index.mjs';
const server=createServer(async(req,res)=>{try {const path=new URL(req.url,'http://localhost').pathname;if(path==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="results"></main></body></html>');return;}const file=await readFile('.'+path);res.writeHead(200,{'Content-Type':path.endsWith('.css')?'text/css':'text/javascript'});res.end(file);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const page=await browser.newPage({viewport:{width:375,height:812}}); await page.goto(base);
 await page.evaluate(async()=>{const {montarCentralTransparencia}=await import('/assets/js/pages/melhores-transparencia.js');window.render=(rows,edition={ano:2026,peso_site:60,peso_instagram:40})=>{document.querySelector('#results').innerHTML='';montarCentralTransparencia(document.querySelector('#results'),edition,rows);};});
 const baseRow={categoria_id:'a',colocacao:1,vencedor:true,melhores_categorias:{nome:'Comércio'},melhores_indicados:{nome:'Primeiro'},votos_site:1,votos_instagram:0,percentual_site:100,percentual_instagram:0,pontuacao_final:60,publicado_em:'2026-12-04T12:00:00Z'};
 const second={...baseRow,colocacao:2,vencedor:false,melhores_indicados:{nome:'Segundo'},votos_site:0,percentual_site:0,pontuacao_final:0};
 const other={...baseRow,categoria_id:'b',melhores_categorias:{nome:'Serviços'}};
 await page.evaluate(rows=>window.render(rows),[baseRow,second,other]);
 await page.waitForFunction(() => !!document.querySelector('#trans-styles')?.sheet);
 assert.equal(await page.locator('.trans-selected li').count(),2);
 assert.match(await page.locator('.trans-selected').innerText(),/Diferença para a posição anterior: 60 p.p./);
 await page.locator('.trans-memory summary').first().click(); assert.match(await page.locator('.trans-memory').first().innerText(),/60%/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'layout móvel sem rolagem horizontal');
 await page.selectOption('#trans-select','b'); assert.match(await page.locator('.trans-selected').innerText(),/Serviços/);
 await page.evaluate(()=>{window.print=()=>{window.printState={all:document.querySelector('.trans-central').classList.contains('trans-print-all'),open:[...document.querySelectorAll('details')].every(x=>x.open)};};});
 await page.locator('[data-print="all"]').click(); assert.deepEqual(await page.evaluate(()=>window.printState),{all:true,open:true});
 await page.locator('[data-print="category"]').click(); assert.deepEqual(await page.evaluate(()=>window.printState),{all:false,open:true});
 await page.emulateMedia({media:'print'}); const pdf=await page.pdf({format:'A4',printBackground:true}); assert.ok(pdf.length>1000); await page.emulateMedia({media:'screen'});
 await page.evaluate(rows=>window.render(rows),[{...baseRow,votos_site:null,percentual_site:null,pontuacao_final:null}]); assert.match(await page.locator('.trans-central').innerText(),/Indisponível/); assert.equal(await page.locator('.trans-track').count(),0);
 await page.evaluate(()=>window.render([],{ano:2026,peso_site:60,peso_instagram:40,resultado_publicado_em:'2026-01-01'})); await page.locator('.trans-panel summary').last().click(); assert.match(await page.locator('.trans-central').innerText(),/Nenhuma publicação oficial disponível/);
 console.log('Navegador: ranking, zero, dados ocultos, data, mobile e impressão/PDF validados.');
} finally {await browser.close();server.close();}

