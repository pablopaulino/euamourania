const number = new Intl.NumberFormat("pt-BR");
const short = new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"2-digit",timeZone:"UTC"});
const long = new Intl.DateTimeFormat("pt-BR", {weekday:"long",day:"numeric",month:"long",timeZone:"UTC"});
const date = key => new Date(key + "T12:00:00Z");

export function sparkline(values) {
  if (!values.length) return "";
  const max = Math.max(1,...values);
  const points = values.map((n,i) => (2+i*92/(values.length-1 || 1)).toFixed(1)+","+(25-n/max*22).toFixed(1)).join(" ");
  return `<svg class="cock-spark" viewBox="0 0 96 28" aria-hidden="true"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

export function audienceChart(days) {
  const w=720, left=52, right=704, top=16, bottom=206;
  const peak=Math.max(1,...days.map(d=>Math.max(d.views,d.clicks)));
  const unit=10**Math.floor(Math.log10(peak));
  const step=Math.max(1,Math.ceil(peak/4/unit*2)*unit/2);
  const max=step*4;
  const x=i=>left+(right-left)*i/(days.length-1);
  const y=n=>bottom-n/max*(bottom-top);
  const line=key=>days.map((d,i)=>(i?"L":"M")+x(i).toFixed(1)+" "+y(d[key]).toFixed(1)).join(" ");
  const grid=Array.from({length:5},(_,i)=>`<path d="M${left} ${y(step*i)} H${right}" class="cock-gridline"/><text x="44" y="${y(step*i)+4}" text-anchor="end">${number.format(step*i)}</text>`).join("");
  const ticks=days.map((d,i)=>i===0||i===days.length-1||i%Math.ceil(days.length/5)===0&&i<days.length-2?`<text x="${x(i)}" y="232" text-anchor="middle">${short.format(date(d.key))}</text>`:"").join("");
  const points=days.map((d,i)=>{
    const label=`${long.format(date(d.key))} · ${number.format(d.views)} visualizações · ${number.format(d.clicks)} cliques`;
    const tx=Math.min(right-198,Math.max(left,x(i)-99));
    return `<g class="cock-point" tabindex="0" role="img" aria-label="${label}"><rect x="${x(i)-(right-left)/(days.length-1)/2}" y="${top}" width="${(right-left)/(days.length-1)}" height="${bottom-top}" fill="transparent"/><g class="cock-tip" aria-hidden="true" pointer-events="none"><path d="M${x(i)} ${top} V${bottom}" stroke="#72949e" stroke-dasharray="3 4"/><circle cx="${x(i)}" cy="${y(d.views)}" r="4" fill="#215f86"/><rect x="${tx}" y="28" width="198" height="49" rx="8"/><text x="${tx+10}" y="47">${long.format(date(d.key))}</text><text x="${tx+10}" y="66">${number.format(d.views)} visualizações · ${number.format(d.clicks)} cliques</text></g></g>`;
  }).join("");
  return `<svg class="cock-chart" viewBox="0 0 ${w} 246" role="group" aria-label="Visualizações e cliques por dia"><defs><linearGradient id="cock-fill" x2="0" y2="1"><stop stop-color="#3682a8" stop-opacity=".2"/><stop offset="1" stop-color="#3682a8" stop-opacity=".015"/></linearGradient></defs>${grid}${ticks}<path d="${line("views")} L${right} ${bottom} H${left} Z" fill="url(#cock-fill)"/><path d="${line("views")}" class="cock-line views"/><path d="${line("clicks")}" class="cock-line clicks"/>${points}</svg>`;
}
