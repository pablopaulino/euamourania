import { openingState, parseHours } from "./guideHours.mjs";

// Both the server cards and the filtered/paginated cards use the profile's hours logic.
export function guideAwardMeta(item, categoryMarkup) {
  const state = openingState(parseHours(item.opening_hours));
  const label = state?.label || (item.horario ? "Horário" : "");
  return `<div class="guide-award-meta" data-hours="${label}">${categoryMarkup}</div>`;
}
