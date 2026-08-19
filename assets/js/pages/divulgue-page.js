import { registrarEventoSite } from "../services/analyticsService.js";

const page = document.body?.classList.contains("advertise-page") ? document.body : null;
const form = document.querySelector("[data-commercial-form]");
const planSelect = form?.querySelector("[name='commercial_plan']");
const submitterName = form?.querySelector("[name='submitter_name']");
const submitterPhone = form?.querySelector("[name='submitter_phone']");
const responsibleName = form?.querySelector("[name='responsavel_nome']");
const whatsapp = form?.querySelector("[name='whatsapp']");

let formStarted = false;

function track(type, metadata = {}) {
  registrarEventoSite(type, {
    pagina: "/divulgue",
    recursoTipo: "divulgue",
    metadados: metadata
  }).catch(() => {});
}

function syncHiddenFields() {
  if (submitterName && responsibleName) submitterName.value = responsibleName.value;
  if (submitterPhone && whatsapp) submitterPhone.value = whatsapp.value;
}

function selectPlan(planId) {
  if (planSelect && planId) planSelect.value = planId;
  syncHiddenFields();
  form?.scrollIntoView({ behavior: "smooth", block: "start" });
  form?.querySelector("[name='nome']")?.focus({ preventScroll: true });
}

function setupPlanTriggers() {
  document.querySelectorAll("[data-plan-trigger]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const planId = trigger.dataset.planTrigger;
      track("divulgue_plano_clique", { plano: planId || null });
      if (!planId || trigger.getAttribute("href") !== "#adesao") return;
      event.preventDefault();
      selectPlan(planId);
    });
  });
}

function setupSmoothScroll() {
  document.querySelectorAll("a[href='#planos']").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const target = document.querySelector("#planos");
      if (!target) return;
      event.preventDefault();
      track("divulgue_scroll_planos");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function setupFormTracking() {
  if (!form) return;
  form.addEventListener("input", () => {
    syncHiddenFields();
    if (formStarted) return;
    formStarted = true;
    track("divulgue_formulario_inicio", { plano: planSelect?.value || null });
  });
  form.addEventListener("submit", () => {
    syncHiddenFields();
    track("divulgue_formulario_submit", { plano: planSelect?.value || null });
  }, true);
  document.addEventListener("public-submission:success", (event) => {
    track("divulgue_formulario_enviado", {
      plano: event.detail?.payload?.submitted_payload?.plan_id || planSelect?.value || null
    });
  });
}

function setupCtaTracking() {
  document.querySelectorAll("[data-ad-track]").forEach((link) => {
    link.addEventListener("click", () => {
      track("divulgue_cta_clique", {
        cta: link.dataset.adTrack,
        href: link.getAttribute("href")
      });
    });
  });
}

if (page) {
  track("divulgue_acesso");
  setupSmoothScroll();
  setupPlanTriggers();
  setupFormTracking();
  setupCtaTracking();
}
