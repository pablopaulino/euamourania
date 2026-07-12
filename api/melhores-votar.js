const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const HASH_SECRET = process.env.MELHORES_VOTO_SECRET || SERVICE_KEY || "eu-amourania-melhores";

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

function votingOpen(edition) {
  const now = Date.now();
  const start = edition.votacao_inicio ? new Date(edition.votacao_inicio).getTime() : 0;
  const end = edition.votacao_fim ? new Date(edition.votacao_fim).getTime() : Infinity;
  return edition.status === "votacao_aberta" && start <= now && now <= end;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, message: "Método não permitido." });
  }
  try {
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
    const identifier = hash([edicaoId, categoriaId, visitor, ip, ua].join("|"));
    const uaHash = hash(ua || "sem-user-agent");

    const [edition] = await rest(`melhores_edicoes?select=id,status,votacao_inicio,votacao_fim,encerramento_em&limit=1&id=eq.${edicaoId}`);
    if (!edition || !votingOpen(edition)) {
      return json(res, 403, { ok: false, message: "A votação não está aberta neste momento." }, newVisitor ? { "Set-Cookie": cookie(visitor) } : {});
    }

    const [category] = await rest(`melhores_categorias?select=id,edicao_id,status,visibilidade_publica&limit=1&id=eq.${categoriaId}&edicao_id=eq.${edicaoId}`);
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
          ip_hash: hash(ip || "sem-ip")
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
