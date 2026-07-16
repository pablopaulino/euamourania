import { callPublicRpc } from "../services/publicDataService.js";

const form = document.getElementById("volunteer-form");
const status = document.getElementById("volunteer-status");

function setStatus(message, type = "") {
  if (!status) return;
  status.textContent = message;
  status.className = `volunteer-message ${type}`.trim();
}

function values() {
  const data = new FormData(form);
  return {
    p_nome: data.get("nome"),
    p_whatsapp: data.get("whatsapp"),
    p_email: data.get("email") || null,
    p_cidade: data.get("cidade") || null,
    p_interesses: data.getAll("interesses"),
    p_mensagem: data.get("mensagem") || null,
    p_aceite_voluntario: data.get("aceite_voluntario") === "on",
    p_website: data.get("website") || null
  };
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter || form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Enviando…";
  setStatus("Enviando cadastro…");
  try {
    const result = await callPublicRpc("enviar_colaboracao_voluntaria", values(), { timeout: 9000 });
    setStatus(result?.message || "Cadastro recebido. Obrigado por querer colaborar voluntariamente.", "ok");
    form.reset();
  } catch (error) {
    setStatus(error.message || "Não foi possível enviar agora. Tente novamente.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Enviar cadastro";
  }
});
