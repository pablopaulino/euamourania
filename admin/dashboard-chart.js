const number = new Intl.NumberFormat("pt-BR");
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const weekdayDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const toUtcDate = key => new Date(key + "T12:00:00Z");

export function sparkline(values, colorClass = "blue") {
  if (!values || !values.length) return "";
  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const w = 96, h = 28, pad = 2;
  const len = values.length - 1 || 1;
  const pts = values.map((n, i) => {
    const x = pad + (i * (w - 2 * pad)) / len;
    const y = h - pad - ((n - min) / (max - min || 1)) * (h - 2 * pad);
    return [x.toFixed(1), y.toFixed(1)];
  });
  const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ");
  const areaPath = `${linePath} L${(w - pad).toFixed(1)} ${h} L${pad} ${h} Z`;
  const gradId = `spk-grad-${Math.random().toString(36).slice(2, 8)}`;

  return `
    <svg class="cock-spark ${colorClass}" viewBox="0 0 ${w} ${h}" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${gradId})" />
      <path d="${linePath}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

export function audienceChart(days) {
  if (!days || !days.length) return `<div class="cock-empty-chart">Sem dados de audiência no período selecionado.</div>`;

  const w = 760, h = 260;
  const left = 56, right = 744, top = 22, bottom = 216;
  const peak = Math.max(1, ...days.map(d => Math.max(d.views || 0, d.clicks || 0)));
  const unit = 10 ** Math.max(0, Math.floor(Math.log10(peak)));
  const step = Math.max(1, Math.ceil((peak / 4 / unit) * 2) * (unit / 2));
  const max = step * 4;

  const getX = i => left + ((right - left) * i) / (days.length - 1 || 1);
  const getY = n => bottom - (Math.min(max, Math.max(0, n)) / max) * (bottom - top);

  const line = key => days.map((d, i) => (i === 0 ? "M" : "L") + getX(i).toFixed(1) + " " + getY(d[key] || 0).toFixed(1)).join(" ");

  // Gridlines and horizontal Y-axis values
  const grid = Array.from({ length: 5 }, (_, i) => {
    const val = step * i;
    const yPos = getY(val);
    return `
      <g class="cock-grid-row">
        <path d="M${left} ${yPos.toFixed(1)} H${right}" class="cock-gridline" />
        <text x="46" y="${(yPos + 4).toFixed(1)}" text-anchor="end" class="cock-axis-text">${number.format(val)}</text>
      </g>
    `;
  }).join("");

  // X-axis date ticks (interval depending on number of days)
  const stepCount = days.length <= 8 ? 1 : days.length <= 15 ? 2 : 5;
  const ticks = days.map((d, i) => {
    const isBoundary = i === 0 || i === days.length - 1;
    const isStep = i % stepCount === 0 && i < days.length - 1;
    if (!isBoundary && !isStep) return "";
    const dateObj = toUtcDate(d.key);
    const text = days.length <= 8 ? weekdayDate.format(dateObj) : shortDate.format(dateObj);
    return `<text x="${getX(i).toFixed(1)}" y="242" text-anchor="middle" class="cock-axis-text">${text}</text>`;
  }).join("");

  // Interactive hover points and floating tooltips
  const points = days.map((d, i) => {
    const xPos = getX(i);
    const dateObj = toUtcDate(d.key);
    const dateStr = fullDate.format(dateObj);
    const viewsStr = number.format(d.views || 0);
    const clicksStr = number.format(d.clicks || 0);
    const sessionsStr = number.format(d.sessions?.size || 0);
    const label = `${dateStr}: ${viewsStr} visualizações, ${clicksStr} cliques comerciais`;

    const tipWidth = 210;
    const tx = Math.min(right - tipWidth, Math.max(left, xPos - tipWidth / 2));
    const slotWidth = (right - left) / (days.length - 1 || 1);

    return `
      <g class="cock-point" tabindex="0" role="img" aria-label="${label}">
        <rect x="${(xPos - slotWidth / 2).toFixed(1)}" y="${top}" width="${slotWidth.toFixed(1)}" height="${bottom - top}" fill="transparent" class="cock-hitbox"/>
        <g class="cock-tip" aria-hidden="true" pointer-events="none">
          <path d="M${xPos.toFixed(1)} ${top} V${bottom}" class="cock-guide-line" />
          <circle cx="${xPos.toFixed(1)}" cy="${getY(d.views || 0).toFixed(1)}" r="4.5" class="cock-dot views" />
          ${(d.clicks || 0) > 0 ? `<circle cx="${xPos.toFixed(1)}" cy="${getY(d.clicks || 0).toFixed(1)}" r="4" class="cock-dot clicks" />` : ""}
          <g class="cock-tip-box" transform="translate(${tx.toFixed(1)}, 26)">
            <rect width="${tipWidth}" height="56" rx="8" class="cock-tip-bg" />
            <text x="12" y="20" class="cock-tip-date">${dateStr}</text>
            <text x="12" y="36" class="cock-tip-stat blue">● ${viewsStr} visualizações</text>
            <text x="120" y="36" class="cock-tip-stat green">▲ ${clicksStr} cliques</text>
            <text x="12" y="49" class="cock-tip-sub">${sessionsStr} sessões únicas registradas</text>
          </g>
        </g>
      </g>
    `;
  }).join("");

  const viewsLine = line("views");
  const clicksLine = line("clicks");
  const areaClose = `L${right} ${bottom} H${left} Z`;

  return `
    <svg class="cock-chart" viewBox="0 0 ${w} ${h}" role="group" aria-label="Evolução diária de visualizações e cliques comerciais">
      <defs>
        <linearGradient id="cock-views-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#24678a" stop-opacity="0.22"/>
          <stop offset="85%" stop-color="#24678a" stop-opacity="0.02"/>
          <stop offset="100%" stop-color="#24678a" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${grid}
      ${ticks}
      <path d="${viewsLine} ${areaClose}" fill="url(#cock-views-fill)" />
      <path d="${viewsLine}" class="cock-line views" />
      <path d="${clicksLine}" class="cock-line clicks" />
      ${points}
    </svg>
  `;
}
