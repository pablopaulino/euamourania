const zone = "America/Sao_Paulo";
const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
});

export function eventDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatter.format(date).replace(" ", "T").slice(0, 16);
}

export function eventDateToIso(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error("Informe uma data e horário válidos (horário de Brasília).");
  const wall = Date.parse(`${value}Z`);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const displayed = Date.parse(formatter.format(new Date(instant)).replace(" ", "T") + "Z");
    instant += wall - displayed;
  }
  const iso = new Date(instant).toISOString();
  if (eventDateInput(iso) !== value.slice(0, 16)) throw new Error("Data ou horário inválido em Brasília.");
  return iso;
}

export function normalizeEventDates(table, payload) {
  if (!["eventos", "eventos_edicoes"].includes(table)) return payload;
  for (const name of ["data_inicio", "data_fim", "recorrencia_ate"]) {
    if (Object.prototype.hasOwnProperty.call(payload, name)) payload[name] = eventDateToIso(payload[name]);
  }
  return payload;
}
