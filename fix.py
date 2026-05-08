import sys

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('function drawScatter(svgId')
if idx == -1:
    sys.exit(1)

app_head = content[:idx]

new_js = """function drawScatter(svgId, data, xKey, yKey, rKey) {
  const svg = document.getElementById(svgId);
  if(!svg) return;
  const W = svg.parentElement.clientWidth;
  const H = parseInt(svg.getAttribute('height')) || 300;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  const pad = {t: 20, r: 20, b: 50, l: 60};
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  const isLogX = ['blendedPrice', 'inputPrice', 'outputPrice', 'contextWindow'].includes(xKey);
  const isLogY = ['blendedPrice', 'inputPrice', 'outputPrice', 'contextWindow'].includes(yKey);

  let xVals = data.map(m => m[xKey] || 0);
  let yVals = data.map(m => m[yKey] || 0);
  
  if (xVals.length === 0) return;

  const minX = isLogX ? Math.max(Math.min(...xVals)*0.5, 0.001) : Math.min(...xVals)*0.9;
  const maxX = Math.max(...xVals)*1.1;
  const minY = isLogY ? Math.max(Math.min(...yVals)*0.5, 0.001) : Math.min(...yVals)*0.9;
  const maxY = Math.max(...yVals)*1.1;

  const logMinX = Math.log10(minX); const logMaxX = Math.log10(maxX);
  const logMinY = Math.log10(minY); const logMaxY = Math.log10(maxY);

  const xScale = v => {
    if (isLogX) return pad.l + (Math.log10(Math.max(v, 0.001)) - logMinX) / (logMaxX - logMinX) * cW;
    return pad.l + ((v - minX) / (maxX - minX)) * cW;
  };
  const yScale = v => {
    if (isLogY) return pad.t + cH - (Math.log10(Math.max(v, 0.001)) - logMinY) / (logMaxY - logMinY) * cH;
    return pad.t + cH - ((v - minY) / (maxY - minY)) * cH;
  };

  const rScale = v => Math.max(3, Math.min(15, 3 + Math.sqrt((v||0) / 100) * 8));

  // Build grid
  const midX = isLogX ? Math.pow(10, (logMinX + logMaxX)/2) : (minX + maxX)/2;
  const midY = isLogY ? Math.pow(10, (logMinY + logMaxY)/2) : (minY + maxY)/2;

  const formatTick = v => (v < 1 ? v.toFixed(2) : (v > 1000 ? (v/1000).toFixed(0)+'k' : v.toFixed(0)));

  let grid = `
    <!-- Y axis lines -->
    <line stroke="rgba(255,255,255,0.05)" x1="${pad.l}" y1="${yScale(minY)}" x2="${pad.l+cW}" y2="${yScale(minY)}" />
    <text x="${pad.l-5}" y="${yScale(minY)}" fill="var(--text3)" font-size="10" text-anchor="end" dominant-baseline="middle">${formatTick(minY)}</text>
    
    <line stroke="rgba(255,255,255,0.05)" x1="${pad.l}" y1="${yScale(midY)}" x2="${pad.l+cW}" y2="${yScale(midY)}" />
    <text x="${pad.l-5}" y="${yScale(midY)}" fill="var(--text3)" font-size="10" text-anchor="end" dominant-baseline="middle">${formatTick(midY)}</text>

    <line stroke="rgba(255,255,255,0.05)" x1="${pad.l}" y1="${yScale(maxY)}" x2="${pad.l+cW}" y2="${yScale(maxY)}" />
    <text x="${pad.l-5}" y="${yScale(maxY)}" fill="var(--text3)" font-size="10" text-anchor="end" dominant-baseline="middle">${formatTick(maxY)}</text>

    <!-- X axis lines -->
    <line stroke="rgba(255,255,255,0.05)" x1="${xScale(minX)}" y1="${pad.t}" x2="${xScale(minX)}" y2="${pad.t+cH}" />
    <text x="${xScale(minX)}" y="${pad.t+cH+15}" fill="var(--text3)" font-size="10" text-anchor="middle">${formatTick(minX)}</text>

    <line stroke="rgba(255,255,255,0.05)" x1="${xScale(midX)}" y1="${pad.t}" x2="${xScale(midX)}" y2="${pad.t+cH}" />
    <text x="${xScale(midX)}" y="${pad.t+cH+15}" fill="var(--text3)" font-size="10" text-anchor="middle">${formatTick(midX)}</text>

    <line stroke="rgba(255,255,255,0.05)" x1="${xScale(maxX)}" y1="${pad.t}" x2="${xScale(maxX)}" y2="${pad.t+cH}" />
    <text x="${xScale(maxX)}" y="${pad.t+cH+15}" fill="var(--text3)" font-size="10" text-anchor="middle">${formatTick(maxX)}</text>
  `;

  // Dots
  const dots = data.map(m => {
    const vx = m[xKey] || 0.001, vy = m[yKey] || 0.001, vr = m[rKey] || 50;
    const x = xScale(vx), y = yScale(vy), r = rScale(vr);
    const c = PROVIDER_COLORS[m.provider] || '#6366f1';
    return `<circle class="scatter-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}"
      fill="${c}" fill-opacity="0.75" stroke="${c}" stroke-width="1.5"
      onmouseenter="showTip(event,'${m.id}')" onmouseleave="hideTip()" onclick="window.open('${m.link}','_blank')"/>`;
  }).join('');

  svg.innerHTML = `
    ${grid}
    ${dots}
    <text class="axis-label" x="${pad.l+cW/2}" y="${H-10}" text-anchor="middle" fill="var(--text2)" font-size="11" font-weight="600">${xKey} ${isLogX?'(log)':''}</text>
    <text class="axis-label" x="15" y="${pad.t+cH/2}" text-anchor="middle" transform="rotate(-90,15,${pad.t+cH/2})" fill="var(--text2)" font-size="11" font-weight="600">${yKey} ${isLogY?'(log)':''}</text>
    <line stroke="rgba(255,255,255,0.1)" stroke-width="1" x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+cH}"/>
    <line stroke="rgba(255,255,255,0.1)" stroke-width="1" x1="${pad.l}" y1="${pad.t+cH}" x2="${pad.l+cW}" y2="${pad.t+cH}"/>`;
}

function renderPlotter() {
  const xKey = document.getElementById('plot-x').value;
  const yKey = document.getElementById('plot-y').value;
  const osOnly = document.getElementById('plot-os-only').checked;
  const curatedOnly = document.getElementById('plot-curated-only').checked;

  let data = MODELS.filter(m => {
    if (osOnly && !m.openSource) return false;
    if (curatedOnly && !m.curated) return false;
    return true;
  });

  drawScatter('plotter-svg', data, xKey, yKey, 'speed');

  const provs = [...new Set(data.map(m => m.provider))];
  document.getElementById('plotter-legend').innerHTML = provs.map(p => {
    const c = PROVIDER_COLORS[p] || '#6366f1';
    return `<div class="legend-item"><div class="legend-dot" style="background:${c}"></div>${p}</div>`;
  }).join('');
}

function renderDashboard() {
  const curatedData = MODELS.filter(m => m.curated);
  drawScatter('dash-svg-1', curatedData, 'blendedPrice', 'intelligenceScore', 'speed');
  drawScatter('dash-svg-2', curatedData, 'latency', 'speed', 'intelligenceScore');
  drawScatter('dash-svg-3', curatedData, 'inputPrice', 'contextWindow', 'intelligenceScore');
  drawScatter('dash-svg-4', curatedData, 'speed', 'intelligenceScore', 'contextWindow');
}
"""

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(app_head + new_js)
