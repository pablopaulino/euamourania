const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (res, status, body) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).send(JSON.stringify(body));
};
const clean = (value, max = 500) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const emailOrPhone = value => clean(value, 160);
const getHeader = (req, name) => String(req.headers[name.toLowerCase()] || "");
const firstIp = req => (getHeader(req, "x-forwarded-for").split(",")[0] || req.socket?.remoteAddress || "").trim();
const hash = value => crypto.createHash("sha256").update(String(value || "")).digest("hex");

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

function indicationsOpen(edition) {
  const now = Date.now();
  const start = edition.indicacoes_inicio ? new Date(edition.indicacoes_inicio).getTime() : 0;
  const end = edition.indicacoes_fim ? new Date(edition.indicacoes_fim).getTime() : Infinity;
  return edition.status === "indicacoes_abertas" && start <= now && now <= end;
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
    const nomeIndicado = clean(payload.nome_indicado, 160);
    const justificativa = clean(payload.justificativa, 1200);
    const contatoIndicado = emailOrPhone(payload.contato_indicado);
    const nomeResponsavel = clean(payload.nome_responsavel, 160);
    const contatoResponsavel = emailOrPhone(payload.contato_responsavel);
    const aceite = payload.aceite_regulamento === true || payload.aceite_regulamento === "true";

    if (![edicaoId, categoriaId].every(v => uuidRe.test(v))) return json(res, 400, { ok: false, message: "Edição ou categoria inválida." });
    if (nomeIndicado.length < 3) return json(res, 400, { ok: false, message: "Informe o nome indicado." });
    if (justificativa.length < 12) return json(res, 400, { ok: false, message: "Conte rapidamente por que essa indicação merece participar." });
    if (nomeResponsavel.length < 2 || contatoResponsavel.length < 5) return json(res, 400, { ok: false, message: "Informe seu nome e contato para auditoria da indicação." });
    if (!aceite) return json(res, 400, { ok: false, message: "É preciso aceitar o regulamento para enviar a indicação." });

    const [edition] = await rest(`melhores_edicoes?select=id,status,indicacoes_inicio,indicacoes_fim&limit=1&id=eq.${edicaoId}`);
    if (!edition || !indicationsOpen(edition)) return json(res, 403, { ok: false, message: "As indicações não estão abertas neste momento." });

    const [category] = await rest(`melhores_categorias?select=id,edicao_id,status,visibilidade_publica,permite_indicacao_publica&limit=1&id=eq.${categoriaId}&edicao_id=eq.${edicaoId}`);
    if (!category || category.status !== "ativo" || category.visibilidade_publica !== true || category.permite_indicacao_publica !== true) {
      return json(res, 400, { ok: false, message: "Categoria indisponível para indicações." });
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const contactHash = hash(`${edicaoId}|${categoriaId}|${contatoResponsavel.toLowerCase()}|${firstIp(req)}`);
    const recent = await rest(`melhores_indicacoes?select=id&edicao_id=eq.${edicaoId}&contato_responsavel=eq.${encodeURIComponent(contatoResponsavel)}&criado_em=gte.${encodeURIComponent(fifteenMinutesAgo)}&limit=10`);
    if (recent.length >= 5) return json(res, 429, { ok: false, message: "Muitas indicações em sequência. Tente novamente mais tarde." });

    const [created] = await rest("melhores_indicacoes", {
      method: "POST",
      body: [{
        edicao_id: edicaoId,
        categoria_id: categoriaId,
        nome_indicado: nomeIndicado,
        justificativa,
        contato_indicado: contatoIndicado || null,
        nome_responsavel: nomeResponsavel,
        contato_responsavel: contatoResponsavel,
        aceite_regulamento: true,
        status: "pendente",
        observacao_interna: `Origem pública. Hash técnico: ${contactHash.slice(0, 20)}`
      }]
    });

    return json(res, 200, {
      ok: true,
      indicacao_id: created.id,
      message: "Indicação enviada com sucesso. Ela será analisada pela equipe do Eu Amo Urânia."
    });
  } catch (error) {
    console.error("melhores-indicar:", error);
    return json(res, 500, { ok: false, message: "Não foi possível enviar a indicação agora." });
  }
};
