const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const HASH_SECRET = process.env.MELHORES_VOTO_SECRET || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";
const TURNSTILE_HOSTNAMES = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "euamourania.com.br,www.euamourania.com.br,melhores.euamourania.com.br")
  .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (res, status, body, headers = {}) => {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).send(JSON.stringify(body));
};
const getHeader = (req, name) => String(req.headers[name.toLowerCase()] || "");
const firstIp = req => (getHeader(req, "x-forwarded-for").split(",")[0] || req.socket?.remoteAddress || "").trim();
const cookieValue = (req, name) => {
  const cookie = getHeader(req, "cookie");
  const found = cookie.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  try { return found ? decodeURIComponent(found.slice(name.length + 1)) : ""; }
  catch { return ""; }
};
const hash = value => crypto.createHmac("sha256", HASH_SECRET).update(String(value)).digest("hex");
const cookie = value => `euam_melhores_vid=${encodeURIComponent(`${value}.${hash(`visitor:${value}`)}`)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`;

async function rest(path, { method = "GET", body } = {}) {
  if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  if (method === "POST") headers.Prefer = "return=representation";
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || `Supabase ${response.status}`);
    error.status = response.status;
    error.details = data;
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
  const hostname = String(data.hostname || "").toLowerCase();
  return {
    ok: data.success === true && data.action === "vote" && TURNSTILE_HOSTNAMES.includes(hostname),
    reason: data["error-codes"]?.join(",") || "invalid-token"
  };
}

async function handleCleanup(req, res) {
  const secret = process.env.CRON_SECRET || process.env.MELHORES_CRON_SECRET || "";
  const provided = getHeader(req, "authorization");
  const expected = secret ? `Bearer ${secret}` : "";
  if (!expected || provided.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return json(res, 404, { ok: false, message: "Rotina não encontrada." });
  }
  const total = await rest("rpc/melhores_limpar_votos_expirados", { method: "POST", body: {} });
  await rest("rpc/melhores_voto_rate_limpar", { method: "POST", body: {} });
  return json(res, 200, {
    ok: true,
    rotina: "melhores_limpar_votos_expirados",
    edicoes_limpas: Number(total || 0),
    executado_em: new Date().toISOString()
  });
}

function votingOpen(edition) {
  const now = Date.now();
  const start = edition.votacao_inicio_site ? new Date(edition.votacao_inicio_site).getTime() : Infinity;
  const end = edition.votacao_fim ? new Date(edition.votacao_fim).getTime() : -Infinity;
  return edition.status === "votacao_aberta" && start <= now && now <= end;
}

const visitorFromRequest = req => {
  const [value, signature] = cookieValue(req, "euam_melhores_vid").split(".");
  if (uuidRe.test(value || "") && /^[a-f0-9]{64}$/.test(signature || "")) {
    const expected = hash(`visitor:${value}`);
    if (crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))) return value;
  }
  return crypto.randomUUID();
};

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    if (url.searchParams.get("cron") === "limpeza") {
      try {
        return await handleCleanup(req, res);
      } catch (error) {
        console.error("melhores-limpeza:", error?.message || error);
        return json(res, 500, { ok: false, message: "Não foi possível executar a limpeza automática." });
      }
    }
    const edicaoId = url.searchParams.get("edicao_id") || "";
    if (!uuidRe.test(edicaoId)) return json(res, 400, { ok: false, message: "Edição inválida." });
    if (!HASH_SECRET) return json(res, 503, { ok: false, message: "Votação temporariamente indisponível." });
    try {
      const [edition] = await rest(`melhores_edicoes?select=id,status,votacao_inicio,votacao_inicio_site,votacao_fim&limit=1&id=eq.${edicaoId}`);
      if (!edition) return json(res, 404, { ok: false, message: "Edição não encontrada." });
      const visitor = visitorFromRequest(req);
      const identifier = hash([edicaoId, visitor].join("|"));
      const votos = await rest(`melhores_votos?select=categoria_id,indicado_id&edicao_id=eq.${edicaoId}&identificador_hash=eq.${identifier}&origem=eq.site&status=in.(valido,suspeito)`);
      return json(res, 200, { ok: true, agora: new Date().toISOString(),
        status: edition.status, votacao_inicio_app: edition.votacao_inicio,
        votacao_inicio_site: edition.votacao_inicio_site, votacao_fim: edition.votacao_fim,
        votacao_site_aberta: votingOpen(edition), votos_site: votos },
      { "Set-Cookie": cookie(visitor), "Cache-Control": "no-store" });
    } catch (error) {
      console.error("melhores-status:", error?.message || error);
      return json(res, 503, { ok: false, message: "Não foi possível consultar o período de votação." });
    }
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, message: "Método não permitido." });
  }
  try {
    if (!HASH_SECRET) {
      console.error("melhores-votar: MELHORES_VOTO_SECRET ausente.");
      return json(res, 500, { ok: false, message: "Votação temporariamente indisponível. Configuração de segurança ausente." });
    }
    if (!TURNSTILE_SECRET) {
      console.error("melhores-votar: TURNSTILE_SECRET_KEY ausente.");
      return json(res, 500, { ok: false, message: "Votação temporariamente indisponível. Verificação de segurança ausente." });
    }
    let payload;
    try { payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
    catch { return json(res, 400, { ok: false, message: "Requisição inválida." }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json(res, 400, { ok: false, message: "Requisição inválida." });
    }
    const edicaoId = String(payload.edicao_id || "");
    const categoriaId = String(payload.categoria_id || "");
    const indicadoId = String(payload.indicado_id || "");
    if (![edicaoId, categoriaId, indicadoId].every(v => uuidRe.test(v))) {
      return json(res, 400, { ok: false, message: "Voto inválido." });
    }

    const visitor = visitorFromRequest(req);
    const responseHeaders = { "Set-Cookie": cookie(visitor), "Cache-Control": "no-store" };

    const ua = getHeader(req, "user-agent").slice(0, 260);
    const ip = firstIp(req);
    const identifier = hash([edicaoId, visitor].join("|"));
    const uaHash = hash(ua || "sem-user-agent");
    const ipHash = hash(ip || "sem-ip");
    const [visitorAllowed, ipAllowed] = await Promise.all([
      rest("rpc/melhores_voto_rate_check", { method: "POST", body: { p_chave: hash(`voto:visitante:${visitor}`), p_limite: 40, p_janela_segundos: 600 } }),
      ip ? rest("rpc/melhores_voto_rate_check", { method: "POST", body: { p_chave: hash(`voto:ip:${ip}`), p_limite: 200, p_janela_segundos: 600 } }) : Promise.resolve(true)
    ]);
    if (!visitorAllowed || !ipAllowed) {
      return json(res, 429, { ok: false, message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, responseHeaders);
    }
    const turnstile = await verifyTurnstile(payload.turnstile_token || payload.cf_turnstile_response, ip);
    if (!turnstile.ok) {
      return json(res, 403, { ok: false, message: "Confirmação de segurança inválida. Atualize a página e tente novamente." }, responseHeaders);
    }

    const [edition] = await rest(`melhores_edicoes?select=id,status,votacao_inicio_site,votacao_fim&limit=1&id=eq.${edicaoId}`);
    if (!edition || !votingOpen(edition)) {
      return json(res, 403, { ok: false, message: "A votação no site não está aberta neste momento." }, responseHeaders);
    }

    const [category] = await rest(`melhores_categorias?select=id,edicao_id,status,visibilidade_publica,permite_multiplos_votos,max_escolhas&limit=1&id=eq.${categoriaId}&edicao_id=eq.${edicaoId}`);
    if (!category || category.status !== "ativo" || category.visibilidade_publica !== true) {
      return json(res, 400, { ok: false, message: "Categoria indisponível para votação." }, responseHeaders);
    }

    const [nominee] = await rest(`melhores_indicados?select=id,edicao_id,categoria_id,status,aprovado&limit=1&id=eq.${indicadoId}&categoria_id=eq.${categoriaId}&edicao_id=eq.${edicaoId}`);
    if (!nominee || nominee.status !== "ativo" || nominee.aprovado !== true) {
      return json(res, 400, { ok: false, message: "Indicado indisponível para votação." }, responseHeaders);
    }

    const vote = await rest("rpc/melhores_site_registrar_voto", {
      method: "POST",
      body: { p_edicao_id: edicaoId, p_categoria_id: categoriaId,
        p_indicado_id: indicadoId, p_identificador_hash: identifier,
        p_user_agent_hash: uaHash, p_ip_hash: ipHash,
        p_pagina: String(payload.pagina || "").slice(0, 300) }
    });

    return json(res, 200, {
      ok: true,
      voto_id: vote.voto_id,
      status: vote.status,
      ja_registrado: vote.ja_registrado === true,
      message: vote.ja_registrado ? "Seu voto nesta categoria já estava registrado." : "Voto registrado com sucesso."
    }, responseHeaders);
  } catch (error) {
    if (error.details?.code === "23505" || error.status === 409) {
      return json(res, 409, { ok: false, message: "Você já votou nesta categoria." });
    }
    if (error.details?.code === "22023") {
      return json(res, 403, { ok: false, message: error.details.message || "Votação indisponível." });
    }
    console.error("melhores-votar:", error?.message || error);
    return json(res, 500, { ok: false, message: "Não foi possível registrar o voto agora." });
  }
};
