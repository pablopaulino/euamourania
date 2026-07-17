const SUPABASE_URL = process.env.SUPABASE_URL || "https://omhcpbphvtihqwdkbsbf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const DEFAULT_DOMAIN = "https://euamourania.com.br";
const DEFAULT_LOGO = "/assets/1505%20-%20Urania%20-%20Logo%20Horizontal%20-%201.png";
const DEFAULT_IMAGE = `${DEFAULT_DOMAIN}/assets/AD3A1763-min%20(1).jpg`;

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

const validDomain = value => {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.origin : DEFAULT_DOMAIN;
  } catch {
    return DEFAULT_DOMAIN;
  }
};

const absolute = (value, domain, fallback = DEFAULT_LOGO) => {
  try {
    return new URL(value || fallback, `${domain}/`).href;
  } catch {
    return new URL(fallback, `${domain}/`).href;
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

async function temPermissao(token, acao) {
  if (!token) return false;
  try {
    return await rest("rpc/tem_permissao_admin", {
      method: "POST",
      token,
      body: { p_modulo: "comunicacao", p_acao: acao }
    }) === true;
  } catch {
    return false;
  }
}

async function podeEnviar(token) {
  // RBAC: p_acao:"enviar" continua obrigatório para envios reais.
  return temPermissao(token, "enviar");
}

async function podeGerar(token) {
  return (await temPermissao(token, "criar")) || (await temPermissao(token, "editar"));
}

async function getBranding() {
  try {
    const keys = "nome_site,logo_principal,dominio_principal,texto_rodape,imagem_compartilhamento";
    const rows = await rest(`configuracoes_site?select=chave,valor&chave=in.(${keys})`);
    const config = Object.fromEntries((rows || []).map(item => [item.chave, item.valor]));
    const domain = validDomain(config.dominio_principal || DEFAULT_DOMAIN);
    return {
      domain,
      name: config.nome_site || "Eu Amo Urânia",
      logo: absolute(config.logo_principal || config.imagem_compartilhamento, domain),
      footer: config.texto_rodape || "Você recebeu este e-mail porque se cadastrou no Eu Amo Urânia."
    };
  } catch {
    return {
      domain: DEFAULT_DOMAIN,
      name: "Eu Amo Urânia",
      logo: absolute(DEFAULT_LOGO, DEFAULT_DOMAIN),
      footer: "Você recebeu este e-mail porque se cadastrou no Eu Amo Urânia."
    };
  }
}

function template(newsletter, subscriber, brand) {
  const token = subscriber.token_descadastro;
  const open = `${brand.domain}/api/newsletter-open?c=${newsletter.id}&t=${token}`;
  const target = /^https?:\/\//i.test(newsletter.link_botao || "") ? newsletter.link_botao : "";
  const click = target ? `${brand.domain}/api/newsletter-click?c=${newsletter.id}&t=${token}&url=${encodeURIComponent(target)}` : "";
  const image = /^https?:\/\//i.test(newsletter.imagem_url || "")
    ? `<img src="${esc(newsletter.imagem_url)}" alt="" style="display:block;width:100%;max-height:360px;object-fit:cover">`
    : "";
  const button = click
    ? `<p style="margin:28px 0"><a href="${esc(click)}" style="display:inline-block;padding:13px 22px;background:#0b4f6c;color:#fff;text-decoration:none;border-radius:999px;font-weight:700">${esc(newsletter.texto_botao || "Saiba mais")}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#f3f6f7;font-family:Arial,sans-serif;color:#073b4c"><div style="display:none;max-height:0;overflow:hidden">${esc(newsletter.preheader || "")}</div><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table width="620" style="width:100%;max-width:620px;background:#fff;border-radius:18px;overflow:hidden"><tr><td style="padding:22px 28px;text-align:center"><img src="${esc(brand.logo)}" width="190" alt="${esc(brand.name)}"></td></tr><tr><td>${image}</td></tr><tr><td style="padding:28px"><p style="margin:0 0 8px;color:#1385a5;font-size:12px;font-weight:700;letter-spacing:1.5px">${esc(brand.name.toUpperCase())}</p><h1 style="margin:0 0 18px;font-size:28px;line-height:1.2">${esc(newsletter.titulo)}</h1><div style="font-size:16px;line-height:1.65;color:#405b65">${newsletter.conteudo_html}</div>${button}</td></tr><tr><td style="padding:22px 28px;background:#073b4c;color:#d9e6ea;text-align:center;font-size:12px">${esc(brand.footer)}<br><a href="${brand.domain}/descadastrar.html?token=${token}" style="color:#fff">Cancelar inscrição</a></td></tr></table><img src="${open}" width="1" height="1" alt="" style="display:block"></td></tr></table></body></html>`;
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) search.set(key, value);
  });
  return search.toString();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "";
}

function monthName(value) {
  return new Date(value).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function periodFromBody(body = {}) {
  const end = body.fim ? new Date(body.fim) : new Date();
  const safeEnd = Number.isNaN(end.getTime()) ? new Date() : end;
  const start = body.inicio ? new Date(body.inicio) : new Date(safeEnd.getTime() - 30 * 864e5);
  const safeStart = Number.isNaN(start.getTime()) ? new Date(safeEnd.getTime() - 30 * 864e5) : start;
  const key = body.periodoChave || `${safeEnd.getFullYear()}-${String(safeEnd.getMonth() + 1).padStart(2, "0")}`;
  return { start: safeStart, end: safeEnd, key };
}

function countBy(events, predicate) {
  const map = new Map();
  for (const event of events || []) {
    if (!predicate(event) || !event.recurso_id) continue;
    map.set(event.recurso_id, (map.get(event.recurso_id) || 0) + 1);
  }
  return map;
}

function countNewsSlugsByPath(events) {
  const map = new Map();
  for (const event of events || []) {
    if (!(event.tipo === "noticia_view" || event.recurso_tipo === "noticia" || String(event.pagina || "").includes("/noticias/"))) continue;
    const match = String(event.pagina || "").match(/\/noticias\/([^/?#]+)/);
    if (!match?.[1]) continue;
    const slug = decodeURIComponent(match[1]);
    map.set(slug, (map.get(slug) || 0) + 1);
  }
  return map;
}

async function fetchByIds(table, ids, select, token) {
  if (!ids.length) return [];
  return await rest(`${table}?id=in.(${ids.map(encodeURIComponent).join(",")})&select=${select}`, { token });
}

async function fetchNewsBySlugs(slugs, token) {
  if (!slugs.length) return [];
  return await rest(`noticias?slug=in.(${slugs.map(encodeURIComponent).join(",")})&select=id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes`, { token });
}

function ranked(details, counts, urlBuilder, titleField = "titulo") {
  return [...(details || [])]
    .map(item => ({
      ...item,
      acessos_periodo: counts.get(item.id) || Number(item.visualizacoes || 0) || 0,
      url: urlBuilder(item),
      titulo_exibicao: item[titleField] || item.nome || "Sem título",
      imagem_absoluta: absolute(item.imagem_url, DEFAULT_DOMAIN, DEFAULT_IMAGE)
    }))
    .sort((a, b) => b.acessos_periodo - a.acessos_periodo);
}

function card(item, label) {
  const title = esc(item.titulo_exibicao);
  const summary = esc(String(item.resumo || item.descricao || "").replace(/<[^>]+>/g, "").slice(0, 150));
  const image = esc(item.imagem_absoluta || DEFAULT_IMAGE);
  const url = esc(item.url);
  const meta = item.publicado_em ? formatDate(item.publicado_em) : `${item.acessos_periodo || 0} acessos no período`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #dce8ec;border-radius:16px;overflow:hidden"><tr><td width="168" style="width:168px;vertical-align:top;background:#eef5f6"><a href="${url}" style="text-decoration:none"><img src="${image}" alt="" width="168" style="display:block;width:168px;height:118px;object-fit:cover"></a></td><td style="padding:15px 16px;vertical-align:top"><p style="margin:0 0 6px;color:#1385a5;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase">${esc(label)} · ${esc(meta)}</p><h3 style="margin:0 0 8px;font-size:18px;line-height:1.25;color:#073b4c"><a href="${url}" style="color:#073b4c;text-decoration:none">${title}</a></h3>${summary ? `<p style="margin:0 0 10px;color:#526b73;font-size:14px;line-height:1.45">${summary}${summary.length >= 150 ? "…" : ""}</p>` : ""}<a href="${url}" style="color:#0b4f6c;font-size:13px;font-weight:700;text-decoration:none">Acessar destaque →</a></td></tr></table>`;
}

function section(title, subtitle, items, label) {
  if (!items.length) return "";
  return `<div style="margin:28px 0"><p style="margin:0 0 6px;color:#f7c948;font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Resumo mensal</p><h2 style="margin:0 0 6px;font-size:23px;line-height:1.2;color:#073b4c">${esc(title)}</h2><p style="margin:0 0 16px;color:#637981;font-size:14px;line-height:1.5">${esc(subtitle)}</p>${items.map(item => card(item, label)).join("")}</div>`;
}

function compactNewsList(items) {
  if (!items.length) return "";
  return `<div style="margin:24px 0;padding:18px;border-radius:18px;background:#f7fbfc;border:1px solid #dce8ec"><h2 style="margin:0 0 12px;font-size:22px;line-height:1.2;color:#073b4c">O que marcou o mês</h2><p style="margin:0 0 14px;color:#526b73;font-size:14px;line-height:1.5">Estas foram as cinco notícias que mais chamaram atenção dos leitores no período:</p>${items.map((item, index) => `<p style="margin:0;padding:11px 0;border-top:${index ? "1px solid #dce8ec" : "0"};font-size:15px;line-height:1.45"><strong style="display:inline-block;min-width:26px;color:#0b4f6c">${index + 1}.</strong><a href="${esc(item.url)}" style="color:#073b4c;text-decoration:none;font-weight:700">${esc(item.titulo_exibicao)}</a><br><span style="margin-left:30px;color:#6a7e86;font-size:12px">${esc(item.categoria_nome || "Notícia")} · ${esc(formatDate(item.publicado_em))}${item.acessos_periodo ? ` · ${esc(item.acessos_periodo)} acessos` : ""}</span></p>`).join("")}</div>`;
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

async function generateMonthlyDraft(token, body = {}) {
  const period = periodFromBody(body);
  const existing = await existingMonthly(token, period.key);
  const canUpdateExisting = existing && ["rascunho", "erro"].includes(existing.status);
  if (existing && !canUpdateExisting && !body.force) {
    return { duplicate: true, newsletter: existing, message: "Já existe uma newsletter mensal para este período." };
  }

  const startIso = period.start.toISOString();
  const endIso = period.end.toISOString();
  const periodLabel = `${formatDate(startIso)} a ${formatDate(endIso)}`;
  const targets = ["tudo"];

  const [events, publishedNews, newCompanies, recipients] = await Promise.all([
    rest(`analytics_eventos?${query({ select: "tipo,recurso_tipo,recurso_id,pagina,criado_em", criado_em: `gte.${startIso}` })}&criado_em=lte.${encodeURIComponent(endIso)}&limit=5000`, { token }).catch(() => []),
    rest(`noticias?${query({ select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes", status: "eq.publicado", publicado_em: `gte.${startIso}` })}&publicado_em=lte.${encodeURIComponent(endIso)}&order=publicado_em.desc&limit=12`, { token }).catch(() => []),
    rest(`guia_comercial?${query({ select: "id,nome,slug,descricao,imagem_url,categoria_nome,criado_em,visualizacoes", status: "eq.publicado", criado_em: `gte.${startIso}` })}&criado_em=lte.${encodeURIComponent(endIso)}&order=criado_em.desc&limit=10`, { token }).catch(() => []),
    activeRecipients(token, targets)
  ]);

  const newsCounts = countBy(events, event => event.tipo === "noticia_view" || event.recurso_tipo === "noticia");
  const newsSlugCounts = countNewsSlugsByPath(events);
  const companyCounts = countBy(events, event => event.tipo === "guia_view" || event.recurso_tipo === "guia" || event.recurso_tipo === "empresa");

  let newsDetails = await fetchByIds("noticias", [...newsCounts.keys()], "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes", token).catch(() => []);
  if (!newsDetails.length && newsSlugCounts.size) {
    newsDetails = await fetchNewsBySlugs([...newsSlugCounts.keys()], token).catch(() => []);
    for (const item of newsDetails) {
      if (newsSlugCounts.has(item.slug)) newsCounts.set(item.id, newsSlugCounts.get(item.slug));
    }
  }
  if (!newsDetails.length) newsDetails = publishedNews || [];
  if (!newsDetails.length) {
    newsDetails = await rest(`noticias?${query({ select: "id,titulo,slug,resumo,imagem_url,categoria_nome,publicado_em,visualizacoes", status: "eq.publicado", publicado_em: `lte.${endIso}` })}&order=visualizacoes.desc&limit=5`, { token }).catch(() => []);
  }

  let companyDetails = await fetchByIds("guia_comercial", [...companyCounts.keys()], "id,nome,slug,descricao,imagem_url,categoria_nome,visualizacoes", token).catch(() => []);
  if (!companyDetails.length) companyDetails = newCompanies || [];
  if (!companyDetails.length) {
    companyDetails = await rest("guia_comercial?status=eq.publicado&select=id,nome,slug,descricao,imagem_url,categoria_nome,visualizacoes&order=visualizacoes.desc&limit=4", { token }).catch(() => []);
  }

  const topNews = ranked(newsDetails, newsCounts, item => `${DEFAULT_DOMAIN}/noticias/${encodeURIComponent(item.slug)}`).slice(0, 5);
  const topCompanies = ranked(companyDetails, companyCounts, item => `${DEFAULT_DOMAIN}/guia/${encodeURIComponent(item.slug)}`, "nome").slice(0, 4);
  const newNews = (publishedNews || []).filter(item => !topNews.some(news => news.id === item.id)).slice(0, 4).map(item => ({ ...item, titulo_exibicao: item.titulo, imagem_absoluta: absolute(item.imagem_url, DEFAULT_DOMAIN, DEFAULT_IMAGE), url: `${DEFAULT_DOMAIN}/noticias/${encodeURIComponent(item.slug)}` }));
  const newCompanyCards = (newCompanies || []).filter(item => !topCompanies.some(company => company.id === item.id)).slice(0, 3).map(item => ({ ...item, titulo_exibicao: item.nome, imagem_absoluta: absolute(item.imagem_url, DEFAULT_DOMAIN, DEFAULT_IMAGE), url: `${DEFAULT_DOMAIN}/guia/${encodeURIComponent(item.slug)}` }));

  const monthSummary = topNews.length
    ? `Neste mês, os leitores acompanharam principalmente ${topNews.slice(0, 3).map(item => item.titulo_exibicao).join(", ")}. A seleção abaixo reúne os conteúdos que mais movimentaram o portal e ajudam a entender o que esteve em destaque em Urânia.`
    : "Neste mês, reunimos os principais conteúdos publicados no portal para facilitar o acompanhamento das novidades de Urânia.";
  const html = `<p style="margin:0 0 16px;color:#405b65;font-size:16px;line-height:1.6">${esc(monthSummary)}</p><p style="margin:0 0 22px;padding:13px 16px;background:#eef7f8;border-radius:14px;color:#0b4f6c;font-size:14px;line-height:1.45"><strong>Período analisado:</strong> ${esc(periodLabel)}</p>${compactNewsList(topNews)}${section("Notícias mais acessadas", "Os conteúdos que mais movimentaram a leitura no portal.", topNews, "Notícia")}${section("Empresas mais visitadas", "Comércios e serviços que receberam mais visitas no Guia.", topCompanies, "Guia")}${section("Novidades publicadas", "Conteúdos e cadastros recentes para você acompanhar.", [...newNews, ...newCompanyCards].slice(0, 6), "Novo")}<div style="margin:30px 0 0;padding:20px;border-radius:18px;background:#073b4c;color:#fff"><h2 style="margin:0 0 8px;font-size:22px;color:#fff">Continue acompanhando Urânia</h2><p style="margin:0;color:#d9e6ea;font-size:14px;line-height:1.5">Acesse o portal para ver notícias, guia comercial, turismo, eventos e novidades da cidade.</p></div>`;

  const payload = {
    titulo: `Resumo mensal — ${monthName(period.end)}`,
    assunto: "O mês em Urânia: notícias, empresas e destaques",
    preheader: `Resumo do Eu Amo Urânia de ${periodLabel}.`,
    imagem_url: topNews[0]?.imagem_absoluta || DEFAULT_IMAGE,
    conteudo_html: html,
    texto_botao: "Ver portal",
    link_botao: DEFAULT_DOMAIN,
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
      novos_conteudos: { noticias: newNews.map(item => item.id), empresas: newCompanyCards.map(item => item.id) }
    }
  };

  if (canUpdateExisting) {
    const updated = await rest(`newsletters?id=eq.${existing.id}`, { method: "PATCH", token, body: payload });
    return { duplicate: false, newsletter: updated?.[0], message: "Resumo mensal atualizado como rascunho." };
  }

  const inserted = await rest("newsletters", { method: "POST", token, body: payload });
  return { duplicate: false, newsletter: inserted?.[0], message: "Resumo mensal gerado como rascunho." };
}

async function sendNewsletter(req, res, token) {
  if (!await podeEnviar(token)) return res.status(403).json({ error: "Permissão para enviar newsletters necessária" });
  if (!process.env.BREVO_API_KEY) return res.status(503).json({ error: "BREVO_API_KEY não configurada na Vercel" });

  const { id, action = "send", testEmail } = req.body || {};
  const [newsletter, brand] = await Promise.all([
    (await rest(`newsletters?id=eq.${encodeURIComponent(id)}&select=*`, { token }))?.[0],
    getBranding()
  ]);
  if (!newsletter) return res.status(404).json({ error: "Newsletter não encontrada" });

  let subscribers = [];
  if (action === "test") {
    if (!/^\S+@\S+\.\S+$/.test(testEmail || "")) return res.status(400).json({ error: "Informe um e-mail de teste válido" });
    subscribers = [{ id: null, nome: "Leitor de teste", email: testEmail, token_descadastro: "00000000-0000-0000-0000-000000000000" }];
  } else {
    const all = await rest("newsletter_assinantes?status=eq.ativo&select=id,nome,email,interesses,token_descadastro&order=cadastrado_em.asc", { token });
    const targets = newsletter.interesses_alvo || ["tudo"];
    subscribers = all.filter(s => targets.includes("tudo") || s.interesses?.includes("tudo") || s.interesses?.some(x => targets.includes(x)));
    if (!subscribers.length) return res.status(400).json({ error: "Nenhum assinante ativo para este público" });
  }

  const messageIds = [];
  for (let i = 0; i < subscribers.length; i += 500) {
    const chunk = subscribers.slice(i, i + 500);
    const payload = {
      sender: { name: brand.name, email: process.env.BREVO_SENDER_EMAIL || "euamourania@gmail.com" },
      subject: newsletter.assunto,
      htmlContent: template(newsletter, chunk[0], brand),
      messageVersions: chunk.map(subscriber => ({
        to: [{ email: subscriber.email, name: subscriber.nome || undefined }],
        htmlContent: template(newsletter, subscriber, brand)
      })),
      tags: [`newsletter-${newsletter.id}`]
    };
    if (action === "schedule" && newsletter.agendado_em) payload.scheduledAt = new Date(newsletter.agendado_em).toISOString();
    const brevo = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await brevo.json();
    if (!brevo.ok) throw new Error(data.message || `Brevo ${brevo.status}`);
    messageIds.push(...(data.messageIds || [data.messageId]));
  }

  if (action !== "test") {
    await rest(`newsletter_envios?on_conflict=newsletter_id,assinante_id`, {
      method: "POST",
      token,
      body: subscribers.map((subscriber, index) => ({
        newsletter_id: newsletter.id,
        assinante_id: subscriber.id,
        brevo_message_id: messageIds[index] || null,
        status: action === "schedule" ? "agendado" : "enviado"
      }))
    });
    await rest(`newsletters?id=eq.${newsletter.id}`, {
      method: "PATCH",
      token,
      body: {
        status: action === "schedule" ? "agendado" : "enviado",
        total_enviados: subscribers.length,
        enviado_em: action === "schedule" ? null : new Date().toISOString()
      }
    });
  }

  return res.status(200).json({
    ok: true,
    total: subscribers.length,
    message: action === "test" ? "Teste enviado." : action === "schedule" ? "Envio agendado." : "Newsletter enviada."
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  try {
    const action = req.body?.action || "send";
    if (action === "generate_monthly") {
      if (!await podeGerar(token)) return res.status(403).json({ error: "Permissão para criar newsletters necessária" });
      const result = await generateMonthlyDraft(token, req.body || {});
      return res.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
    }
    return await sendNewsletter(req, res, token);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Falha no envio" });
  }
};
