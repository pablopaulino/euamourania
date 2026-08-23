import { getSupabase, supabaseConfigurado } from "../services/supabaseClient.js";
import { TURNSTILE_SITE_KEY } from "../supabase-config.js";

const RATE_LIMIT_KEY = "euamourania:public-submissions";
const MAX_SUBMISSIONS_PER_HOUR = 3;
const TERMS_VERSION = "public-submissions-no-media-v1";
const turnstileSiteKey = () => window.EUAM_TURNSTILE_SITE_KEY
  || document.querySelector('meta[name="turnstile-site-key"]')?.getAttribute("content")
  || TURNSTILE_SITE_KEY;
let turnstileLoadPromise;
let turnstileWidgetId = null;

const form = document.querySelector("[data-submission-form]");
const result = document.querySelector("[data-submission-result]");
const categorySelect = document.querySelector("[data-category-select]");

function normalizeText(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function nullable(value = "") {
  const text = normalizeText(value);
  return text || null;
}

function getFormType() {
  return form?.dataset.submissionForm === "business" ? "business" : "event";
}

function setResult(type, message) {
  if (!result) return;
  result.className = `submission-result is-visible ${type}`;
  result.textContent = message;
}

function readRateLimit() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const since = Date.now() - 60 * 60 * 1000;
    return Array.isArray(parsed) ? parsed.filter((item) => Number(item) > since) : [];
  } catch {
    return [];
  }
}

function assertRateLimit() {
  const recent = readRateLimit();
  if (recent.length >= MAX_SUBMISSIONS_PER_HOUR) {
    throw new Error("Muitos envios em pouco tempo. Tente novamente mais tarde.");
  }
}

function recordSubmissionAttempt() {
  const recent = readRateLimit();
  recent.push(Date.now());
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent));
}

function loadTurnstile() {
  if (!turnstileSiteKey()) return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (turnstileLoadPromise) return turnstileLoadPromise;
  turnstileLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Não foi possível carregar a verificação de segurança."));
    document.head.append(script);
  });
  return turnstileLoadPromise;
}

async function getTurnstileToken(action = "public_submission") {
  const sitekey = turnstileSiteKey();
  if (!sitekey) throw new Error("Verificação de segurança indisponível.");
  await loadTurnstile();
  return new Promise((resolve, reject) => {
    let container = document.getElementById("public-submission-turnstile");
    if (!container) {
      container = document.createElement("div");
      container.id = "public-submission-turnstile";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "1px";
      container.style.height = "1px";
      document.body.append(container);
    }
    if (turnstileWidgetId !== null) {
      try { window.turnstile.remove(turnstileWidgetId); } catch {}
      turnstileWidgetId = null;
    }
    const timeout = setTimeout(() => reject(new Error("A verificação demorou demais. Tente novamente.")), 15000);
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey,
      size: "invisible",
      action,
      callback: token => {
        clearTimeout(timeout);
        resolve(token);
      },
      "error-callback": () => {
        clearTimeout(timeout);
        reject(new Error("Confirmação de segurança inválida. Atualize a página e tente novamente."));
      },
      "expired-callback": () => {
        clearTimeout(timeout);
        reject(new Error("A confirmação de segurança expirou. Tente novamente."));
      }
    });
    window.turnstile.execute(turnstileWidgetId);
  });
}

function getValue(formData, key) {
  return normalizeText(formData.get(key) || "");
}

function getSelectedCategory() {
  if (!categorySelect?.value) {
    return { categoria_id: null, categoria_nome: null };
  }
  const option = categorySelect.selectedOptions?.[0];
  return {
    categoria_id: categorySelect.value,
    categoria_nome: option?.dataset.nome || option?.textContent?.trim() || null
  };
}

function validateUrl(value, label) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${label} precisa ser um link válido começando com http:// ou https://.`);
  }
}

function validateCommon(formData) {
  if (getValue(formData, "website")) {
    throw new Error("Não foi possível enviar este cadastro.");
  }
  if (formData.get("consent") !== "on") {
    throw new Error("Confirme a declaração de veracidade antes de enviar.");
  }
  const submitterName = getValue(formData, "submitter_name");
  const submitterEmail = getValue(formData, "submitter_email");
  if (!submitterName || submitterName.length < 3) {
    throw new Error("Informe seu nome para que a equipe possa revisar o cadastro.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new Error("Informe um e-mail válido.");
  }
}

function buildEventPayload(formData) {
  validateCommon(formData);
  const titulo = getValue(formData, "titulo");
  const descricao = getValue(formData, "descricao");
  const dataInicio = getValue(formData, "data_inicio");
  if (!titulo || titulo.length < 3) throw new Error("Informe o nome do evento.");
  if (!descricao || descricao.length < 20) throw new Error("Descreva o evento com pelo menos 20 caracteres.");
  if (!dataInicio) throw new Error("Informe a data de início do evento.");
  const category = getSelectedCategory();
  return {
    titulo,
    descricao,
    data_inicio: dataInicio,
    data_fim: nullable(formData.get("data_fim")),
    horario: nullable(formData.get("horario")),
    local: nullable(formData.get("local")),
    endereco: nullable(formData.get("endereco")),
    organizador: nullable(formData.get("organizador")),
    whatsapp: nullable(formData.get("whatsapp")),
    telefone: nullable(formData.get("telefone")),
    site: validateUrl(nullable(formData.get("site")), "Site do evento"),
    instagram: nullable(formData.get("instagram")),
    categoria_id: category.categoria_id,
    categoria_nome: category.categoria_nome,
    submitter_name: getValue(formData, "submitter_name"),
    submitter_email: getValue(formData, "submitter_email"),
    submitter_phone: nullable(formData.get("submitter_phone")),
    status: "pending",
    terms_version: TERMS_VERSION,
    terms_accepted_at: new Date().toISOString(),
    submitted_payload: { form: "event", version: 1, media_upload: false }
  };
}

function buildBusinessPayload(formData) {
  validateCommon(formData);
  const nome = getValue(formData, "nome");
  const descricao = getValue(formData, "descricao");
  if (!nome || nome.length < 3) throw new Error("Informe o nome da empresa.");
  if (!descricao || descricao.length < 20) throw new Error("Descreva a empresa com pelo menos 20 caracteres.");
  const category = getSelectedCategory();
  return {
    nome,
    descricao,
    categoria_id: category.categoria_id,
    categoria_nome: category.categoria_nome,
    whatsapp: nullable(formData.get("whatsapp")),
    telefone: nullable(formData.get("telefone")),
    instagram: nullable(formData.get("instagram")),
    facebook: nullable(formData.get("facebook")),
    site: validateUrl(nullable(formData.get("site")), "Site da empresa"),
    endereco: nullable(formData.get("endereco")),
    horario: nullable(formData.get("horario")),
    responsavel_nome: nullable(formData.get("responsavel_nome")),
    submitter_name: getValue(formData, "submitter_name"),
    submitter_email: getValue(formData, "submitter_email"),
    submitter_phone: nullable(formData.get("submitter_phone")),
    status: "pending",
    terms_version: TERMS_VERSION,
    terms_accepted_at: new Date().toISOString(),
    submitted_payload: { form: "business", version: 1, media_upload: false }
  };
}

async function loadCategories() {
  if (!categorySelect || !supabaseConfigurado()) return;
  const type = getFormType() === "business" ? "guia" : "eventos";
  const { data, error } = await getSupabase()
    .from("categorias")
    .select("id,nome")
    .eq("tipo", type)
    .eq("status", "ativo")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) {
    console.warn("Não foi possível carregar categorias públicas.", error.message);
    return;
  }
  const options = (data || [])
    .map((category) => `<option value="${category.id}" data-nome="${category.nome}">${category.nome}</option>`)
    .join("");
  categorySelect.insertAdjacentHTML("beforeend", options);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!form) return;
  if (!supabaseConfigurado() || !turnstileSiteKey()) {
    setResult("error", "O envio ainda não está configurado. Tente novamente mais tarde.");
    return;
  }
  const button = form.querySelector("button[type='submit']");
  try {
    assertRateLimit();
    button.disabled = true;
    button.textContent = "Enviando…";
    const formData = new FormData(form);
    const type = getFormType();
    const payload = type === "business" ? buildBusinessPayload(formData) : buildEventPayload(formData);
    const turnstileToken = await getTurnstileToken(type === "business" ? "business_submission" : "event_submission");
    const response = await fetch("/api/home?acao=public-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload, turnstile_token: turnstileToken })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.message || "Não foi possível enviar agora. Tente novamente em instantes.");
    }
    recordSubmissionAttempt();
    form.reset();
    setResult("success", data.message || "Cadastro enviado para análise. A equipe vai revisar as informações antes da publicação.");
  } catch (error) {
    setResult("error", error?.message || "Não foi possível enviar agora. Tente novamente em instantes.");
  } finally {
    button.disabled = false;
    button.textContent = form.dataset.submitLabel || "Enviar para análise";
  }
}

loadCategories();
form?.addEventListener("submit", handleSubmit);
