import vm from "node:vm";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("../assets/js/pages/colabore-page.js", import.meta.url), "utf8")).replace(/^import .*;\s*/, "");
let submit, request, reset = 0, fail = false;
const button = { disabled:false, innerHTML:'Enviar cadastro <b>→</b>', textContent:"" };
const status = { textContent:"", className:"" };
const form = { addEventListener(type, fn) { if (type === "submit") submit = fn; }, querySelector() { return button; }, reset() { reset++; } };
class FormDataMock { get(key) { return ({nome:"Ana", whatsapp:"17999999999", aceite_voluntario:"on"})[key] || null; } getAll() { return ["pautas"]; } }
vm.runInNewContext(source, { document:{getElementById:id=>id === "volunteer-form" ? form : status}, FormData:FormDataMock, callPublicRpc:async (...args)=>{ request=args; if(fail) throw new Error("Falha no envio"); return {message:"Recebido"}; } });
assert.equal(typeof submit, "function");
let prevented = false;
await submit({preventDefault(){prevented=true;}, submitter:button});
assert.ok(prevented); assert.equal(request[0], "enviar_colaboracao_voluntaria"); assert.equal(request[1].p_nome, "Ana"); assert.equal(request[1].p_aceite_voluntario, true); assert.equal(reset, 1); assert.equal(status.textContent, "Recebido"); assert.equal(button.disabled, false); assert.equal(button.innerHTML, 'Enviar cadastro <b>→</b>');
fail = true;
await submit({preventDefault(){}, submitter:button});
assert.equal(status.textContent, "Falha no envio"); assert.equal(reset, 1); assert.equal(button.disabled, false);
console.log("Envio de colaboração validado: dados, confirmação, erro e restauração do botão.");
