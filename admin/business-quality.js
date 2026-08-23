const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_ALIASES = {
  mon: ["mon", "monday", "segunda", "segunda-feira"],
  tue: ["tue", "tuesday", "terca", "terça", "terca-feira", "terça-feira"],
  wed: ["wed", "wednesday", "quarta", "quarta-feira"],
  thu: ["thu", "thursday", "quinta", "quinta-feira"],
  fri: ["fri", "friday", "sexta", "sexta-feira"],
  sat: ["sat", "saturday", "sabado", "sábado"],
  sun: ["sun", "sunday", "domingo"]
};

export const qualityFilterLabels = {
  all: "Todos",
  missing_hours: "Sem horário",
  missing_address: "Sem endereço",
  missing_whatsapp: "Sem WhatsApp",
  missing_image: "Sem imagem",
  missing_category: "Sem categoria",
  missing_description: "Sem descrição",
  missing_location: "Sem localização",
  low_score: "Baixa completude",
  complete: "Cadastros completos"
};

export const qualityFieldLabels = {
  name: "Nome",
  category: "Categoria",
  description: "Descrição",
  address: "Endereço",
  contact: "Telefone ou WhatsApp",
  whatsapp: "WhatsApp",
  image: "Imagem",
  structured_hours: "Horário do app",
  location: "Localização",
  social: "Instagram ou site"
};

export const qualityWarningLabels = {
  text_only_hours: "Horário apenas em texto",
  incomplete_structured_hours: "Horário estruturado incompleto",
  missing_week_days: "Dias da semana sem configuração",
  missing_coordinates: "Sem coordenadas precisas",
  weak_contact: "Contato pouco completo"
};

export const qualityWeights = {
  name: 15,
  category: 10,
  description: 10,
  address: 15,
  contact: 15,
  image: 10,
  structured_hours: 15,
  location: 10
};

function filled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(filled);
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function usefulAddress(value) {
  const text = String(value || "").trim();
  if (text.length < 5) return false;
  return !["sem endereco", "sem endereço", "nao informado", "não informado", "a definir"].includes(
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  );
}

function validCoordinates(latitude, longitude) {
  return latitude !== null
    && longitude !== null
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function hasImage(item = {}) {
  return filled(item.imagem_url) || filled(item.logo_url) || filled(item.capa_url) || filled(item.galeria_urls);
}

function normalizeOpeningHours(openingHours) {
  if (!openingHours || typeof openingHours !== "object" || Array.isArray(openingHours)) return {};
  return openingHours;
}

function dayRecord(openingHours, day) {
  const aliases = DAY_ALIASES[day] || [day];
  return aliases.reduce((found, key) => found || openingHours[key], null) || {};
}

function dayHasValidHours(dayConfig) {
  if (!dayConfig || typeof dayConfig !== "object") return false;
  if (dayConfig.closed === true || dayConfig.isClosed === true || dayConfig.open24h === true) return true;
  const periods = Array.isArray(dayConfig.periods) ? dayConfig.periods : Array.isArray(dayConfig.shifts) ? dayConfig.shifts : [];
  if (periods.some(period => filled(period?.open) && filled(period?.close))) return true;
  return filled(dayConfig.open) && filled(dayConfig.close);
}

function dayHasIncompleteHours(dayConfig) {
  if (!dayConfig || typeof dayConfig !== "object") return false;
  const periods = Array.isArray(dayConfig.periods) ? dayConfig.periods : Array.isArray(dayConfig.shifts) ? dayConfig.shifts : [];
  if (periods.some(period => filled(period?.open) !== filled(period?.close))) return true;
  return filled(dayConfig.open) !== filled(dayConfig.close);
}

export function getBusinessHoursQuality(item = {}) {
  const openingHours = normalizeOpeningHours(item.opening_hours);
  const configuredDays = DAY_KEYS.filter(day => DAY_ALIASES[day].some(alias => alias in openingHours));
  const validDays = configuredDays.filter(day => dayHasValidHours(dayRecord(openingHours, day)));
  const incompleteDays = configuredDays.filter(day => dayHasIncompleteHours(dayRecord(openingHours, day)));
  const hasStructuredHours = validDays.length > 0;
  const hasCompleteStructuredHours = DAY_KEYS.every(day => dayHasValidHours(dayRecord(openingHours, day)));
  const missingDays = DAY_KEYS.filter(day => !dayHasValidHours(dayRecord(openingHours, day)));

  return {
    hasStructuredHours,
    hasCompleteStructuredHours,
    configuredDays,
    validDays,
    incompleteDays,
    missingDays,
    hasTextOnlyHours: filled(item.horario) && !hasStructuredHours
  };
}

export function getBusinessDataQuality(item = {}) {
  const hours = getBusinessHoursQuality(item);
  const latitude = toNumber(item.latitude);
  const longitude = toNumber(item.longitude);
  const hasCoordinates = validCoordinates(latitude, longitude);
  const hasUsefulAddress = usefulAddress(item.endereco);
  const hasLocation = hasCoordinates || hasUsefulAddress;
  const hasContact = filled(item.whatsapp) || filled(item.telefone);
  const structuredHoursScore = hours.hasCompleteStructuredHours
    ? qualityWeights.structured_hours
    : hours.hasStructuredHours
      ? Math.round(qualityWeights.structured_hours * 0.6)
      : hours.hasTextOnlyHours
        ? Math.round(qualityWeights.structured_hours * 0.35)
        : 0;
  const checks = {
    name: filled(item.nome),
    category: filled(item.categoria_nome) || filled(item.categoria_id),
    description: filled(item.descricao),
    address: hasUsefulAddress,
    contact: hasContact,
    image: hasImage(item),
    structured_hours: hours.hasStructuredHours,
    location: hasLocation
  };

  const missingFields = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([field]) => field);

  if (!filled(item.whatsapp)) missingFields.push("whatsapp");

  const warnings = [];
  if (hours.hasTextOnlyHours) warnings.push("text_only_hours");
  if (hours.hasStructuredHours && (!hours.hasCompleteStructuredHours || hours.incompleteDays.length)) warnings.push("incomplete_structured_hours");
  if (hours.hasStructuredHours && hours.missingDays.length) warnings.push("missing_week_days");
  if (filled(item.mapa_url) && !hasCoordinates) warnings.push("missing_coordinates");
  if (hasContact && (!filled(item.whatsapp) || !filled(item.telefone))) warnings.push("weak_contact");

  const score = Math.max(0, Math.min(100, Math.round(
    (checks.name ? qualityWeights.name : 0)
    + (checks.category ? qualityWeights.category : 0)
    + (checks.description ? qualityWeights.description : 0)
    + (checks.address ? qualityWeights.address : 0)
    + (checks.contact ? qualityWeights.contact : 0)
    + (checks.image ? qualityWeights.image : 0)
    + structuredHoursScore
    + (checks.location ? qualityWeights.location : 0)
  )));
  const uniqueMissingFields = [...new Set(missingFields)];
  const criticalMissing = uniqueMissingFields.filter(field => ["name", "category", "address", "contact", "image", "location"].includes(field));

  return {
    score,
    missingFields: uniqueMissingFields,
    warnings: [...new Set(warnings)],
    hasStructuredHours: hours.hasStructuredHours,
    hasCompleteStructuredHours: hours.hasCompleteStructuredHours,
    hasCoordinates,
    hasUsefulAddress,
    hasLocation,
    isComplete: score >= 90 && criticalMissing.length === 0,
    essentialsMissing: criticalMissing,
    hours
  };
}

export function matchesBusinessQualityFilter(item = {}, filter = "all") {
  const quality = getBusinessDataQuality(item);
  if (filter === "all") return true;
  if (filter === "complete") return quality.isComplete;
  if (filter === "low_score") return quality.score < 70;
  if (filter === "missing_hours") return quality.missingFields.includes("structured_hours") || quality.warnings.some(warning => ["text_only_hours", "incomplete_structured_hours", "missing_week_days"].includes(warning));
  if (filter === "missing_address") return quality.missingFields.includes("address");
  if (filter === "missing_whatsapp") return quality.missingFields.includes("whatsapp");
  if (filter === "missing_image") return quality.missingFields.includes("image");
  if (filter === "missing_category") return quality.missingFields.includes("category");
  if (filter === "missing_description") return quality.missingFields.includes("description");
  if (filter === "missing_location") return quality.missingFields.includes("location");
  return true;
}

export function qualityPriorityScore(item = {}, quality = getBusinessDataQuality(item)) {
  const published = item.status === "publicado" ? 50 : 0;
  const commercialPriority = item.recomendado || item.destaque || item.destaque_home ? 35 : 0;
  const homePriority = item.destaque_home ? 20 : 0;
  const criticalMissing = quality.essentialsMissing.length * 6;
  const lowScore = Math.max(0, 100 - quality.score);
  return published + commercialPriority + homePriority + criticalMissing + lowScore;
}

export function summarizeBusinessQuality(items = []) {
  const active = items.filter(item => item?.status !== "arquivado");
  const count = filter => active.filter(item => matchesBusinessQualityFilter(item, filter)).length;
  const scored = active.map(item => getBusinessDataQuality(item));
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, quality) => sum + quality.score, 0) / scored.length)
    : 0;

  return {
    total: active.length,
    averageScore,
    missingHours: count("missing_hours"),
    missingAddress: count("missing_address"),
    missingWhatsapp: count("missing_whatsapp"),
    missingImage: count("missing_image"),
    missingCategory: count("missing_category"),
    missingDescription: count("missing_description"),
    missingLocation: count("missing_location"),
    lowScore: count("low_score"),
    complete: count("complete")
  };
}
