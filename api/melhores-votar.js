const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const HASH_SECRET = process.env.MELHORES_VOTO_SECRET || "";
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || "";

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
  return found ? decodeURIComponent(found.slice(name.length + 1)) : "";
};
const hash = value => crypto.createHmac("sha256", HASH_SECRET).update(String(value)).digest("hex");
const cookie = value => `euam_melhores_vid=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`;

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
  return { ok: data.success === true, reason: data["error-codes"]?.join(",") || "invalid-token" };
}

async function handleCleanup(req, res) {
  const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
  const fromVercelCron = getHeader(req, "x-vercel-cron") === "1";
  const secret = process.env.MELHORES_CRON_SECRET || process.env.CRON_SECRET || "";
  const provided = url.searchParams.get("secret") || "";
  if (!fromVercelCron && (!secret || provided !== secret)) {
    return json(res, 404, { ok: false, message: "Rotina não encontrada." });
  }
  const total = await rest("rpc/melhores_limpar_votos_expirados", { method: "POST", body: {} });
  return json(res, 200, {
    ok: true,
    rotina: "melhores_limpar_votos_expirados",
    edicoes_limpas: Number(total || 0),
    executado_em: new Date().toISOString()
  });
}

function votingOpen(edition) {
  const now = Date.now();
  const start = edition.votacao_inicio ? new Date(edition.votacao_inicio).getTime() : 0;
  const end = edition.votacao_fim ? new Date(edition.votacao_fim).getTime() : Infinity;
  return edition.status === "votacao_aberta" && start <= now && now <= end;
}

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", `https://${req.headers.host || "localhost"}`);
    if (url.searchParams.get("cron") === "limpeza") {
      try {
        return await handleCleanup(req, res);
      } catch (error) {
        console.error("melhores-limpeza:", error);
        return json(res, 500, { ok: false, message: "Não foi possível executar a limpeza automática." });
      }
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
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const edicaoId = String(payload.edicao_id || "");
    const categoriaId = String(payload.categoria_id || "");
    const indicadoId = String(payload.indicado_id || "");
    if (![edicaoId, categoriaId, indicadoId].every(v => uuidRe.test(v))) {
      return json(res, 400, { ok: false, message: "Voto inválido." });
    }

    let visitor = cookieValue(req, "euam_melhores_vid");
    const newVisitor = !visitor;
    if (!visitor) visitor = crypto.randomUUID();

    const ua = getHeader(req, "user-agent").slice(0, 260);
    const ip = firstIp(req);
    const turnstile = await verifyTurnstile(payload.turnstile_token || payload.cf_turnstile_response, ip);
    if (!turnstile.ok) {
      return json(res, 403, { ok: false, message: "Confirmação de segurança inválida. Atualize a página e tente novamente." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }
    const identifier = hash([edicaoId, categoriaId, visitor, ip, ua].join("|"));
    const uaHash = hash(ua || "sem-user-agent");

    const [edition] = await rest(`melhores_edicoes?select=id,status,votacao_inicio,votacao_fim,encerramento_em&limit=1&id=eq.${edicaoId}`);
    if (!edition || !votingOpen(edition)) {
      return json(res, 403, { ok: false, message: "A votação não está aberta neste momento." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }

    const [category] = await rest(`melhores_categorias?select=id,edicao_id,status,visibilidade_publica,permite_multiplos_votos,max_escolhas&limit=1&id=eq.${categoriaId}&edicao_id=eq.${edicaoId}`);
    if (!category || category.status !== "ativo" || category.visibilidade_publica !== true) {
      return json(res, 400, { ok: false, message: "Categoria indisponível para votação." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }

    const [nominee] = await rest(`melhores_indicados?select=id,edicao_id,categoria_id,status,aprovado&limit=1&id=eq.${indicadoId}&categoria_id=eq.${categoriaId}&edicao_id=eq.${edicaoId}`);
    if (!nominee || nominee.status !== "ativo" || nominee.aprovado !== true) {
      return json(res, 400, { ok: false, message: "Indicado indisponível para votação." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const recent = await rest(`melhores_votos?select=id,status&edicao_id=eq.${edicaoId}&identificador_hash=eq.${identifier}&criado_em=gte.${encodeURIComponent(tenMinutesAgo)}&limit=40`);
    const status = recent.length > 30 ? "bloqueado" : recent.length > 20 ? "suspeito" : "valido";
    const previousVotes = await rest(`melhores_votos?select=id,indicado_id,status&edicao_id=eq.${edicaoId}&categoria_id=eq.${categoriaId}&identificador_hash=eq.${identifier}&status=in.(valido,suspeito)&limit=20`);
    if (previousVotes.some(v => v.indicado_id === indicadoId)) {
      return json(res, 409, { ok: false, message: "Você já votou neste indicado." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }
    const maxChoices = category.permite_multiplos_votos ? Math.max(1, Number(category.max_escolhas || 1)) : 1;
    if (previousVotes.length >= maxChoices) {
      return json(res, 409, { ok: false, message: category.permite_multiplos_votos ? `Você já atingiu o limite de ${maxChoices} escolha(s) nesta categoria.` : "Você já votou nesta categoria." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }
    if (status === "bloqueado") {
      await rest("melhores_votos", {
        method: "POST",
        body: [{
          edicao_id: edicaoId,
          categoria_id: categoriaId,
          indicado_id: indicadoId,
          identificador_hash: identifier,
          user_agent_hash: uaHash,
          origem: "site",
          status: "bloqueado",
          motivo_bloqueio: "muitas_tentativas",
          metadados: { pagina: payload.pagina || null }
        }]
      }).catch(() => null);
      return json(res, 429, { ok: false, message: "Muitas tentativas em sequência. Tente novamente mais tarde." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }

    const [vote] = await rest("melhores_votos", {
      method: "POST",
      body: [{
        edicao_id: edicaoId,
        categoria_id: categoriaId,
        indicado_id: indicadoId,
        identificador_hash: identifier,
        user_agent_hash: uaHash,
        origem: "site",
        status,
        metadados: {
          pagina: payload.pagina || null,
          ip_hash: hash(ip || "sem-ip"),
          accept_language_hash: hash(getHeader(req, "accept-language") || "sem-idioma"),
          vercel_country: getHeader(req, "x-vercel-ip-country") || null,
          turnstile: "validado"
        }
      }]
    });

    return json(res, 200, {
      ok: true,
      voto_id: vote.id,
      status,
      message: status === "suspeito" ? "Voto recebido para revisão." : "Voto registrado com sucesso."
    }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
  } catch (error) {
    if (error.status === 409 || String(error.details?.message || "").includes("duplicate key")) {
      return json(res, 409, { ok: false, message: "Você já votou nesta categoria." });
    }
    console.error("melhores-votar:", error);
    return json(res, 500, { ok: false, message: "Não foi possível registrar o voto agora." });
  }
};
