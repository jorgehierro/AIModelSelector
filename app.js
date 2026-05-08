/* ── State ── */
let activeFilters={tasks:[],providers:[],deploy:[],openSource:false,multimodal:false,supportsFinetuning:false};
let viewMode='grid';
let compareSet=new Set();
let wizardAnswers={};
let wizardStep=0;

const STEPS=[
  {id:'task',title:"What's your primary task?",sub:'Pick all that apply',type:'multi',
   opts:TASKS.map(t=>({val:t.id,icon:t.icon,label:t.label,desc:t.desc}))},
  {id:'budget',title:"What's your budget?",sub:'Per million tokens (blended price)',type:'single',
   opts:[{val:0.5,icon:'🆓',label:'Free / Open-source',desc:'Self-host or <$0.5/M'},{val:2,icon:'💚',label:'Low Cost',desc:'Under $2/M tokens'},{val:8,icon:'💛',label:'Medium',desc:'Under $8/M tokens'},{val:999,icon:'💜',label:'No Limit',desc:'Best quality regardless'}]},
  {id:'context',title:'How much context do you need?',sub:'Input size requirements',type:'single',
   opts:[{val:8000,icon:'📄',label:'Short (<8K)',desc:'Single doc, short chat'},{val:32000,icon:'📑',label:'Medium (32K)',desc:'Long docs, codebases'},{val:128000,icon:'📚',label:'Large (128K)',desc:'Books, big projects'},{val:1000000,icon:'🌊',label:'Massive (1M+)',desc:'Entire repos, hours of video'}]},
  {id:'speed',title:'How important is speed?',sub:'Response latency requirements',type:'single',
   opts:[{val:'fast',icon:'⚡',label:'Real-time',desc:'Live chat, <1s latency'},{val:'balanced',icon:'⚖️',label:'Balanced',desc:'Normal API usage'},{val:'quality',icon:'🎯',label:'Quality first',desc:'Batch, accuracy > speed'}]},
  {id:'deploy',title:'Where will you deploy?',sub:'Hosting & infrastructure',type:'multi',
   opts:[{val:'api',icon:'☁️',label:'Cloud API',desc:'Managed, pay-per-use'},{val:'self-hosted',icon:'🖥️',label:'Self-hosted',desc:'Your own servers'},{val:'on-device',icon:'📱',label:'On-device / Edge',desc:'Mobile or offline'}]},
  {id:'needs',title:'Any special requirements?',sub:'Select all that apply',type:'multi',
   opts:[{val:'openSource',icon:'🔓',label:'Open Source',desc:'Inspect & modify weights'},{val:'multimodal',icon:'🖼️',label:'Multimodal',desc:'Images, audio, video'},{val:'supportsFinetuning',icon:'⚙️',label:'Fine-tuning',desc:'Train on your data'},{val:'privacy',icon:'🔒',label:'Privacy / HIPAA',desc:'Self-hosted or compliant'},{val:'multilingual',icon:'🌍',label:'Multilingual',desc:'Non-English languages'}]}
];

/* ── View Switch ── */
function showView(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(x=>x.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  document.getElementById('tab-'+v).classList.add('active');
  if(v==='explorer') initExplorer();
  if(v==='chart') renderChart();
}

/* ══════════════════════════════════
   WIZARD
══════════════════════════════════ */
function initWizard(){
  wizardStep=0; wizardAnswers={};
  renderProgress(); renderStep();
}

function renderProgress(){
  const el=document.getElementById('wizard-progress');
  el.innerHTML=STEPS.map((s,i)=>{
    const cls=i<wizardStep?'done':i===wizardStep?'active':'';
    return`<div class="wp-step ${cls}"><div class="wp-dot">${i<wizardStep?'✓':i+1}</div><div class="wp-label">${s.title.split(' ').slice(0,2).join(' ')}</div></div>`;
  }).join('');
}

function renderStep(){
  document.getElementById('wizard-results').style.display='none';
  const sc=document.getElementById('wizard-step-container');
  if(wizardStep>=STEPS.length){showResults();return;}
  const s=STEPS[wizardStep];
  const cur=wizardAnswers[s.id]||(s.type==='multi'?[]:'');
  const optsHtml=s.opts.map(o=>{
    const sel=s.type==='multi'?(cur.includes(o.val)?'selected':''):(cur===o.val?'selected':'');
    return`<button class="option-btn ${sel}" onclick="selectOpt('${s.id}','${o.val}','${s.type}')" data-val="${o.val}">
      <span class="opt-icon">${o.icon}</span>
      <span class="opt-label">${o.label}</span>
      <span class="opt-desc">${o.desc}</span>
    </button>`;
  }).join('');
  sc.innerHTML=`<div class="wizard-card fade-up">
    <h2>${s.title}</h2>
    <p class="sub">${s.sub}${s.type==='multi'?' (select multiple)':''}</p>
    <div class="options-grid">${optsHtml}</div>
    <div class="wizard-nav">
      <button class="btn btn-ghost" onclick="wizardBack()" ${wizardStep===0?'disabled':''}>← Back</button>
      <button class="btn btn-primary" onclick="wizardNext()">
        ${wizardStep===STEPS.length-1?'See Results →':'Next →'}
      </button>
    </div>
  </div>`;
}

function selectOpt(stepId,val,type){
  const parsed=isNaN(val)?val:(Number(val)||val);
  if(type==='single'){
    wizardAnswers[stepId]=parsed;
  } else {
    if(!wizardAnswers[stepId]) wizardAnswers[stepId]=[];
    const arr=wizardAnswers[stepId];
    const idx=arr.indexOf(val);
    if(idx>=0) arr.splice(idx,1); else arr.push(val);
    wizardAnswers[stepId]=[...arr];
  }
  renderStep();
}

function wizardNext(){wizardStep++;renderProgress();renderStep();}
function wizardBack(){if(wizardStep>0){wizardStep--;renderProgress();renderStep();}}

function showResults(){
  document.getElementById('wizard-step-container').innerHTML='';
  const r=document.getElementById('wizard-results');
  r.style.display='block';
  const scored=scoreModels();
  const top=scored.slice(0,5);
  r.innerHTML=`<div class="results-header fade-up">
    <h2>🎯 Your Top Model Picks</h2>
    <p>Based on your requirements — sorted by match score</p>
  </div>
  <div class="results-grid">
    ${top.map((m,i)=>renderResultCard(m,i)).join('')}
  </div>
  <div style="text-align:center;margin-top:24px">
    <button class="btn btn-ghost" onclick="initWizard()">↺ Start Over</button>
    <button class="btn btn-primary" style="margin-left:12px" onclick="showView('explorer')">Explore All Models →</button>
  </div>`;
}

function scoreModels(){
  return MODELS.map(m=>{
    let score=m.intelligenceScore;
    const tasks=wizardAnswers.task||[];
    const matchedTasks=tasks.filter(t=>m.tasks.includes(t)).length;
    score+=matchedTasks*15;
    const budget=wizardAnswers.budget;
    if(budget&&m.blendedPrice<=budget) score+=20;
    else if(budget&&m.blendedPrice>budget) score-=30;
    const ctx=wizardAnswers.context;
    if(ctx&&m.contextWindow>=ctx) score+=10;
    const spd=wizardAnswers.speed;
    if(spd==='fast'&&m.speed>100) score+=15;
    if(spd==='quality'&&m.intelligenceScore>75) score+=10;
    const deploys=wizardAnswers.deploy||[];
    if(deploys.length&&deploys.some(d=>m.deploymentOptions.includes(d))) score+=10;
    const needs=wizardAnswers.needs||[];
    needs.forEach(n=>{if(m[n]===true) score+=12; if(n==='privacy'&&m.openSource) score+=10;});
    return{...m,_score:score};
  }).sort((a,b)=>b._score-a._score);
}

function renderResultCard(m,i){
  const provColor=PROVIDER_COLORS[m.provider]||'#6366f1';
  return`<div class="result-card ${i===0?'top-pick':''} fade-up fade-up-${Math.min(i+1,4)}" onclick="window.open('${m.link}','_blank')">
    <div class="rc-rank ${i===0?'gold':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1)}</div>
    <div class="rc-body">
      <div class="rc-name">${m.name}</div>
      <div class="rc-provider" style="color:${provColor}">${m.provider}</div>
      <div class="rc-desc">${m.description}</div>
      <div class="rc-tags">
        ${m.openSource?'<span class="tag green">Open Source</span>':''}
        ${m.multimodal?'<span class="tag">Multimodal</span>':''}
        ${m.supportsFinetuning?'<span class="tag amber">Fine-tunable</span>':''}
        ${m.tasks.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}
      </div>
    </div>
    <div class="rc-stats">
      <div class="stat-pill"><div class="val" style="color:var(--accent)">${m.intelligenceScore}</div><div class="lbl">IQ Score</div></div>
      <div class="stat-pill"><div class="val">$${m.blendedPrice<1?m.blendedPrice.toFixed(2):m.blendedPrice.toFixed(1)}</div><div class="lbl">/M tokens</div></div>
      <div class="stat-pill"><div class="val">${m.speed}</div><div class="lbl">tok/s</div></div>
    </div>
  </div>`;
}

/* ══════════════════════════════════
   EXPLORER
══════════════════════════════════ */
function initExplorer(){
  buildChips();
  document.getElementById('model-count').textContent=MODELS.length;
  applyFilters();
}

function buildChips(){
  // Task chips
  const tc=document.getElementById('task-chips');
  if(!tc.children.length){
    TASKS.forEach(t=>{
      const d=document.createElement('div');
      d.className='chip'; d.id='tc-'+t.id;
      d.textContent=t.icon+' '+t.label;
      d.onclick=()=>{toggleFilter('tasks',t.id,'tc-'+t.id);};
      tc.appendChild(d);
    });
  }
  // Provider Dropdown (Custom)
  const pc=document.getElementById('cs-provider-options');
  if(pc){
    pc.innerHTML = `<div class="cs-option ${customSelectValues['cs-provider']===''?'active':''}" onclick="selectCustomOption('cs-provider', '', 'All Providers')">All Providers</div>`;
    const provs=[...new Set(MODELS.map(m=>m.provider))].sort();
    provs.forEach(p=>{
      const d=document.createElement('div');
      d.className='cs-option '+(customSelectValues['cs-provider']===p?'active':'');
      d.textContent=p;
      d.onclick=(e)=>{selectCustomOption('cs-provider',p,p);};
      pc.appendChild(d);
    });
  }
  // Deploy chips
  const dc=document.getElementById('deploy-chips');
  if(!dc.children.length){
    [{v:'api',l:'☁️ Cloud API'},{v:'self-hosted',l:'🖥️ Self-hosted'},{v:'on-device',l:'📱 On-device'}].forEach(x=>{
      const d=document.createElement('div');
      d.className='chip'; d.id='dc-'+x.v;
      d.textContent=x.l;
      d.onclick=()=>{toggleFilter('deploy',x.v,'dc-'+x.v);};
      dc.appendChild(d);
    });
  }
}

function toggleFilter(key,val,chipId){
  const arr=activeFilters[key];
  const idx=arr.indexOf(val);
  if(idx>=0) arr.splice(idx,1); else arr.push(val);
  document.getElementById(chipId).classList.toggle('active');
  applyFilters();
}

function changeProviderFilter(val) {
  activeFilters.providers = val ? [val] : [];
  applyFilters();
}

function toggleChip(chipId,prop){
  activeFilters[prop]=!activeFilters[prop];
  document.getElementById(chipId).classList.toggle('active');
  applyFilters();
}

function getFiltered(){
  const q=(document.getElementById('search-input')?.value||'').toLowerCase();
  const scoreMin=+document.getElementById('score-min').value;
  const priceInMax=+document.getElementById('price-in-max').value;
  const priceOutMax=+document.getElementById('price-out-max').value;
  const speedMin=+document.getElementById('speed-min').value;
  return MODELS.filter(m=>{
    if(q&&!m.name.toLowerCase().includes(q)&&!m.provider.toLowerCase().includes(q)&&!m.description.toLowerCase().includes(q)) return false;
    if(activeFilters.tasks.length&&!activeFilters.tasks.some(t=>m.tasks.includes(t))) return false;
    if(activeFilters.providers.length&&!activeFilters.providers.includes(m.provider)) return false;
    if(activeFilters.deploy.length&&!activeFilters.deploy.some(d=>m.deploymentOptions.includes(d))) return false;
    if(activeFilters.openSource&&!m.openSource) return false;
    if(activeFilters.multimodal&&!m.multimodal) return false;
    if(activeFilters.supportsFinetuning&&!m.supportsFinetuning) return false;
    if(m.intelligenceScore<scoreMin) return false;
    if(m.inputPrice>priceInMax) return false;
    if(m.outputPrice>priceOutMax) return false;
    if(m.speed<speedMin) return false;
    return true;
  });
}

function sortModels(arr){
  const sortVal=customSelectValues['cs-sort'] || 'intelligenceScore-desc';
  const [col,dir]=sortVal.split('-');
  return arr.sort((a,b)=>{
    let va=a[col],vb=b[col];
    if(typeof va==='string') return dir==='asc'?va.localeCompare(vb):vb.localeCompare(va);
    return dir==='asc'?va-vb:vb-va;
  });
}

function applyFilters(){
  const filtered=sortModels(getFiltered());
  document.getElementById('filtered-count').textContent=filtered.length;
  const c=document.getElementById('models-container');
  if(!filtered.length){
    c.innerHTML=`<div class="empty-state"><div class="icon">🔍</div><h3>No models match your filters</h3><p>Try relaxing some criteria</p></div>`;
    return;
  }
  if(viewMode==='grid') c.innerHTML=`<div class="models-grid">${filtered.map(renderModelCard).join('')}</div>`;
  else renderTable(filtered,c);
}

function renderModelCard(m){
  const pc=PROVIDER_COLORS[m.provider]||'#6366f1';
  const pct=m.intelligenceScore;
  const checked=compareSet.has(m.id)?'checked':'';
  return`<div class="model-card">
    <div class="mc-header">
      <div class="mc-title">
        <div class="mc-name">${m.name}</div>
        <span class="mc-provider" style="background:${pc}22;color:${pc}">${m.provider}</span>
      </div>
      <div class="mc-badge">
        ${m.openSource?'<span class="badge badge-os">Open</span>':''}
        ${m.multimodal?'<span class="badge badge-mm">Multimodal</span>':''}
        ${m.supportsFinetuning?'<span class="badge badge-ft">Fine-tune</span>':''}
      </div>
    </div>
    <div class="mc-score-bar">
      <div class="sb-label"><span>Intelligence Score</span><b>${m.intelligenceScore}/100</b></div>
      <div class="sb-track"><div class="sb-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="mc-stats">
      <div class="mc-stat"><div class="sv">$${m.inputPrice<1?m.inputPrice.toFixed(2):m.inputPrice.toFixed(1)} / $${m.outputPrice<1?m.outputPrice.toFixed(2):m.outputPrice.toFixed(1)}</div><div class="sl">In/Out per M</div></div>
      <div class="mc-stat"><div class="sv">${m.speed}</div><div class="sl">tok/s</div></div>
      <div class="mc-stat"><div class="sv">${m.latency?m.latency+'ms':'-'}</div><div class="sl">TTFT</div></div>
    </div>
    <div style="font-size: .75rem; color: var(--text3); padding: 0 20px;">
      Platform: <b>${m.platforms && m.platforms.length > 0 ? m.platforms[0].name : 'Various'}</b>
    </div>
    <div class="mc-footer">
      <div class="mc-tasks">${m.tasks.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <a href="${m.link}" target="_blank" style="color:var(--accent);font-size:.78rem;font-weight:600;text-decoration:none">Docs ↗</a>
        <div class="mc-check">
          <input type="checkbox" id="cmp-${m.id}" ${checked} onchange="toggleCompare('${m.id}')"/>
          <label for="cmp-${m.id}">Compare</label>
        </div>
      </div>
    </div>
  </div>`;
}

function renderTable(arr,c){
  c.innerHTML=`<div style="overflow-x:auto"><table class="models-table">
    <thead><tr>
      <th onclick="sortByCol('name')">Model</th>
      <th onclick="sortByCol('provider')">Provider</th>
      <th onclick="sortByCol('intelligenceScore')">IQ Score</th>
      <th onclick="sortByCol('inputPrice')">In Price /M</th>
      <th onclick="sortByCol('outputPrice')">Out Price /M</th>
      <th onclick="sortByCol('speed')">Speed</th>
      <th onclick="sortByCol('latency')">Latency</th>
      <th onclick="sortByCol('contextWindow')">Context</th>
      <th>Platforms</th>
    </tr></thead>
    <tbody>${arr.map(m=>{
      const pc=PROVIDER_COLORS[m.provider]||'#6366f1';
      return`<tr>
        <td><b>${m.name}</b></td>
        <td><span style="color:${pc};font-weight:600">${m.provider}</span></td>
        <td><div class="score-cell">${m.intelligenceScore}<div class="score-mini-bar"><div class="score-mini-fill" style="width:${m.intelligenceScore}%"></div></div></div></td>
        <td>$${m.inputPrice<1?m.inputPrice.toFixed(2):m.inputPrice.toFixed(1)}</td>
        <td>$${m.outputPrice<1?m.outputPrice.toFixed(2):m.outputPrice.toFixed(1)}</td>
        <td>${m.speed} t/s</td>
        <td>${m.latency?m.latency+'ms':'-'}</td>
        <td>${m.contextWindow>=1000000?'1M':(m.contextWindow/1000)+'K'}</td>
        <td style="font-size:0.7rem">${m.platforms?m.platforms.map(p=>p.name).join(', '):'-'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function setViewMode(v){
  viewMode=v;
  document.getElementById('vt-grid').classList.toggle('active',v==='grid');
  document.getElementById('vt-table').classList.toggle('active',v==='table');
  applyFilters();
}

function resetFilters(){
  activeFilters={tasks:[],providers:[],deploy:[],openSource:false,multimodal:false,supportsFinetuning:false};
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));
  document.getElementById('score-min').value=0; document.getElementById('score-val').textContent='0';
  document.getElementById('price-in-max').value=40; document.getElementById('price-in-val').textContent='$40';
  document.getElementById('price-out-max').value=40; document.getElementById('price-out-val').textContent='$40';
  document.getElementById('speed-min').value=0; document.getElementById('speed-val').textContent='0';
  document.getElementById('search-input').value='';
  customSelectValues['cs-provider'] = '';
  if(document.getElementById('cs-provider-val')) document.getElementById('cs-provider-val').textContent = 'All Providers';
  applyFilters();
}

/* Compare */
function toggleCompare(id){
  if(compareSet.has(id)) compareSet.delete(id);
  else{ if(compareSet.size>=3){alert('Max 3 models');document.getElementById('cmp-'+id).checked=false;return;} compareSet.add(id);}
  const bar=document.getElementById('compare-bar');
  bar.classList.toggle('show',compareSet.size>0);
  document.getElementById('compare-count').textContent=compareSet.size;
}
function clearCompare(){compareSet.clear();applyFilters();document.getElementById('compare-bar').classList.remove('show');}
function openCompareModal(){
  const models=[...compareSet].map(id=>MODELS.find(m=>m.id===id));
  const cols=models.map(m=>{
    const pc=PROVIDER_COLORS[m.provider]||'#6366f1';
    return`<div class="compare-col">
      <h4>${m.name}</h4><div class="prov" style="color:${pc}">${m.provider}</div>
      ${[['Intelligence',m.intelligenceScore+'/100'],['Input Price','$'+m.inputPrice.toFixed(2)+'/M'],['Output Price','$'+m.outputPrice.toFixed(2)+'/M'],['Speed',m.speed+' tok/s'],['Latency',m.latency?m.latency+'ms':'-'],['Context',m.contextWindow>=1000000?'1M':(m.contextWindow/1000)+'K'],['Open Source',m.openSource?'✅':'❌'],['Multimodal',m.multimodal?'✅':'❌'],['Fine-tuning',m.supportsFinetuning?'✅':'❌'],['Platforms',m.platforms?m.platforms.map(p=>p.name+(p.regions?' ('+p.regions.join(',')+')':'')).join('<br>'):'-']]
      .map(([l,v])=>`<div class="compare-row"><span>${l}</span><span style="text-align:right">${v}</span></div>`).join('')}
    </div>`;
  }).join('');
  document.getElementById('compare-modal-body').innerHTML=`<div class="compare-cols" style="grid-template-columns:repeat(${models.length},1fr)">${cols}</div>`;
  document.getElementById('compare-modal').classList.add('open');
}
function closeCompareModal(e){if(!e||e.target.id==='compare-modal')document.getElementById('compare-modal').classList.remove('open');}

/* ══════════════════════════════════
   SCATTER CHART
══════════════════════════════════ */
// Old renderChart removed

function showTip(e,id){
  const m=MODELS.find(x=>x.id===id);
  const tip=document.getElementById('chart-tooltip');
  const pc=PROVIDER_COLORS[m.provider]||'#6366f1';
  tip.innerHTML=`<h4>${m.name}</h4><div class="tp" style="color:${pc}">${m.provider}</div>
    <div class="rows">
      <div class="row"><span>Intelligence</span><span>${m.intelligenceScore}/100</span></div>
      <div class="row"><span>Price (in/out)</span><span>$${m.inputPrice.toFixed(2)} / $${m.outputPrice.toFixed(2)}</span></div>
      <div class="row"><span>Speed</span><span>${m.speed} tok/s</span></div>
      <div class="row"><span>Latency</span><span>${m.latency}ms</span></div>
      <div class="row"><span>Context</span><span>${m.contextWindow>=1000000?'1M':(m.contextWindow/1000)+'K'}</span></div>
      <div class="row"><span>Curated</span><span>${m.curated?'✅ Verified':'❌ Dynamic API'}</span></div>
    </div>`;
  const box=document.getElementById('chart-container').getBoundingClientRect();
  const tx=Math.min(e.clientX-box.left+12, box.width-220);
  const ty=Math.max(e.clientY-box.top-80,0);
  tip.style.left=tx+'px'; tip.style.top=ty+'px'; tip.style.display='block';
}
function hideTip(){document.getElementById('chart-tooltip').style.display='none';}

/* ── Boot & Fetch ── */
async function fetchLiveModels() {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    
    const existingIds = new Set(MODELS.map(m => m.id.toLowerCase()));
    
    const newModels = data.data.filter(m => {
      // Try to avoid duplicates by checking base IDs
      const simpleId = m.id.split('/').pop().toLowerCase();
      // Skip if we already curated it
      if (existingIds.has(simpleId) || existingIds.has(m.id.toLowerCase())) return false;
      // Skip very niche or routing endpoints if we want, but let's keep it inclusive
      return true;
    }).map(m => {
      // Parse pricing (OpenRouter gives price per 1 token, we need per 1M)
      const promptPrice = parseFloat(m.pricing?.prompt || 0) * 1000000;
      const compPrice = parseFloat(m.pricing?.completion || 0) * 1000000;
      const blendedPrice = (promptPrice + compPrice) / 2;
      
      const isFree = blendedPrice === 0;
      const providerRaw = m.id.split('/')[0];
      const provider = providerRaw.charAt(0).toUpperCase() + providerRaw.slice(1);
      
      return {
        id: m.id,
        name: m.name || m.id,
        provider: provider,
        family: provider,
        tasks: ["text"], // Default
        openSource: m.id.includes("llama") || m.id.includes("mistral") || m.id.includes("qwen") || m.id.includes("deepseek") || isFree,
        contextWindow: m.context_length || 8000,
        inputPrice: promptPrice,
        outputPrice: compPrice,
        blendedPrice: blendedPrice,
        speed: 50, // Default estimated speed
        latency: 500, // Default latency
        platforms: [{name: "OpenRouter"}],
        intelligenceScore: 50, // Default middle ground score
        supportsFinetuning: false,
        multimodal: m.architecture?.modality?.includes("image") || false,
        deploymentOptions: ["api"],
        license: isFree ? "open" : "proprietary",
        description: m.description ? m.description.split('.')[0] + '.' : "Live model fetched dynamically from OpenRouter.",
        tags: ["API-fetched"],
        link: "https://openrouter.ai/models/" + m.id,
        releaseYear: new Date().getFullYear()
      };
    });
    
    MODELS = [...MODELS, ...newModels];
    document.getElementById('model-count').textContent = MODELS.length;
    
  } catch (err) {
    console.error("Failed to fetch live models:", err);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('wizard-step-container').innerHTML = '<div style="text-align:center;padding:60px;color:var(--text2)">Fetching the latest live models... ⏳</div>';
  await fetchLiveModels();
  initWizard();
  // If Explorer was initialized early, re-initialize to show new models
  if (document.getElementById('view-explorer').classList.contains('active')) initExplorer();
});

window.addEventListener('resize',()=>{if(document.getElementById('view-chart').classList.contains('active'))renderChart();});

/* Custom Select Logic */
let customSelectValues = {
  'cs-sort': 'intelligenceScore-desc',
  'cs-provider': ''
};

function toggleCustomSelect(id) {
  document.querySelectorAll('.custom-select').forEach(el => {
    if (el.id !== id) el.classList.remove('open');
  });
  document.getElementById(id).classList.toggle('open');
}

function selectCustomOption(parentId, value, text) {
  customSelectValues[parentId] = value;
  document.getElementById(parentId + '-val').textContent = text;
  
  // Update active styling
  const opts = document.getElementById(parentId + '-options').querySelectorAll('.cs-option');
  opts.forEach(o => o.classList.remove('active'));
  // Can't easily match without value attr, so just rely on click event target if possible, but actually we can just pass the element or re-render. Since we rebuild provider list, let's just ignore active styling for now or match by text.
  event.target.classList.add('active');

  document.getElementById(parentId).classList.remove('open');
  
  if (parentId === 'cs-provider') {
    activeFilters.providers = value ? [value] : [];
  }
  applyFilters();
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('.custom-select')) {
    document.querySelectorAll('.custom-select').forEach(el => el.classList.remove('open'));
  }
});
/* ----------------------------------
   ADVANCED ANALYTICS (PLOTTER & DASHBOARD)
---------------------------------- */
let analyticsMode = 'plotter';

function setAnalyticsMode(mode) {
  analyticsMode = mode;
  document.getElementById('vt-plotter').classList.toggle('active', mode==='plotter');
  document.getElementById('vt-dashboard').classList.toggle('active', mode==='dashboard');
  document.getElementById('analytics-plotter').style.display = mode==='plotter' ? 'block' : 'none';
  document.getElementById('analytics-dashboard').style.display = mode==='dashboard' ? 'block' : 'none';
  
  if (mode === 'plotter') renderPlotter();
  else renderDashboard();
}

// Ensure the old renderChart call redirects to the new mode handler when resizing
window.renderChart = function() {
  if (analyticsMode === 'plotter') renderPlotter();
  else renderDashboard();
};


function drawScatter(svgId, data, xKey, yKey, rKey) {
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
