import { registrarEventoSite } from "../services/analyticsService.js";

const plans = {
  monthly: {
    label: "Mensal",
    duration: "Renovação mensal",
    price: 79.9,
    priceLabel: "79,90",
    period: "/mês",
    equivalent: "Pagamento de R$ 79,90 por mês.",
    savings: null,
    badge: ""
  },
  semiannual: {
    label: "Semestral",
    duration: "Compromisso de 6 meses",
    price: 419.9,
    priceLabel: "419,90",
    period: "/6 meses",
    equivalent: "Equivale a R$ 69,98 por mês.",
    savings: 59.5,
    badge: "Economize"
  },
  annual: {
    label: "Anual",
    duration: "Compromisso de 12 meses",
    price: 759.9,
    priceLabel: "759,90",
    period: "/12 meses",
    equivalent: "Equivale a R$ 63,33 por mês.",
    savings: 198.9,
    badge: "Melhor valor"
  }
};

const selector = document.querySelector(".viva-plan-selector");
const price = document.querySelector("[data-plan-price]");
const period = document.querySelector("[data-plan-period]");
const duration = document.querySelector("[data-plan-duration]");
const equivalent = document.querySelector("[data-plan-equivalent]");
const savings = document.querySelector("[data-plan-savings]");
const savingsValue = document.querySelector("[data-plan-savings-value]");
const badge = document.querySelector("[data-plan-badge]");
const contact = document.querySelector("[data-subscription-contact]");

const currency = value => new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
}).format(value);

const track = (tipo, metadados = {}) => {
  registrarEventoSite(tipo, {
    pagina: "/app/seja-parceiro",
    recursoTipo: "app_parceria",
    destino: metadados.destino || null,
    metadados
  }).catch(() => {});
};

function whatsappUrl(plan) {
  const monthlyCopy = plan.label === "Mensal"
    ? `${currency(plan.price)} por mês`
    : `${currency(plan.price)} no total (${plan.equivalent.replace("Equivale a ", "").replace(".", "")})`;
  const message = `Olá! Quero assinar o Plano Parceiro do Viva no período ${plan.label.toLowerCase()}, por ${monthlyCopy}.`;
  return `https://wa.me/5517976005583?text=${encodeURIComponent(message)}`;
}

function selectPlan(id, shouldTrack = true) {
  const selected = plans[id] || plans.monthly;

  selector?.querySelectorAll("[data-plan]").forEach(button => {
    const active = button.dataset.plan === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  if (price) price.textContent = selected.priceLabel;
  if (period) period.textContent = selected.period;
  if (duration) duration.textContent = selected.duration;
  if (equivalent) equivalent.textContent = selected.equivalent;

  if (savings && savingsValue) {
    savings.hidden = !selected.savings;
    savingsValue.textContent = selected.savings ? currency(selected.savings) : "";
  }

  if (badge) {
    badge.hidden = !selected.badge;
    badge.textContent = selected.badge;
  }

  if (contact) {
    contact.href = whatsappUrl(selected);
    contact.dataset.selectedPlan = id;
    contact.setAttribute("aria-label", `Quero o período ${selected.label} do Plano Parceiro do Viva`);
  }

  if (shouldTrack) track("app_parceria_periodo_selecionado", {
    periodo: id,
    valor: selected.price
  });
}

selector?.addEventListener("click", event => {
  const button = event.target.closest("[data-plan]");
  if (!button) return;
  selectPlan(button.dataset.plan);
});

selector?.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  const buttons = [...selector.querySelectorAll("[data-plan]")];
  const current = buttons.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
  const next = buttons[(current + direction + buttons.length) % buttons.length];
  next.focus();
  selectPlan(next.dataset.plan);
});

document.querySelectorAll("a[href^='#']").forEach(link => {
  link.addEventListener("click", event => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    const header = document.querySelector(".viva-header");
    const offset = (header?.getBoundingClientRect().height || 0) + 18;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  });
});

contact?.addEventListener("click", () => {
  const id = contact.dataset.selectedPlan || "monthly";
  track("app_parceria_whatsapp_clique", {
    periodo: id,
    valor: plans[id]?.price || plans.monthly.price,
    destino: contact.href
  });
});

const header = document.querySelector(".viva-header");
const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 18);
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

const initialPlan = new URLSearchParams(window.location.search).get("periodo");
selectPlan(plans[initialPlan] ? initialPlan : "monthly", false);
track("app_parceria_acesso");
