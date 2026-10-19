export function verifiedBadge(active) {
  return active === true ? '<span class="viva-verified" role="img" tabindex="0" aria-label="Empresa Verificada · Parceiro Oficial Viva Urânia" title="Empresa Verificada · Parceiro Oficial Viva Urânia"><img src="/assets/viva-verified.svg" width="18" height="18" alt="" aria-hidden="true"><span class="viva-verified-tooltip" aria-hidden="true">Empresa Verificada · Parceiro Oficial Viva Urânia</span></span>' : '';
}

// Receives already escaped text and keeps its last word with the badge.
export function verifiedName(escapedName, active) {
  if (active !== true) return escapedName;
  const name = String(escapedName ?? "").trim();
  const match = /^(.*\s)(\S+)$/s.exec(name);
  const prefix = match?.[1] || "";
  const lastWord = match?.[2] || name;
  return `${prefix}<span class="viva-verified-keep">${lastWord}${verifiedBadge(true)}</span>`;
}
