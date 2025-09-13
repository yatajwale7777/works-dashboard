// ====== Configuration: set your Apps Script URL here ======
window.APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAo8oSHyqP7Roj_LDmrbFtOhoi47a0Zhz6M7IRlHJrl1kiTsKNuTx5ptAZv7OYceODAA/exec";
// ===========================================================

/* helpers */
function qs(id){return document.getElementById(id)}
function dbg(id,obj){try{qs(id).textContent = typeof obj === 'string' ? obj : JSON.stringify(obj,null,2)}catch(e){console.log(e)} }
function escapeHtml(s){ return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function toNum(v){ if (v===null||v===undefined) return NaN; const s=(''+v).replace(/,/g,'').trim(); if(s==='') return NaN; const n=Number(s); return isNaN(n)?NaN:n }
function fmt(n){ if (n===''||n===null||n===undefined) return ''; if (isNaN(n)) return ''; if (Math.abs(n)>=1000) return Number(n).toLocaleString(); if (Math.abs(n - Math.round(n))>0 && Math.abs(n) < 1) return Number(n).toFixed(4); if (Math.abs(n - Math.round(n))>0) return Number(n).toFixed(4); return String(Math.round(n)) }

/* safe fetch helper */
async function safeFetchJson(response){
  const txt = await response.text();
  try { return JSON.parse(txt); }
  catch(e){ return { ok:false, error:'non-json-response', status: response.status, statusText: response.statusText, raw: txt }; }
}

/* network (GET/POST) - resilient to HTML/404 responses */
async function callApi(action, method='GET', payload=null){
  if (!window.APPSCRIPT_URL) return Promise.reject(new Error('APPSCRIPT_URL not set'));
  if (method === 'GET') {
    const u = new URL(window.APPSCRIPT_URL);
    u.searchParams.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>u.searchParams.set(k, typeof payload[k]==='string'? payload[k]: JSON.stringify(payload[k])));
    const resp = await fetch(u.toString(), { method:'GET', mode:'cors' });
    return safeFetchJson(resp);
  } else {
    const params = new URLSearchParams(); params.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>{ const v = payload[k]; params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    const resp = await fetch(window.APPSCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' }, body: params.toString(), mode:'cors' });
    return safeFetchJson(resp);
  }
}

/* compute sections (planned cols 8..13, exp 14..19) with swap detection */
function computeSectionsFromRaw(rawArr){
  const raw = i => (Array.isArray(rawArr) ? (rawArr[i-1] === undefined ? '' : rawArr[i-1]) : '');
  function toNum(v){ if (v === null || v === undefined) return NaN; const s = (''+v).replace(/,/g,'').trim(); if (s==='') return NaN; const n = Number(s); return isNaN(n)?NaN:n; }
  const plannedIdx = [8,9,10,11,12,13];
  const expIdx =     [14,15,16,17,18,19];
  const plannedVals = plannedIdx.map(i => toNum(raw(i)));
  const expVals = expIdx.map(i => toNum(raw(i)));
  const sum = arr => arr.reduce((s,x)=> s + (isNaN(x)?0:x), 0);
  const plannedSum = sum(plannedVals), expSum = sum(expVals);

  let swapped = false;
  if ((Math.abs(plannedSum) < 1e-6 && Math.abs(expSum) > 1e-6) || (plannedSum !== 0 && expSum !==0 && Math.abs(plannedSum) < Math.abs(expSum)*0.4)) {
    swapped = true;
  }
  const finalPlanned = swapped ? expVals : plannedVals;
  const finalExp = swapped ? plannedVals : expVals;

  return {
    planned: finalPlanned,
    exp: finalExp,
    swapped: swapped
  };
}

/* Render table */
function renderTable(rows){
  const out = qs('output'); if (!out) return;
  out.innerHTML = '';

  // defensive normalize: rows might be object-like
  if (!rows) rows = [];
  if (!Array.isArray(rows)) {
    try { rows = Object.values(rows); } catch(e){ rows = []; }
  }

  // drop trailing total/summary row if present
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    try {
      const s = JSON.stringify(last).toLowerCase();
      if (s.includes('"total"') || s.includes(' total') || s.trim().startsWith('["total')) rows = rows.slice(0, -1);
    } catch(e){}
  }

  if (!rows || rows.length === 0) { out.innerHTML = '<div class="card">No data for selected filters</div>'; return; }

  const headers = [
    "S No.","Engineer","Gram Panchayat","Type of work","Name of work",
    "Year of Work","Status","Unskilled","Semi-skilled","Skilled","Material","Contingency","Total Cost",
    "Unskilled Exp","Semi-skilled Exp","Skilled Exp","Material Exp","Contingency Exp","Total Exp",
    "Category","Balance Mandays","% expenditure","Remark"
  ];

  let html = '<table id="dataTable"><thead><tr>';
  headers.forEach((h)=> html += '<th>' + escapeHtml(h) + '</th>');
  html += '</tr></thead><tbody>';

  rows.forEach((r, ridx)=>{
    let arr = Array.isArray(r) ? r.slice() : (r && typeof r === 'object' ? Object.values(r) : [r]);
    arr = arr.map(x => x===null||x===undefined? '' : (''+x).trim());
    while (arr.length && (arr[0] === '' || arr[0] === null || arr[0] === undefined)) arr.shift();

    let map = {};
    if (arr.length >= 23) {
      let startIndex = arr.length - 23;
      const slice = arr.slice(startIndex, startIndex + 23);
      map['Engineer'] = slice[0] !== undefined ? slice[0] : '';
      map['Gram Panchayat'] = slice[1] !== undefined ? slice[1] : '';
      map['Type of work'] = slice[2] !== undefined ? slice[2] : '';
      map['Name of work'] = slice[3] !== undefined ? slice[3] : '';
      map['Year of Work'] = slice[4] !== undefined ? slice[4] : '';
      map['Status'] = slice[5] !== undefined ? slice[5] : '';
      const skeys = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
      for (let i=0;i<skeys.length;i++) map[skeys[i]] = slice[6 + i] !== undefined ? slice[6 + i] : '';
      const ekeys = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
      for (let i=0;i<ekeys.length;i++) map[ekeys[i]] = slice[12 + i] !== undefined ? slice[12 + i] : '';
      map['Category'] = slice[18] !== undefined ? slice[18] : '';
      map['Balance Mandays'] = slice[19] !== undefined ? slice[19] : '';
      map['% expenditure'] = slice[20] !== undefined ? slice[20] : '';
      map['Remark'] = slice[21] !== undefined ? slice[21] : '';
      map._raw = arr.slice();
    } else {
      if (arr.length > 0 && /^\d+$/.test(arr[0])) arr.shift();
      map['Engineer'] = arr[0] !== undefined ? arr[0] : '';
      map['Gram Panchayat'] = arr[1] !== undefined ? arr[1] : '';
      map['Type of work'] = arr[2] !== undefined ? arr[2] : '';
      map['Name of work'] = arr[3] !== undefined ? arr[3] : '';
      map['Year of Work'] = arr[4] !== undefined ? arr[4] : '';
      map['Status'] = arr[5] !== undefined ? arr[5] : '';
      const skeys = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
      for (let i=0;i<skeys.length;i++) map[skeys[i]] = arr[6 + i] !== undefined ? arr[6 + i] : '';
      const ekeys = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
      for (let i=0;i<ekeys.length;i++) map[ekeys[i]] = arr[12 + i] !== undefined ? arr[12 + i] : '';
      map['Category'] = arr[18] !== undefined ? arr[18] : '';
      map['Balance Mandays'] = arr[19] !== undefined ? arr[19] : '';
      map['% expenditure'] = arr[20] !== undefined ? arr[20] : '';
      map['Remark'] = arr[21] !== undefined ? arr[21] : '';
      map._raw = arr.slice();
    }

    // normalize using computeSectionsFromRaw so table matches modal
    if (map._raw) {
      try {
        // primary: use computeSectionsFromRaw (handles swapped columns)
        const c = computeSectionsFromRaw(map._raw);
        let usedPlanned = Array.isArray(c.planned) ? c.planned.slice() : null;
        let usedExp = Array.isArray(c.exp) ? c.exp.slice() : null;

        function toNumLocal(v){ const s = (''+v).replace(/,/g,'').trim(); if (s==='') return NaN; const n = Number(s); return isNaN(n)?NaN:n; }
        function isMostlyNumeric(arr){ if (!Array.isArray(arr)) return false; let cnt=0; for(const x of arr) if (!isNaN(Number((''+x).toString().replace(/,/g,'')))) cnt++; return cnt>=4; }

        // fallback: detect numeric clusters in raw array if primary result is weak
        if (!isMostlyNumeric(usedPlanned) || !isMostlyNumeric(usedExp)) {
          const raw = map._raw.map(x => (x===null||x===undefined)?'':(''+x).trim());
          const clusters = [];
          let i=0;
          while(i<raw.length){
            // skip blanks
            if (raw[i]===''){ i++; continue; }
            // extend numeric run
            let j=i; const run=[];
            while(j<raw.length && !isNaN(toNumLocal(raw[j]))){ run.push(toNumLocal(raw[j])); j++; }
            if (run.length>=6) clusters.push({start:i, len: run.length, vals: run});
            i = (j===i)? i+1 : j;
          }

          if (clusters.length>=2){
            usedPlanned = clusters[0].vals.slice(0,6);
            usedExp = clusters[1].vals.slice(0,6);
          } else if (clusters.length===1 && clusters[0].len>=12){
            usedPlanned = clusters[0].vals.slice(0,6);
            usedExp = clusters[0].vals.slice(6,12);
          } else {
            // as last resort leave computeSectionsFromRaw values (even if partially numeric)
            if (!isMostlyNumeric(usedPlanned)) usedPlanned = usedPlanned || [NaN,NaN,NaN,NaN,NaN,NaN];
            if (!isMostlyNumeric(usedExp)) usedExp = usedExp || [NaN,NaN,NaN,NaN,NaN,NaN];
          }
        }

        const parts = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
        if (Array.isArray(usedPlanned) && usedPlanned.length>=6){ for(let k=0;k<6;k++) if(!isNaN(usedPlanned[k])) map[parts[k]] = usedPlanned[k]; }
        if (Array.isArray(usedExp) && usedExp.length>=6){ for(let k=0;k<6;k++) if(!isNaN(usedExp[k])) map[parts[k]+' Exp'] = usedExp[k]; }

        // recalc totals defensively
        try{
          const totalPl = Array.isArray(usedPlanned)? usedPlanned.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
          const totalEx = Array.isArray(usedExp)? usedExp.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
          if (!isNaN(totalPl)) map['Total Cost'] = totalPl;
          if (!isNaN(totalEx)) map['Total Exp'] = totalEx;
        }catch(e){}
      } catch(e){ console.warn('Normalization error', e); }
    }

    // Prepare display values: IMPORTANT - preserve zero (0) values
    const disp = headers.slice(1).map(h => {
      let rawv = (map.hasOwnProperty(h) ? map[h] : '');
      // treat empty string, null, undefined as ''
      if (rawv === null || rawv === undefined) rawv = '';
      // For numeric fields, keep numeric values (including 0)
      if (h === 'Engineer') {
        let v = (''+rawv).replace(/^\s*\d+\s*[\.\-\)\:]*\s*/,'').trim();
        return v;
      }
      if (h === 'Balance Mandays') {
        const n = Number((''+rawv).replace(/,/g,''));
        if (!isNaN(n)) return String(Math.round(n));
        return (rawv===''? '': ''+rawv);
      }
      if (h === '% expenditure') {
        // Compute percent from totals first
        let pctDisplay = '';
        try {
          const raw = Array.isArray(map._raw) ? map._raw : null;
          if (raw && typeof computeSectionsFromRaw === 'function') {
            const c = computeSectionsFromRaw(raw);
            const tp = Array.isArray(c.planned)? c.planned.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
            const te = Array.isArray(c.exp)? c.exp.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
            if (!isNaN(tp) && tp !== 0 && !isNaN(te)) pctDisplay = Math.round((te / tp) * 100) + '%';
          }
          if (!pctDisplay) {
            const tc = Number(('' + (map['Total Cost'] || '')).replace(/,/g,'')); // already normalized possibly
            const te = Number(('' + (map['Total Exp'] || '')).replace(/,/g,''));
            if (!isNaN(tc) && tc !== 0 && !isNaN(te)) pctDisplay = Math.round((te / tc) * 100) + '%';
          }
          if (!pctDisplay) {
            let rawPct = ('' + (rawv || '')).replace(/%/g,'').trim();
            let pnum = Number(rawPct);
            if (!isNaN(pnum)) {
              if (Math.abs(pnum) <= 1) pnum = pnum * 100;
              pctDisplay = Math.round(pnum) + '%';
            }
          }
        } catch(e){ pctDisplay = (''+rawv).replace(/%/g,'').trim(); }
        return pctDisplay;
      }

      // For everything else: return string form (preserve 0)
      if (rawv === '') return '';
      return (''+rawv).trim();
    });

    const payload = Object.assign({}, map);
    html += '<tr data-payload=\'' + escapeHtml(JSON.stringify(payload)) + '\'>';
    html += '<td>' + (ridx + 1) + '</td>';
    disp.forEach(cell => html += '<td>' + escapeHtml(cell) + '</td>');
    html += '</tr>';
  });

  html += '</tbody></table>';
  out.innerHTML = html;

  installRowClickHandlers();
  dbg('debugDash','Rendered ' + rows.length + ' rows. (mapping uses normalization when possible)');
}

/* row click -> modal (uses computeSectionsFromRaw) */
function installRowClickHandlers(){
  const table = qs('dataTable');
  if (!table) return;
  table.querySelectorAll('tbody tr').forEach(tr=>{
    tr.style.cursor = 'pointer';
    tr.onclick = () => {
      const p = tr.getAttribute('data-payload');
      if (!p) return;
      let payload;
      try { payload = JSON.parse(decodeHtml(p)); } catch(e){ payload = { _raw: p }; }
      showModalDetail(payload);
    };
  });
}

/* Modal: compact grid (no duplicate name) */
const modalOverlay = qs('modalOverlay'), modalTitle = qs('modalTitle'), modalMeta = qs('modalMeta'), modalBody = qs('modalBody');
let currentModalData = null;

function showModalDetail(map){
  currentModalData = map;
  const name = map['Name of work'] || '';
  const gp = map['Gram Panchayat'] || '';
  const type = map['Type of work'] || '';
  const year = map['Year of Work'] || map['Year'] || '';
  const status = map['Status'] || '';
  const category = map['Category'] || '';
  const pct = map['% expenditure'] || '';
  const balanceMandays = map['Balance Mandays'] || '';

  if (modalTitle) modalTitle.textContent = name || 'Work Details';
  if (modalMeta) modalMeta.textContent = gp + (type? ('  |  ' + type):'') + (year? ('  |  ' + year):'') + (status? ('  |  ' + status):'');

  const raw = Array.isArray(map._raw)? map._raw : null;
  let plannedArr = [], expArr = [], swapped=false;
  if (raw){ const c = computeSectionsFromRaw(raw); plannedArr = c.planned; expArr = c.exp; swapped = c.swapped; }
  else {
    plannedArr = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'].map(k=> toNum(map[k]));
    expArr = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'].map(k=> toNum(map[k]));
  }

  let html = '';
  if (swapped) html += '<div class="swap-note">Note: planned/expenditure columns looked swapped in source; values were recalculated.</div>';

  html += '<div class="sections-grid">';
  html += '<div class="hdr">Particular</div><div class="hdr">Section</div><div class="hdr">Expenditure</div><div class="hdr">Balance</div>';
  const parts = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
  for (let i=0;i<6;i++){
    const s = (!isNaN(plannedArr[i])? plannedArr[i] : '');
    const e = (!isNaN(expArr[i])? expArr[i] : '');
    let bal = '';
    if (s !== '' && e !== '') bal = s - e;
    else if (s !== '' && (e === '' || isNaN(e))) bal = s;
    else if ((s === '' || isNaN(s)) && e !== '') bal = -e;

    html += '<div class="part">' + escapeHtml(parts[i]) + '</div>';
    html += '<div class="cell num">' + (s === ''? '': fmt(s)) + '</div>';
    html += '<div class="cell num">' + (e === ''? '': fmt(e)) + '</div>';
    html += '<div class="cell num">' + (bal === ''? '': fmt(bal)) + '</div>';
  }

  const totalPlanned = plannedArr.reduce? plannedArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : '';
  const totalExp = expArr.reduce? expArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : '';
  const totalBal = (totalPlanned !== '' && totalExp !== '')? (totalPlanned - totalExp) : '';
  html += '<div class="part" style="font-weight:800">Total</div>';
  html += '<div class="cell num" style="font-weight:800">' + (totalPlanned === ''? '': fmt(totalPlanned)) + '</div>';
  html += '<div class="cell num" style="font-weight:800">' + (totalExp === ''? '': fmt(totalExp)) + '</div>';
  html += '<div class="cell" style="font-weight:800">' + (totalBal === ''? '': fmt(totalBal)) + '</div>';
  html += '</div>';

  // compute display for % exp using totals if available, else fallback to map value
  let pctDisplay = '';
  try {
    const tp = (typeof totalPlanned === 'number' && !isNaN(totalPlanned) && totalPlanned !== 0) ? totalPlanned : null;
    const te = (typeof totalExp === 'number' && !isNaN(totalExp)) ? totalExp : null;
    if (tp !== null && te !== null) {
      pctDisplay = Math.round((te / tp) * 100) + '%';
    } else {
      // fallback: try map value (which may be fraction or already percent)
      let rawPct = ('' + (pct || '')).replace(/%/g,'').trim();
      let pnum = Number(rawPct);
      if (!isNaN(pnum)) {
        if (Math.abs(pnum) <= 1) pnum = pnum * 100;
        pctDisplay = Math.round(pnum) + '%';
      } else pctDisplay = '';
    }
  } catch(e) { pctDisplay = ''; }

  // balance mandays display as integer (round)
  let balMandaysDisplay = '';
  try {
    const bm = Number(('' + (balanceMandays || '')).replace(/,/g,''));
    if (!isNaN(bm)) balMandaysDisplay = String(Math.round(bm));
    else balMandaysDisplay = (balanceMandays || '');
  } catch(e){ balMandaysDisplay = (balanceMandays || ''); }

  html += '<div style="margin-top:12px;color:var(--muted)"><strong>Category:</strong> ' + escapeHtml(category) + '  &nbsp; | &nbsp; <strong>% Exp:</strong> ' + escapeHtml(pctDisplay) + '  &nbsp; | &nbsp; <strong>Balance Mandays:</strong> ' + escapeHtml(balMandaysDisplay) + '</div>';

  if (map._raw && Array.isArray(map._raw)) html += '<details style="margin-top:10px"><summary>Raw row data (debug)</summary><pre>' + escapeHtml(JSON.stringify(map._raw, null,2)) + '</pre></details>';

  if (modalBody) modalBody.innerHTML = html;
  openModal();
}
function openModal(){ if(modalOverlay){ modalOverlay.style.display = 'flex'; document.body.style.overflow='hidden'; modalOverlay.setAttribute('aria-hidden','false') } }
function closeModal(){ if(modalOverlay){ modalOverlay.style.display = 'none'; document.body.style.overflow='auto'; modalOverlay.setAttribute('aria-hidden','true'); if(qs('modalBody')) qs('modalBody').innerHTML = '' } }
if (qs('modalClose')) qs('modalClose').addEventListener('click', closeModal)
if (modalOverlay) modalOverlay.addEventListener('click', function(e){ if (e.target === modalOverlay) closeModal() })

/* modal export */
if (qs('modalExport')) qs('modalExport').addEventListener('click', function(){
  const map = currentModalData; if (!map) return alert('No data'); const raw = Array.isArray(map._raw)? map._raw : null;
  let planned=[], exp=[];
  if(raw){ const c = computeSectionsFromRaw(raw); planned=c.planned; exp=c.exp }
  else {
    planned = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'].map(k=> toNum(map[k]));
    exp = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'].map(k=> toNum(map[k]));
  }
  const rows = []; rows.push(['Name of work', map['Name of work'] || '']); rows.push(['Gram Panchayat', map['Gram Panchayat'] || '']); rows.push([]); rows.push(['Particular','Section','Expenditure','Balance']);
  const parts = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
  for(let i=0;i<6;i++){
    const s = (planned && !isNaN(planned[i]))? planned[i] : '';
    const e = (exp && !isNaN(exp[i]))? exp[i] : '';
    let bal='';
    if(s!==''&& e!=='') bal = s-e;
    else if(s!=='' && (e===''||isNaN(e))) bal = s;
    else if((s===''||isNaN(s)) && e!=='') bal = -e;
    rows.push([parts[i], ''+s, ''+e, ''+bal]);
  }

  const csv = rows.map(r => r.map(cell=>{
    let txt = (cell===null||cell===undefined)?'':(''+cell);
    if (txt.indexOf('"') !== -1) txt = txt.replace(/"/g,'""');
    if (txt.indexOf(',') !== -1 || txt.indexOf('"') !== -1) return '"' + txt + '"';
    return txt;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = ((map['Name of work']||'work').toString().replace(/[^\w\-]/g,'_').slice(0,60)) + '_details.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

/* export main table */
if (qs('exportBtn')) qs('exportBtn').addEventListener('click', ()=> {
  const table = qs('dataTable'); if (!table) return alert('No table to export');
  const rows = Array.from(table.querySelectorAll('thead tr, tbody tr'));
  const csv = rows.map(tr=>{
    const cells = Array.from(tr.querySelectorAll('th,td')).map(td=>{
      let txt = td.innerText.replace(/\r?\n/g,' ').trim();
      if (txt.indexOf('"') !== -1) txt = txt.replace(/"/g,'""');
      if (txt.indexOf(',') !== -1 || txt.indexOf('"')!==-1) return '"' + txt + '"';
      return txt;
    });
    return cells.join(',');
  }).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'works_dashboard.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

/* Create / Update user (demo) */
async function loadOptionsCreate(){
  try {
    const postsRes = await callApi('getPostOptionsFromUserIdSheet','GET');
    const posts = (postsRes && postsRes.result) ? postsRes.result : (Array.isArray(postsRes)?postsRes:[]);
    const postSel = qs('c_post'); if (postSel) postSel.innerHTML = '<option value="">--select post--</option>';
    (posts||[]).forEach(p=>{ if(postSel){ const o=document.createElement('option'); o.value=p; o.textContent=p; postSel.appendChild(o); } });

    const pansRes = await callApi('getPanchayatOptionsFromUserIdSheet','GET');
    let pans = (pansRes && pansRes.result) ? pansRes.result : (Array.isArray(pansRes)?pansRes:[]);
    if (!pans || pans.length===0) {
      const fallback = await callApi('getAllPanchayatsFromSheet1','GET');
      pans = (fallback && fallback.result) ? fallback.result : (Array.isArray(fallback)?fallback:[]);
    }
    const sel = qs('c_panchayats'); if (sel) sel.innerHTML = '';
    (pans||[]).forEach(p=>{ if(sel){ const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); } });

    dbg('debugCreate',{posts:posts,panchayats:pans});
  } catch(err){ dbg('debugCreate',{error:String(err)}); }
}
if (qs('btnSave')) qs('btnSave').addEventListener('click', async ()=>{
  const name = qs('c_name')?qs('c_name').value.trim() : '';
  const post = qs('c_post')?qs('c_post').value.trim():'';
  const engg = qs('c_engg')?qs('c_engg').value.trim():'';
  const dcode = qs('c_dcode')?qs('c_dcode').value.trim() || '77':'77';
  const sel = qs('c_panchayats'); const pans = sel?Array.from(sel.selectedOptions).map(o=>o.value):[];
  if (!name || !post || pans.length===0) { if(qs('statusCreate')) qs('statusCreate').innerText = 'Fill name, post and select at least 1 panchayat'; return; }
  if(qs('btnSave')) qs('btnSave').disabled = true; if(qs('statusCreate')) qs('statusCreate').innerText = 'Saving (demo)...';
  try {
    const payload = { name: name, post: post, dcode: dcode, panchayats: pans, engg: engg };
    const res = await callApi('appendOrUpdateUser','POST', payload);
    dbg('debugCreate',{saveRes:res});
    if (res && (res.ok || res.result) && res.result && (res.result.action === 'created' || res.result.action === 'updated')) {
      if(qs('statusCreate')) qs('statusCreate').innerText = 'Saved (demo): ' + res.result.userid;
      if(typeof tabDashboard !== 'undefined' && tabDashboard) tabDashboard.click(); if(qs('loginInput')) qs('loginInput').value = res.result.userid; doLogin(res.result.userid);
    } else {
      if(qs('statusCreate')) qs('statusCreate').innerText = 'Save (demo) failed: ' + (res && res.error ? res.error : JSON.stringify(res));
    }
  } catch(err){ if(qs('statusCreate')) qs('statusCreate').innerText = 'Save (demo) error: ' + String(err); dbg('debugCreate',{saveException:String(err)}); }
  finally{ if(qs('btnSave')) qs('btnSave').disabled = false; }
});

/* utilities */
function decodeHtml(s){ if (s === null || s === undefined) return s; return s.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'") }
function roundTo(n,d){ if (!isFinite(n)) return n; const p=Math.pow(10,d||4); return Math.round(n*p)/p; }

/* tabs */
const tabDashboard = qs('tabDashboard'), tabCreate = qs('tabCreate');
if (tabDashboard) tabDashboard.addEventListener('click', ()=>{ tabDashboard.classList.add('active'); if(tabCreate) tabCreate.classList.remove('active'); if(qs('panelDashboard')) qs('panelDashboard').style.display='block'; if(qs('panelCreate')) qs('panelCreate').style.display='none'; });
if (tabCreate) tabCreate.addEventListener('click', ()=>{ tabCreate.classList.add('active'); if(tabDashboard) tabDashboard.classList.remove('active'); if(qs('panelCreate')) qs('panelCreate').style.display='block'; if(qs('panelDashboard')) qs('panelDashboard').style.display='none'; if (!window._createLoaded) { loadOptionsCreate(); window._createLoaded = true; } });

/* init */
(async function(){ await init(); })();
