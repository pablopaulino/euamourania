import { getSupabase } from "./supabaseClient.js";

export const PLANOS_COMERCIAIS = {
  presenca: { nome: "Presença", valor: 89, stories: 0, atualizacoes: 1, feedCadaDias: 0 },
  destaque: { nome: "Destaque", valor: 169, stories: 1, atualizacoes: 2, feedCadaDias: 0 },
  maxima: { nome: "Máxima Presença", valor: 249, stories: 3, atualizacoes: 4, feedCadaDias: 60 }
};

export function normalizarPlanoComercial(plano) {
  const key = String(plano || "presenca").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (key.includes("max")) return "maxima";
  if (key.includes("dest")) return "destaque";
  return "presenca";
}

export function planoComercial(plano) {
  return PLANOS_COMERCIAIS[normalizarPlanoComercial(plano)] || PLANOS_COMERCIAIS.presenca;
}

const hojeIso = () => new Date().toISOString().slice(0, 10);

const inicioMesIso = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
};

function somarMesesIso(value, months = 1) {
  const date = value ? new Date(value) : new Date();
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}

function entregaFeed(plano, inicio, competencia = new Date()) {
  const info = planoComercial(plano);
  if (!info.feedCadaDias) return 0;
  const start = inicio ? new Date(inicio) : new Date();
  const current = competencia instanceof Date ? competencia : new Date(competencia);
  const elapsedMonths = Math.max(0, (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth());
  return elapsedMonths % 2 === 0 ? 1 : 0;
}

function payloadSolicitacao(row = {}) {
  return row.submitted_payload || {};
}

function ehSolicitacaoComercial(row = {}) {
  const payload = payloadSolicitacao(row);
  return payload.source === "divulgue" || payload.commercial_flow === true || Boolean(payload.plan_id || payload.plan_key || payload.plan);
}

function precoNumerico(value, fallback) {
  if (typeof value === "number") return value;
  const parsed = Number(String(value || "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function dadosDaSolicitacao(row = {}) {
  const payload = payloadSolicitacao(row);
  const company = payload.company || {};
  const contact = payload.contact || {};
  const plano = normalizarPlanoComercial(payload.plan_id || payload.plan_key || payload.plan || payload.selected_plan);
  const valorPadrao = planoComercial(plano).valor;
  return {
    plano,
    valor_mensal: precoNumerico(payload.plan_price, valorPadrao),
    empresa_nome: company.name || payload.company_name || row.nome || row.business_name || "Empresa sem nome",
    responsavel_nome: contact.name || payload.responsible_name || row.responsavel_nome || row.submitter_name || null,
    whatsapp: contact.whatsapp || payload.whatsapp || row.whatsapp || row.submitter_phone || null,
    email: contact.email || payload.email || row.submitter_email || null,
    instagram: company.instagram || payload.instagram || row.instagram || null,
    categoria: company.category || payload.category || row.categoria_nome || null,
    observacoes: payload.message || payload.notes || null,
    configuracao: { origem: "divulgue", submission_payload: payload }
  };
}

export async function listarSolicitacoesComerciais() {
  const { data, error } = await getSupabase()
    .from("business_submissions")
    .select("*")
    .in("status", ["pending", "under_review"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []).filter(ehSolicitacaoComercial).map(item => ({
    ...item,
    commercial: dadosDaSolicitacao(item)
  }));
}

export async function listarAssinaturasComerciais() {
  const { data, error } = await getSupabase()
    .from("assinaturas_comerciais")
    .select("*, assinatura_entregas_mensais(*), assinatura_pagamentos(*)")
    .order("status", { ascending: true })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function obterResumoAssinaturasComerciais() {
  const { data, error } = await getSupabase()
    .from("publicidade_assinaturas_resumo")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data || { assinantes_ativos: 0, mrr: 0, assinantes_pendentes: 0, pagamentos_pendentes: 0 };
}

async function buscarAnunciantePorNome(nome) {
  if (!nome) return null;
  const { data, error } = await getSupabase()
    .from("anunciantes")
    .select("*")
    .ilike("nome", nome)
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}

async function buscarEmpresaGuiaPorNome(nome) {
  if (!nome) return null;
  const { data, error } = await getSupabase()
    .from("guia_comercial")
    .select("id,nome,slug,status")
    .ilike("nome", nome)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

async function garantirAnunciante(dados) {
  const existente = await buscarAnunciantePorNome(dados.empresa_nome);
  if (existente) return existente;
  const { data, error } = await getSupabase()
    .from("anunciantes")
    .insert({
      nome: dados.empresa_nome,
      contato_email: dados.email,
      whatsapp: dados.whatsapp,
      status: "ativo"
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function entregaDoMesPayload(assinatura, competencia = inicioMesIso()) {
  const plano = normalizarPlanoComercial(assinatura.plano);
  const info = planoComercial(plano);
  return {
    assinatura_id: assinatura.id,
    competencia,
    story_total: info.stories,
    feed_total: entregaFeed(plano, assinatura.data_inicio, competencia),
    atualizacao_total: info.atualizacoes
  };
}

export async function garantirEntregasDoMes(assinatura) {
  if (!assinatura?.id) return null;
  const competencia = inicioMesIso();
  const db = getSupabase();
  const { data: existente, error: erroExistente } = await db
    .from("assinatura_entregas_mensais")
    .select("*")
    .eq("assinatura_id", assinatura.id)
    .eq("competencia", competencia)
    .maybeSingle();
  if (erroExistente && erroExistente.code !== "PGRST116") throw erroExistente;
  if (existente) return existente;
  const { data, error } = await db
    .from("assinatura_entregas_mensais")
    .insert(entregaDoMesPayload(assinatura, competencia))
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function salvarAssinaturaComercial(payload) {
  const plano = normalizarPlanoComercial(payload.plano);
  const info = planoComercial(plano);
  const dados = {
    anunciante_id: payload.anunciante_id || null,
    guia_comercial_id: payload.guia_comercial_id || null,
    business_submission_id: payload.business_submission_id || null,
    empresa_nome: payload.empresa_nome,
    responsavel_nome: payload.responsavel_nome || null,
    whatsapp: payload.whatsapp || null,
    email: payload.email || null,
    instagram: payload.instagram || null,
    categoria: payload.categoria || null,
    plano,
    valor_mensal: Number(payload.valor_mensal || info.valor),
    status: payload.status || "ativa",
    data_inicio: payload.data_inicio || hojeIso(),
    proxima_cobranca: payload.proxima_cobranca || somarMesesIso(payload.data_inicio || hojeIso(), 1),
    observacoes: payload.observacoes || null,
    configuracao: payload.configuracao || {}
  };
  const query = payload.id
    ? getSupabase().from("assinaturas_comerciais").update(dados).eq("id", payload.id)
    : getSupabase().from("assinaturas_comerciais").insert(dados);
  const { data, error } = await query.select().single();
  if (error) throw error;
  await garantirEntregasDoMes(data);
  return data;
}

export async function aprovarSolicitacaoComercial(submissionId) {
  const db = getSupabase();
  const { data: solicitacao, error: erroSolicitacao } = await db
    .from("business_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();
  if (erroSolicitacao) throw erroSolicitacao;
  const dados = dadosDaSolicitacao(solicitacao);
  const anunciante = await garantirAnunciante(dados);
  const empresaGuia = await buscarEmpresaGuiaPorNome(dados.empresa_nome);
  const assinatura = await salvarAssinaturaComercial({
    ...dados,
    anunciante_id: anunciante?.id || null,
    guia_comercial_id: empresaGuia?.id || null,
    business_submission_id: solicitacao.id,
    status: "ativa"
  });
  const { error } = await db
    .from("business_submissions")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      approved_record_id: assinatura.id
    })
    .eq("id", solicitacao.id);
  if (error) throw error;
  return assinatura;
}

export async function atualizarStatusAssinatura(id, status) {
  const { data, error } = await getSupabase()
    .from("assinaturas_comerciais")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function registrarUsoEntrega(assinatura, campo, delta = 1) {
  const entrega = await garantirEntregasDoMes(assinatura);
  if (!entrega) return null;
  const campos = ["story_usados", "feed_usados", "atualizacao_usados"];
  if (!campos.includes(campo)) throw new Error("Entrega inválida.");
  const total = campo.replace("_usados", "_total");
  const proximo = Math.max(0, Math.min(Number(entrega[total] || 0), Number(entrega[campo] || 0) + delta));
  const { data, error } = await getSupabase()
    .from("assinatura_entregas_mensais")
    .update({ [campo]: proximo })
    .eq("id", entrega.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function marcarPagamentoAssinatura(assinatura) {
  const competencia = inicioMesIso();
  const db = getSupabase();
  const valor = Number(assinatura.valor_mensal || planoComercial(assinatura.plano).valor);
  const { data: existente } = await db
    .from("assinatura_pagamentos")
    .select("*")
    .eq("assinatura_id", assinatura.id)
    .eq("competencia", competencia)
    .maybeSingle();
  if (existente?.id) {
    const { error } = await db
      .from("assinatura_pagamentos")
      .update({ status: "pago", pago_em: hojeIso(), valor })
      .eq("id", existente.id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("assinatura_pagamentos")
      .insert({ assinatura_id: assinatura.id, competencia, valor, status: "pago", pago_em: hojeIso() });
    if (error) throw error;
  }
  const { data, error } = await db
    .from("assinaturas_comerciais")
    .update({ ultimo_pagamento_em: hojeIso(), proxima_cobranca: somarMesesIso(assinatura.proxima_cobranca || hojeIso(), 1), status: "ativa" })
    .eq("id", assinatura.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
