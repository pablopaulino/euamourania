const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";
const RATE_SECRET = process.env.PUBLIC_SUBMISSION_RATE_SECRET || SERVICE_KEY || "euamourania-public-submissions";

const TERMS_VERSION = "public-submissions-no-media-v1";
const MAX_SUBMISSIONS_PER_HOUR = 3;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const clean = (value, max = 500) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const nullable = (value, max = 500) => {
  const text = clean(value, max);
  return text || null;
};
const nullableUuid = value => {
  const text = clean(value, 80);
  return uuidRe.test(text) ? text : null;
};
const firstIp = req => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
const hash = value => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const ipHash = req => hash(`${RATE_SECRET}|${firstIp(req)}|${req.headers["user-agent"] || ""}`);

async function rest(path, { method = "GET", body } = {}) {
  if (!SERVICE_KEY) throw Object.assign(new Error("SUPABASE_SERVICE_ROLE_KEY ausente."), { status: 503 });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || `Supabase ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) return { ok: false, reason: "missing-turnstile-secret" };
  if (!token) return { ok: false, reason: "missing-token" };
  const body = new URLSearchParams();
  body.set("secret", TURNSTILE_SECRET);
  body.set("response", String(token));
  body.set("remoteip", ip || "");
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({}));
  return { ok: data.success === true, reason: data["error-codes"]?.join(",") || "invalid-token" };
}

function assertEmail(value) {
  const email = clean(value, 180);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Informe um e-mail válido."), { status: 400 });
  }
  return email;
}

function assertUrl(value, label) {
  const text = clean(value, 500);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw Object.assign(new Error(`${label} precisa começar com http:// ou https://.`), { status: 400 });
  }
}

function assertText(value, min, max, label) {
  const text = clean(value, max);
  if (text.length < min) {
    throw Object.assign(new Error(label), { status: 400 });
  }
  return text;
}

function basePayload(payload, form) {
  return {
    submitter_name: assertText(payload.submitter_name, 3, 180, "Informe seu nome para revisão."),
    submitter_email: assertEmail(payload.submitter_email),
    submitter_phone: nullable(payload.submitter_phone, 80),
    status: "pending",
    terms_version: TERMS_VERSION,
    terms_accepted_at: new Date().toISOString(),
    submitted_payload: { form, version: 1, media_upload: false, source: "api" }
  };
}

function buildBusinessPayload(payload) {
  return {
    nome: assertText(payload.nome, 3, 180, "Informe o nome da empresa."),
    descricao: assertText(payload.descricao, 20, 4000, "Descreva a empresa com pelo menos 20 caracteres."),
    categoria_id: nullableUuid(payload.categoria_id),
    categoria_nome: nullable(payload.categoria_nome, 180),
    whatsapp: nullable(payload.whatsapp, 80),
    telefone: nullable(payload.telefone, 80),
    instagram: nullable(payload.instagram, 120),
    facebook: nullable(payload.facebook, 240),
    site: assertUrl(payload.site, "Site da empresa"),
    endereco: nullable(payload.endereco, 500),
    horario: nullable(payload.horario, 500),
    responsavel_nome: nullable(payload.responsavel_nome, 180),
    ...basePayload(payload, "business")
  };
}

function buildEventPayload(payload) {
  const dataInicio = clean(payload.data_inicio, 80);
  if (!dataInicio || Number.isNaN(new Date(dataInicio).getTime())) {
    throw Object.assign(new Error("Informe uma data de início válida."), { status: 400 });
  }
  const dataFim = clean(payload.data_fim, 80);
  return {
    titulo: assertText(payload.titulo, 3, 180, "Informe o nome do evento."),
    descricao: assertText(payload.descricao, 20, 4000, "Descreva o evento com pelo menos 20 caracteres."),
    data_inicio: new Date(dataInicio).toISOString(),
    data_fim: dataFim && !Number.isNaN(new Date(dataFim).getTime()) ? new Date(dataFim).toISOString() : null,
    horario: nullable(payload.horario, 500),
    local: nullable(payload.local, 220),
    endereco: nullable(payload.endereco, 500),
    organizador: nullable(payload.organizador, 180),
    whatsapp: nullable(payload.whatsapp, 80),
    telefone: nullable(payload.telefone, 80),
    site: assertUrl(payload.site, "Site do evento"),
    instagram: nullable(payload.instagram, 120),
    categoria_id: nullableUuid(payload.categoria_id),
    categoria_nome: nullable(payload.categoria_nome, 180),
    ...basePayload(payload, "event")
  };
}

async function assertRateLimit(req, formType) {
  const hashedIp = ipHash(req);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const attempts = await rest(`public_submission_attempts?select=id&ip_hash=eq.${hashedIp}&created_at=gte.${encodeURIComponent(since)}&limit=${MAX_SUBMISSIONS_PER_HOUR + 1}`);
  if ((attempts || []).length >= MAX_SUBMISSIONS_PER_HOUR) {
    throw Object.assign(new Error("Muitos envios em pouco tempo. Tente novamente mais tarde."), { status: 429 });
  }
  await rest("public_submission_attempts", {
    method: "POST",
    body: [{ ip_hash: hashedIp, form_type: formType }]
  });
}

async function handlePublicSubmission(req) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const type = body.type === "business" ? "business" : "event";
  const payload = body.payload || {};
  const honeypot = clean(payload.website || payload.url_oculta, 200);
  if (honeypot) return { status: 200, body: { ok: true, message: "Cadastro enviado para análise." } };

  if (!TURNSTILE_SECRET) {
    console.error("public-submission: TURNSTILE_SECRET_KEY ausente.");
    return { status: 503, body: { ok: false, message: "Verificação de segurança ausente. Tente novamente mais tarde." } };
  }
  const turnstile = await verifyTurnstile(body.turnstile_token || body.cf_turnstile_response, firstIp(req));
  if (!turnstile.ok) {
    return { status: 403, body: { ok: false, message: "Confirmação de segurança inválida. Atualize a página e tente novamente." } };
  }

  await assertRateLimit(req, type);
  const table = type === "business" ? "business_submissions" : "event_submissions";
  const record = type === "business" ? buildBusinessPayload(payload) : buildEventPayload(payload);
  await rest(table, { method: "POST", body: [record] });
  return {
    status: 200,
    body: {
      ok: true,
      message: "Cadastro enviado para análise. A equipe vai revisar as informações antes da publicação."
    }
  };
}

module.exports = { handlePublicSubmission };
