const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DOMAIN = "https://euamourania.com.br";
const DEFAULT_IMAGE = `${DOMAIN}/assets/AD3A1763-min%20(1).jpg`;

const esc = (value = "") =>
  String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[char]));

const toAbsolute = value => {
  try {
    return new URL(value || DEFAULT_IMAGE, DOMAIN).href;
  } catch {
    return DEFAULT_IMAGE;
  }
};

async function rest(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  if (!response.ok) {
    let message = `Supabase ${response.status}`;
    try {
      message = JSON.parse(text || "{}").message || message;
    } catch {}
    throw new Error(message);
  }
  return text ? JSON.parse(text) : null;
}

async function canCreateNewsletter(token) {
  if (!token) return false;
  for (const action of ["criar", "editar"]) {
    try {
      const allowed = await rest("rpc/tem_permissao_admin", {
        method: "POST",
        token,
        body: { p_modulo: "comunicacao", p_acao: action }
      });
      if (allowed === true) return true;
    } catch {}
  }
  return false;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.set(key, value);
  });
  return search.toString();
}

function formatDate(value) {
  return value
    ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
}

function monthName(value) {
  return new Date(value).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function periodFromBody(body = {}) {
  const now = body.fim ? new Date(body.fim) : new Date();
  const end = Number.isNaN(now.getTime()) ? new Date() : now;
  const start = body.inicio ? new Date(body.inicio) : new Date(end.getTime() - 30 * 864e5);
  const safeStart = Number.isNaN(start.getTime()) ? new Date(end.getTime() - 30 * 864e5) : start;
  const key = body.periodoChave || `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}`;
  return { start: safeStart, end, key };
}

function countBy(events, predicate) {
  const map = new Map();
  for (const event of events || []) {
    if (!predicate(event)) continue;
    const id = event.recurso_id;
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}

async function fetchByIds(table, ids, select, token) {
  if (!ids.length) return [];
  const path = `${table}?id=in.(${ids.map(encodeURIComponent).join(",")})&select=${select}`;
  return await rest(path, { token });
}

function ranked(details, counts, urlBuilder, titleField = "titulo") {
  return [...(details || [])]
    .map(item => ({
      ...item,
      acessos_periodo: counts.get(item.id) || Number(item.visualizacoes || 0) || 0,
      url: urlBuilder(item),
      titulo_exibicao: item[titleField] || item.nome || "Sem título",
      imagem_absoluta: toAbsolute(item.imagem_url)
    }))
    .sort((a, b) => b.acessos_periodo - a.acessos_periodo);
}

function card(item, label) {
  const title = esc(item.titulo_exibicao);
  const summary = esc(String(item.resumo || item.descricao || "").replace(/<[^>]+>/g, "").slice(0, 150));
  const image = esc(item.imagem_absoluta || DEFAULT_IMAGE);
  const url = esc(item.url);
  const meta = item.publicado_em ? formatDate(item.publicado_em) : `${item.acessos_periodo || 0} acessos no período`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #dce8ec;border-radius:16px;overflow:hidden">
      <tr>
        <td width="168" style="width:168px;vertical-align:top;background:#eef5f6">
          <a href="${url}" style="text-decoration:none"><img src="${image}" alt="" width="168" style="display:block;width:168px;height:118px;object-fit:cover"></a>
        </td>
        <td style="padding:15px 16px;vertical-align:top">
          <p style="margin:0 0 6px;color:#1385a5;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${esc(label)} · ${esc(meta)}</p>
          <h3 style="margin:0 0 8px;font-size:18px;line-height:1.25;color:#073b4c"><a href="${url}" style="color:#073b4c;text-decoration:none">${title}</a></h3>
          ${summary ? `<p style="margin:0 0 10px;color:#526b73;font-size:14px;line-height:1.45">${summary}${summary.length >= 150 ? "…" : ""}</p>` : ""}
          <a href="${url}" style="color:#0b4f6c;font-size:13px;font-weight:700;text-decoration:none">Acessar destaque →</a>
        </td>
      </tr>
    </table>`;
}

function section(title, subtitle, items, label) {
  if (!items.length) return "";
  return `
    <div style="margin:28px 0">
      <p style="margin:0 0 6px;color:#f7c948;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Resumo mensal</p>
      <h2 style="margin:0 0 6px;font-size:23px;line-height:1.2;color:#073b4c">${esc(title)}</h2>
      <p style="margin:0 0 16px;color:#637981;font-size:14px;line-height:1.5">${esc(subtitle)}</p>
      ${items.map(item => card(item, label)).join("")}
    </div>`;
}

async function activeRecipients(token, targets = ["tudo"]) {
  const all = await rest("newsletter_assinantes?status=eq.ativo&select=id,interesses", { token });
  return (all || []).filter(subscriber =>
    targets.includes("tudo") ||
    subscriber.interesses?.includes("tudo") ||
    subscriber.interesses?.some(item => targets.includes(item))
  );
}

async function existingMonthly(token, periodKey) {
  const rows = await rest("newsletters?automatizacao_tipo=eq.resumo_mensal&select=id,titulo,assunto,status,criado_em,enviado_em,total_enviados,total_aberturas,total_cliques,configuracao_futura&order=criado_em.desc&limit=100", { token });
  return (rows || []).find(row => row.configuracao_futura?.periodo_chave === periodKey) || null;
}

async function generateDraft(token, period) {
  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const periodLabel = `${formatDate(startIso)} a ${formatDate(endIso)}`;
  const targets = ["tudo"];

  const [events, publishedNews, newCompanies, recipients] = await Promise.all([
    rest(`analytics_eventos?${query({ select: "tipo,recurso_tipo,recurso_id,pagina,criado_em", criado_em: `gte.${startIso}`, criado_em_lte: undefined })}&criado_em=lte.${encodeURIComponent(endIso)}&limit=5000`, { token }).catch(() => []),
    rest(`noticias?${query({ select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes", status: "eq.publicado", publicado_em: `gte.${startIso}` })}&publicado_em=lte.${encodeURIComponent(endIso)}&order=publicado_em.desc&limit=12`, { token }).catch(() => []),
    rest(`guia_comercial?${query({ select: "id,nome,slug,descricao,imagem_url,categoria_nome,criado_em,visualizacoes", status: "eq.publicado", criado_em: `gte.${startIso}` })}&criado_em=lte.${encodeURIComponent(endIso)}&order=criado_em.desc&limit=10`, { token }).catch(() => []),
    activeRecipients(token, targets)
  ]);

  const newsCounts = countBy(events, event => event.tipo === "noticia_view" || event.recurso_tipo === "noticia");
  const companyCounts = countBy(events, event => event.tipo === "guia_view" || event.recurso_tipo === "guia" || event.recurso_tipo === "empresa");

  let newsDetails = await fetchByIds(
    "noticias",
    [...newsCounts.keys()],
    "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes",
    token
  ).catch(() => []);
  if (!newsDetails.length) newsDetails = publishedNews || [];

  let companyDetails = await fetchByIds(
    "guia_comercial",
    [...companyCounts.keys()],
    "id,nome,slug,descricao,imagem_url,categoria_nome,visualizacoes",
    token
  ).catch(() => []);
  if (!companyDetails.length) companyDetails = newCompanies || [];

  const topNews = ranked(newsDetails, newsCounts, item => `${DOMAIN}/noticias/${encodeURIComponent(item.slug)}`).slice(0, 5);
  const topCompanies = ranked(companyDetails, companyCounts, item => `${DOMAIN}/guia/${encodeURIComponent(item.slug)}`, "nome").slice(0, 4);
  const newNews = (publishedNews || [])
    .filter(item => !topNews.some(news => news.id === item.id))
    .slice(0, 4)
    .map(item => ({
      ...item,
      titulo_exibicao: item.titulo,
      imagem_absoluta: toAbsolute(item.imagem_url),
      url: `${DOMAIN}/noticias/${encodeURIComponent(item.slug)}`
    }));
  const newCompanyCards = (newCompanies || [])
    .filter(item => !topCompanies.some(company => company.id === item.id))
    .slice(0, 3)
    .map(item => ({
      ...item,
      titulo_exibicao: item.nome,
      imagem_absoluta: toAbsolute(item.imagem_url),
      url: `${DOMAIN}/guia/${encodeURIComponent(item.slug)}`
    }));

  const html = `
    <p style="margin:0 0 16px;color:#405b65;font-size:16px;line-height:1.6">
      Preparamos um resumo dos últimos 30 dias no Eu Amo Urânia, reunindo as notícias, empresas e novidades que mais chamaram atenção da comunidade.
    </p>
    <p style="margin:0 0 22px;padding:13px 16px;background:#eef7f8;border-radius:14px;color:#0b4f6c;font-size:14px;line-height:1.45">
      <strong>Período analisado:</strong> ${esc(periodLabel)}
    </p>
    ${section("Notícias mais acessadas", "Os conteúdos que mais movimentaram a leitura no portal.", topNews, "Notícia")}
    ${section("Empresas mais visitadas", "Comércios e serviços que receberam mais visitas no Guia.", topCompanies, "Guia")}
    ${section("Novidades publicadas", "Conteúdos e cadastros recentes para você acompanhar.", [...newNews, ...newCompanyCards].slice(0, 6), "Novo")}
    <div style="margin:30px 0 0;padding:20px;border-radius:18px;background:#073b4c;color:#fff">
      <h2 style="margin:0 0 8px;font-size:22px;color:#fff">Continue acompanhando Urânia</h2>
      <p style="margin:0;color:#d9e6ea;font-size:14px;line-height:1.5">Acesse o portal para ver notícias, guia comercial, turismo, eventos e novidades da cidade.</p>
    </div>`;

  const titleMonth = monthName(period.end);
  const payload = {
    titulo: `Resumo mensal — ${titleMonth}`,
    assunto: `O mês em Urânia: notícias, empresas e destaques`,
    preheader: `Resumo do Eu Amo Urânia de ${periodLabel}.`,
    imagem_url: topNews[0]?.imagem_absoluta || DEFAULT_IMAGE,
    conteudo_html: html,
    texto_botao: "Ver portal",
    link_botao: DOMAIN,
    interesses_alvo: targets,
    status: "rascunho",
    automatizacao_tipo: "resumo_mensal",
    configuracao_futura: {
      periodo_chave: period.key,
      periodo_inicio: startIso,
      periodo_fim: endIso,
      periodo_rotulo: periodLabel,
      frequencia: "mensal",
      origem: "gerador_automatico_cms",
      gerado_em: new Date().toISOString(),
      envio_automatico: false,
      destinatarios_previstos: recipients.length,
      total_eventos_analisados: (events || []).length,
      noticias_mais_acessadas: topNews.map(item => ({ id: item.id, titulo: item.titulo_exibicao, acessos: item.acessos_periodo, url: item.url })),
      empresas_mais_visitadas: topCompanies.map(item => ({ id: item.id, nome: item.titulo_exibicao, acessos: item.acessos_periodo, url: item.url })),
      novos_conteudos: {
        noticias: newNews.map(item => item.id),
        empresas: newCompanyCards.map(item => item.id)
      }
    }
  };

  const inserted = await rest("newsletters", { method: "POST", token, body: payload });
  return inserted?.[0];
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!await canCreateNewsletter(token)) {
    return res.status(403).json({ error: "Permissão para criar newsletters necessária" });
  }

  try {
    const period = periodFromBody(req.body || {});
    const existing = await existingMonthly(token, period.key);
    if (existing && !req.body?.force) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        newsletter: existing,
        message: "Já existe uma newsletter mensal para este período."
      });
    }
    const newsletter = await generateDraft(token, period);
    return res.status(201).json({
      ok: true,
      duplicate: false,
      newsletter,
      message: "Resumo mensal gerado como rascunho."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Falha ao gerar newsletter mensal" });
  }
};
