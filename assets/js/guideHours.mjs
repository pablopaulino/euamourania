export const DAYS = [
  ["mon", "Segunda"], ["tue", "Terça"], ["wed", "Quarta"], ["thu", "Quinta"],
  ["fri", "Sexta"], ["sat", "Sábado"], ["sun", "Domingo"]
];


export function parseHours(raw) {
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return []; } }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return DAYS.map(([key, label]) => {
    const item = raw[key];
    if (!item || typeof item !== "object") return null;
    if (item.closed === true || item.isClosed === true) return { key, label, closed: true, periods: [] };
    if (item.twenty_four_hours || item.open_24h || item.is_24h || item.all_day) return { key, label, allDay: true, periods: [["00:00", "24:00"]] };
    const candidates = Array.isArray(item.periods) ? item.periods : Array.isArray(item.shifts) ? item.shifts : [item];
    const periods = candidates.map(period => [String(period?.open || ""), String(period?.close || "")]).filter(([open, close]) => /^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close));
    return periods.length ? { key, label, periods } : null;
  }).filter(Boolean);
}

export function openingState(hours) {
  if (!hours.length) return null;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const weekday = parts.find(part => part.type === "weekday")?.value?.toLowerCase().slice(0, 3);
  const hour = Number(parts.find(part => part.type === "hour")?.value || 0);
  const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
  const today = hours.find(day => day.key === weekday);
  if (!today || today.closed) return { open: false, label: "Fechado agora" };
  if (today.allDay) return { open: true, label: "Aberto agora", detail: "24 horas" };
  const value = hour * 60 + minute;
  const active = today.periods.find(([open, close]) => {
    const [oh, om] = open.split(":").map(Number), [ch, cm] = close.split(":").map(Number);
    const start = oh * 60 + om, end = close === "24:00" ? 1440 : ch * 60 + cm;
    return end >= start ? value >= start && value < end : value >= start || value < end;
  });
  return active ? { open: true, label: "Aberto agora", detail: `Fecha às ${active[1].replace(":", "h")}` } : { open: false, label: "Fechado agora" };
}
