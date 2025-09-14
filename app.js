// ====== Configuration: set your Apps Script URL here ======
window.APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbz34Ak_pwJHdnVAvYsP9CiCQkd7EO50hDMySIy8a2O4OMt5ZAx7EtkKv4Anb-eYDQn90Q/exec";
// ============================================================

/* helpers */
function qs(id){ return document.getElementById(id); }
function dbg(id,obj){ try{ qs(id).textContent = typeof obj === 'string' ? obj : JSON.stringify(obj,null,2); } catch(e){ console.log(e); } }
function escapeHtml(s){ return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toNum(v){ if (v===null||v===undefined) return NaN; const s=(''+v).replace(/,/g,'').trim(); if(s==='') return NaN; const n=Number(s); return isNaN(n)?NaN:n; }
function fmt(n){ if (n===''||n===null||n===undefined) return ''; if (isNaN(n)) return ''; if (Math.abs(n)>=1000) return Number(n).toLocaleString(); if (Math.abs(n - Math.round(n))>0 && Math.abs(n) < 1) return Number(n).toFixed(4); if (Math.abs(n - Math.round(n))>0) return Number(n).toFixed(4); return String(Math.round(n)); }
function decodeHtml(s){ if (s === null || s === undefined) return s; return s.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'"); }

/* safe fetch helper */
async function safeFetchJson(response){
  const txt = await response.text();
  try { return JSON.parse(txt); }
  catch(e){ return { ok:false, error:'non-json-response', status: response.status, statusText: response.statusText, raw: txt }; }
}

/* JSONP helper fallback (if CORS blocks fetch) */
/* returns a Promise that resolves with parsed JSON */
function jsonpFetch(url, cbParam='callback', timeoutMs=8000){
  return new Promise((resolve, reject) => {
    const cbName = '__jsonp_cb_' + Math.random().toString(36).slice(2);
    window[cbName] = function(data){ resolve(data); cleanup(); };
    const script = document.createElement('script');
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    // use cbParam as provided (backend must support it)
    script.src = url + sep + encodeURIComponent(cbParam) + '=' + cbName;
    script.onerror = function(){ reject(new Error('JSONP script load error')); cleanup(); };
    const to = setTimeout(()=>{ reject(new Error('JSONP timeout')); cleanup(); }, timeoutMs);
    function cleanup(){ clearTimeout(to); try{ delete window[cbName]; }catch(e){} try{ script.remove(); }catch(e){} }
    document.head.appendChild(script);
  });
}

/* network (GET/POST) - resilient to HTML/404 responses and with JSONP fallback */
async function callApi(action, method='GET', payload=null){
  if (!window.APPSCRIPT_URL) return Promise.reject(new Error('APPSCRIPT_URL not set'));

  // prefer fetch; if CORS fails, try JSONP (if backend supports callback param)
  if (method === 'GET') {
    const u = new URL(window.APPSCRIPT_URL);
    u.searchParams.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>u.searchParams.set(k, typeof payload[k]==='string'? payload[k]: JSON.stringify(payload[k])));
    try {
      const resp = await fetch(u.toString(), { method:'GET', mode:'cors' });
      return await safeFetchJson(resp);
    } catch(err){
      // try JSONP fallback
      try {
        const data = await jsonpFetch(u.toString(), 'callback');
        return data;
      } catch(e){ return Promise.reject(e); }
    }
  } else {
    const params = new URLSearchParams(); params.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>{ const v = payload[k]; params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    try {
      const resp = await fetch(window.APPSCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' }, body: params.toString(), mode:'cors' });
      return await safeFetchJson(resp);
    } catch(err){
      // Try GET JSONP fallback for POST-like action (encode payload to query params) only if safe
      try {
        const u = new URL(window.APPSCRIPT_URL);
        u.searchParams.set('action', action);
        if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>u.searchParams.set(k, typeof payload[k]==='string'? payload[k]: JSON.stringify(payload[k])));
        const data = await jsonpFetch(u.toString(), 'callback');
        return data;
      } catch(e){ return Promise.reject(e); }
    }
  }
}

/* sanitizeFilter - ensures expected keys exist and are strings */
function sanitizeFilter(input){
  const keys = ['engineer','gp','work','status','year','search','category'];
  const out = {};
  input = input || {};
  keys.forEach(k=>{
    let v = input[k];
    if (v === null || v === undefined) { out[k] = ''; return; }
    if (typeof v === 'string') v = v.trim();
    else v = (''+v).trim();
    out[k] = v;
  });
  return out;
}

/* ---------- RENDER TABLE (same as your code) ---------- */
/* (renderTable, modal functions - copied from your implementation) */

function renderTable(rows){
  const out = qs('output'); if (!out) return;
  out.innerHTML = '';

  // normalize rows input to array
  if (!rows) rows = [];
  if (!Array.isArray(rows)) {
    try { rows = Object.values(rows); } catch(e){ rows = []; }
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

  // helper preserving zeros
  const toNumLocal = v => { if (v === null || v === undefined) return NaN; const s = (''+v).replace(/,/g,'').trim(); if (s === '') return NaN; const n = Number(s); return isNaN(n)?NaN:n; };

  rows.forEach((r, ridx)=>{
    // row -> array
    let arr = Array.isArray(r) ? r.slice() : (r && typeof r === 'object' ? Object.values(r) : [r]);
    arr = arr.map(x => x===null||x===undefined? '' : (''+x).trim());

    // Build map using exact sheet columns (1-based -> arr index N-1)
    const map = {};
    map['Engineer'] = arr[1] !== undefined ? arr[1] : '';             // col2 (Name of Sub Engg)
    map['Gram Panchayat'] = arr[2] !== undefined ? arr[2] : '';       // col3
    map['Type of work'] = arr[3] !== undefined ? arr[3] : '';         // col4
    map['Name of work'] = arr[4] !== undefined ? arr[4] : '';         // col5
    map['Year of Work'] = arr[5] !== undefined ? arr[5] : '';         // col6
    map['Status'] = arr[6] !== undefined ? arr[6] : '';               // col7

    // Planned (cols 8..13) -> arr[7]..arr[12]
    map['Unskilled'] = toNumLocal(arr[7]);
    map['Semi-skilled'] = toNumLocal(arr[8]);
    map['Skilled'] = toNumLocal(arr[9]);
    map['Material'] = toNumLocal(arr[10]);
    map['Contingency'] = toNumLocal(arr[11]);
    // Use sheet-provided Total Cost in col13 if present
    const sheetTotalCost = toNumLocal(arr[12]);
    map['Total Cost'] = !isNaN(sheetTotalCost) ? sheetTotalCost : NaN;

    // Expenditure (cols 14..19) -> arr[13]..arr[18]
    map['Unskilled Exp'] = toNumLocal(arr[13]);
    map['Semi-skilled Exp'] = toNumLocal(arr[14]);
    map['Skilled Exp'] = toNumLocal(arr[15]);
    map['Material Exp'] = toNumLocal(arr[16]);
    map['Contingency Exp'] = toNumLocal(arr[17]);
    // Use sheet-provided Total Exp in col19 if present
    const sheetTotalExp = toNumLocal(arr[18]);
    map['Total Exp'] = !isNaN(sheetTotalExp) ? sheetTotalExp : NaN;

    // Category / Balance Mandays / % expenditure / Remark (cols 20..23)
    map['Category'] = arr[19] !== undefined ? arr[19] : '';
    map['Balance Mandays'] = arr[20] !== undefined ? arr[20] : '';
    map['% expenditure'] = arr[21] !== undefined ? arr[21] : '';
    map['Remark'] = arr[22] !== undefined ? arr[22] : '';

    // If sheet didn't provide Total Cost or Total Exp, fallback to computed sums from components
    try {
      if (isNaN(map['Total Cost'])) {
        const totalPl = [map['Unskilled'],map['Semi-skilled'],map['Skilled'],map['Material'],map['Contingency']].reduce((a,b)=> a + (isNaN(b)?0:b), 0);
        if (!isNaN(totalPl) && totalPl !== 0) map['Total Cost'] = totalPl;
      }
      if (isNaN(map['Total Exp'])) {
        const totalEx = [map['Unskilled Exp'],map['Semi-skilled Exp'],map['Skilled Exp'],map['Material Exp'],map['Contingency Exp']].reduce((a,b)=> a + (isNaN(b)?0:b), 0);
        if (!isNaN(totalEx) && totalEx !== 0) map['Total Exp'] = totalEx;
      }
    } catch(e){ /* noop */ }

    // compute balances planned - exp (preserve numeric/blank rules)
    function comp(pl, ex){
      const p = toNumLocal(pl), e = toNumLocal(ex);
      if (isNaN(p) && isNaN(e)) return '';
      if (isNaN(p) && !isNaN(e)) return (0 - e);
      if (!isNaN(p) && isNaN(e)) return p;
      return (p - e);
    }
    map['Unskilled Balance'] = comp(map['Unskilled'], map['Unskilled Exp']);
    map['Semi-skilled Balance'] = comp(map['Semi-skilled'], map['Semi-skilled Exp']);
    map['Skilled Balance'] = comp(map['Skilled'], map['Skilled Exp']);
    map['Material Balance'] = comp(map['Material'], map['Material Exp']);
    map['Contingency Balance'] = comp(map['Contingency'], map['Contingency Exp']);
    map['Total Balance'] = comp(map['Total Cost'], map['Total Exp']);

    // keep raw for modal
    map._raw = arr.slice();

    // Prepare display values (preserve zero)
    const disp = headers.slice(1).map(h => {
      let rawv = (map.hasOwnProperty(h) ? map[h] : '');
      if (rawv === null || rawv === undefined) rawv = '';

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
        // prefer sheet value (may be '1%' or '0.01' or '0.01%')
        let rv = ('' + (rawv || '')).toString().trim();
        if (rv === '') return '';
        if (rv.indexOf('%') !== -1) return rv;
        let pnum = Number(rv);
        if (isNaN(pnum)) return rv;
        if (Math.abs(pnum) <= 1) pnum = pnum * 100;
        return Math.round(pnum) + '%';
      }

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
  dbg('debugDash','Rendered ' + rows.length + ' rows (sheet-mapped).');
}

/* row click -> modal */
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

/* Modal: show Particular / Section / Expenditure / Balance using mapped columns */
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
  const pctRaw = map['% expenditure'] || '';
  const balanceMandaysRaw = map['Balance Mandays'] || '';

  if (modalTitle) modalTitle.textContent = name || 'Work Details';
  if (modalMeta) modalMeta.textContent = gp + (type? ('  |  ' + type):'') + (year? ('  |  ' + year):'') + (status? ('  |  ' + status):'');

  // Planned and Exp arrays (explicit mapping)
  const plannedArr = [
    toNum(map['Unskilled']),
    toNum(map['Semi-skilled']),
    toNum(map['Skilled']),
    toNum(map['Material']),
    toNum(map['Contingency']),
    toNum(map['Total Cost'])
  ];
  const expArr = [
    toNum(map['Unskilled Exp']),
    toNum(map['Semi-skilled Exp']),
    toNum(map['Skilled Exp']),
    toNum(map['Material Exp']),
    toNum(map['Contingency Exp']),
    toNum(map['Total Exp'])
  ];

  const parts = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];

  let html = '';
  html += '<div class="sections-grid">';
  html += '<div class="hdr">Particular</div><div class="hdr">Section</div><div class="hdr">Expenditure</div><div class="hdr">Balance</div>';
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

  html += '</div>'; // end grid

  // display % exp (prefer sheet value, else compute from totals)
  let pctDisplay = '';
  try {
    if (pctRaw !== '' && pctRaw !== null && pctRaw !== undefined) {
      let s = (''+pctRaw).replace(/%/g,'').trim();
      let num = Number(s);
      if (!isNaN(num)) {
        if (Math.abs(num) <= 1) num = num * 100;
        pctDisplay = Math.round(num) + '%';
      } else pctDisplay = s;
    } else {
      // fallback: compute from totals if available in arrays
      const totalPlanned = plannedArr.reduce? plannedArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
      const totalExp = expArr.reduce? expArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
      if (!isNaN(totalPlanned) && totalPlanned !== 0 && !isNaN(totalExp)) {
        pctDisplay = Math.round((totalExp / totalPlanned) * 100) + '%';
      } else pctDisplay = '';
    }
  } catch(e){ pctDisplay = ''; }

  // balance mandays as integer
  let balMandaysDisplay = '';
  try {
    const bm = Number(('' + (balanceMandaysRaw || '')).replace(/,/g,'')); 
    if (!isNaN(bm)) balMandaysDisplay = String(Math.round(bm));
    else balMandaysDisplay = (balanceMandaysRaw || '');
  } catch(e){ balMandaysDisplay = (balanceMandaysRaw || ''); }

  html += '<div style="margin-top:12px;color:var(--muted)"><strong>Category:</strong> ' + escapeHtml(category) + '  &nbsp; | &nbsp; <strong>% Exp:</strong> ' + escapeHtml(pctDisplay) + '  &nbsp; | &nbsp; <strong>Balance Mandays:</strong> ' + escapeHtml(balMandaysDisplay) + '</div>';

  if (map._raw && Array.isArray(map._raw)) html += '<details style="margin-top:10px"><summary>Raw row data (debug)</summary><pre>' + escapeHtml(JSON.stringify(map._raw, null,2)) + '</pre></details>';

  if (modalBody) modalBody.innerHTML = html;
  openModal();
}

function openModal(){ if(modalOverlay){ modalOverlay.style.display = 'flex'; document.body.style.overflow='hidden'; modalOverlay.setAttribute('aria-hidden','false'); } }
function closeModal(){ if(modalOverlay){ modalOverlay.style.display = 'none'; document.body.style.overflow='auto'; modalOverlay.setAttribute('aria-hidden','true'); if(qs('modalBody')) qs('modalBody').innerHTML = ''; } }
if (qs('modalClose')) qs('modalClose').addEventListener('click', closeModal);
if (modalOverlay) modalOverlay.addEventListener('click', function(e){ if (e.target === modalOverlay) closeModal(); });

/* modal export */
if (qs('modalExport')) qs('modalExport').addEventListener('click', function(){
  const map = currentModalData; if (!map) return alert('No data');
  const planned = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'].map(k=> toNum(map[k]));
  const exp = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'].map(k=> toNum(map[k]));

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

/* safer populate */
function populate(id, arr){
  const sel = qs(id);
  if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">--All--</option>';
  (arr||[]).forEach(v=>{
    if (v === null || v === undefined) return;
    const sv = (''+v).trim();
    if (sv === '') return;
    const o = document.createElement('option');
    o.value = sv;
    o.textContent = sv;
    sel.appendChild(o);
  });
  try { if (cur) sel.value = cur; } catch(e){}
}

/* initDropdowns - separate from init to allow refresh after create user */
async function initDropdowns(){
  try {
    const dd = await callApi('getDropdownData','GET');
    if (dd && dd.ok && dd.data) {
      const dt = dd.data;
      if (qs('lastUpdate')) qs('lastUpdate').innerText = 'Last Update: ' + (dt.updateTime || '');
      populate('year', dt.years || []);
      populate('work', dt.works || []);
      populate('status', dt.status || []);
      // categories may need cleaning but backend should supply preferred column — we rely on backend
      populate('category', dt.categories || []);
      populate('engineer', dt.engineers || []);
      // populate create-panel panchayats (multi-select)
      const cPans = qs('c_panchayats');
      if (cPans) {
        cPans.innerHTML = '';
        (dt.allPanchayats||[]).forEach(p=>{
          if (!p) return;
          const o = document.createElement('option'); o.value = p; o.textContent = p; cPans.appendChild(o);
        });
      }
      window._gpsByEngineer = dt.gpsByEngineer || {};
      dbg('debugDash',{dropdowns:dt});
    } else dbg('debugDash',{error:dd});
  } catch(err){ dbg('debugDash',{error:String(err)}); }
}

/* fetch table (sanitized) */
async function fetchTable(filter, userid){
  try {
    if (!userid) { alert('Please login first'); return; }

    const filt = sanitizeFilter(filter || {});
    dbg('debugDash',{ sendingFilter: filt, userid: userid });

    const res = await callApi('getFilteredData','POST',{ filter: filt, userid: userid });
    dbg('debugDash',{filteredRes:res});
    let rows = [];
    if (!res) rows = [];
    else if (Array.isArray(res)) rows = res;
    else if (res.ok && res.rows && Array.isArray(res.rows)) rows = res.rows;
    else if (res.rows && Array.isArray(res.rows)) rows = res.rows;
    else if (res.result && Array.isArray(res.result)) rows = res.result;
    else if (res.data && res.data.rows && Array.isArray(res.data.rows)) rows = res.data.rows;
    else if (res && res.ok && res.data && Array.isArray(res.data)) rows = res.data;
    else {
      // if backend returned object that looks like normal array
      try {
        const maybe = Object.values(res).find(v => Array.isArray(v));
        if (Array.isArray(maybe)) rows = maybe;
      } catch(e){}
    }

    renderTable(rows);
  } catch(err){ dbg('debugDash',{fetchTableError:String(err)}); }
}

/* Login / Logout (simple) */
if (qs('loginBtn')) qs('loginBtn').addEventListener('click', ()=>{ const v = qs('loginInput').value.trim(); if (!v) return alert('Enter UserID or Name'); doLogin(v); });
if (qs('logoutBtn')) qs('logoutBtn').addEventListener('click', ()=>{ if(qs('loginInput')) qs('loginInput').value=''; if(qs('userInfo')) qs('userInfo').innerText=''; if(qs('filtersCard')) qs('filtersCard').style.display='none'; if(qs('output')) qs('output').innerHTML=''; if(qs('logoutBtn')) qs('logoutBtn').style.display='none'; });

async function doLogin(val){
  try {
    const res = await callApi('validateUserCredential','POST',{ input: val });
    dbg('debugDash',{validate:res});
    if (!res) { alert('Invalid user or backend error'); return; }
    let u = (res.user || res);
    if (res.ok && res.user) u = res.user;
    if (!u || !u.valid) { alert('Invalid UserID/Name'); return; }
    if (qs('userInfo')) qs('userInfo').innerText = 'Logged in: ' + u.name + ' (' + u.userid + ')';
    if (qs('logoutBtn')) qs('logoutBtn').style.display = 'inline-block';
    const gp = qs('gp'); if (gp) { gp.innerHTML = '<option value="">--All--</option>'; (u.panchayats||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; gp.appendChild(o); }); }
    if (window._gpsByEngineer) {
      const gpsByEngineer = window._gpsByEngineer;
      const engines = Object.keys(gpsByEngineer).filter(e=>{
        const arr = (gpsByEngineer[e]||[]).map(x=>(''+x).trim().toLowerCase());
        return (u.panchayats||[]).some(up => arr.indexOf((''+up).trim().toLowerCase()) !== -1);
      });
      populate('engineer', engines);
      window._engineers = engines.map(x=>(''+x).trim());
    }
    if (qs('filtersCard')) qs('filtersCard').style.display = 'block';
    await fetchTable({}, u.userid);
  } catch(err){ dbg('debugDash',{loginError:String(err)}); alert('Login error: '+String(err)); }
}

/* UI controls wiring - robust version */
function wireControls(){
  // find apply control (support multiple possible ids)
  let apply = qs('filterBtn') || qs('applyBtn') || document.querySelector('[data-action="applyFilter"]');
  if (!apply) {
    // also try to find a button with text "Apply"
    apply = Array.from(document.querySelectorAll('button')).find(b => (b.textContent||'').trim().toLowerCase().indexOf('apply') !== -1) || null;
  }
  if (apply) {
    apply.addEventListener('click', ()=> {
      const filter = {
        engineer: qs('engineer')?qs('engineer').value:'',
        gp: qs('gp')?qs('gp').value:'',
        work: qs('work')?qs('work').value:'',
        status: qs('status')?qs('status').value:'',
        year: qs('year')?qs('year').value:'',
        category: qs('category')?qs('category').value:'',
        search: qs('search')?qs('search').value:''
      };
      const userid = qs('loginInput')?qs('loginInput').value.trim():'';
      fetchTable(filter, userid);
    });
  } else {
    console.warn('apply control not found. Ensure id="filterBtn" or id="applyBtn" or data-action="applyFilter" exists');
  }

  // reset
  let reset = qs('resetBtn') || document.querySelector('[data-action="resetFilters"]');
  if (!reset) {
    reset = Array.from(document.querySelectorAll('button')).find(b => (b.textContent||'').trim().toLowerCase().indexOf('reset') !== -1) || null;
  }
  if (reset) {
    reset.addEventListener('click', ()=> {
      ['engineer','gp','work','status','year','category','search'].forEach(id=>{
        const el = qs(id);
        if (!el) return;
        try { el.value = ''; } catch(e){}
      });
      const userid = qs('loginInput')?qs('loginInput').value.trim():'';
      if (userid) fetchTable({}, userid);
    });
  } else {
    console.warn('reset control not found. Ensure id="resetBtn" or data-action="resetFilters" exists');
  }

  // Tabs (works even if elements are missing)
  const tabDashboard = qs('tabDashboard') || Array.from(document.querySelectorAll('.tab-btn')).find(b=> (b.textContent||'').toLowerCase().indexOf('dashboard')!==-1);
  const tabCreate = qs('tabCreate') || Array.from(document.querySelectorAll('.tab-btn')).find(b=> (b.textContent||'').toLowerCase().indexOf('create')!==-1 || (b.textContent||'').toLowerCase().indexOf('user')!==-1);
  const panelDashboard = qs('panelDashboard') || qs('panelDash') || document.getElementById('panelDashboard');
  const panelCreate = qs('panelCreate') || document.getElementById('panelCreate');

  if (tabDashboard && tabCreate && panelDashboard && panelCreate) {
    tabDashboard.addEventListener('click', ()=> {
      tabDashboard.classList.add('active'); if(tabCreate) tabCreate.classList.remove('active');
      panelDashboard.style.display = 'block'; panelCreate.style.display = 'none';
    });
    tabCreate.addEventListener('click', ()=> {
      tabCreate.classList.add('active'); if(tabDashboard) tabDashboard.classList.remove('active');
      panelCreate.style.display = 'block'; panelDashboard.style.display = 'none';
      // focus first field on create panel (helpful on mobile)
      try { const f = qs('c_name'); if (f) f.focus(); } catch(e){}
    });
  } else {
    // fallback: if tab elements missing, try to wire any "create" button to show panelCreate
    const createBtn = qs('createBtn') || document.querySelector('[data-action="openCreateUser"]') || Array.from(document.querySelectorAll('button')).find(b=> (b.textContent||'').toLowerCase().indexOf('create')!==-1);
    if (createBtn && panelCreate && panelDashboard) {
      createBtn.addEventListener('click', ()=> {
        panelCreate.style.display = 'block'; panelDashboard.style.display = 'none';
        try { const f = qs('c_name'); if (f) f.focus(); } catch(e){}
      });
    } else {
      console.warn('Tab wiring incomplete - tab or panels not found. Check ids: tabDashboard, tabCreate, panelDashboard, panelCreate');
    }
  }

  // Save button handler (create/update user)
  const saveBtn = qs('btnSave') || qs('saveUserBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async ()=> {
      const name = qs('c_name')?qs('c_name').value.trim():'';
      const post = qs('c_post')?qs('c_post').value.trim():'';
      const dcode = qs('c_dcode')?qs('c_dcode').value.trim():'77';
      const pansEl = qs('c_panchayats');
      let panchayats = [];
      if (pansEl) panchayats = Array.from(pansEl.selectedOptions).map(o=>o.value).filter(Boolean);
      if (!name || !post || panchayats.length === 0) {
        if (qs('statusCreate')) qs('statusCreate').innerText = 'Name, Post and at least one Panchayat required.';
        return;
      }
      if (qs('statusCreate')) qs('statusCreate').innerText = 'Saving...';
      try {
        const payload = { name: name, post: post, dcode: dcode, panchayats: panchayats };
        const res = await callApi('appendOrUpdateUser','POST', payload);
        dbg('debugCreate', {res:res});
        // backend wrapper may return {ok:true, result: {...}} or raw result
        const resultObj = (res && res.result) ? res.result : res;
        if (resultObj && (resultObj.action || resultObj.userid || (res && res.ok))) {
          if (qs('statusCreate')) qs('statusCreate').innerText = 'Saved successfully';
          // refresh dropdowns and panchayats list
          await initDropdowns();
        } else {
          if (qs('statusCreate')) qs('statusCreate').innerText = 'Save response: ' + JSON.stringify(res);
        }
      } catch(e){
        if (qs('statusCreate')) qs('statusCreate').innerText = 'Save error: ' + String(e);
      }
    });
  } else {
    console.warn('create/save button not found (btnSave)');
  }
}

/* init */
async function init(){
  if (!window.APPSCRIPT_URL || window.APPSCRIPT_URL.trim() === '') { dbg('debugDash','Set window.APPSCRIPT_URL'); return; }
  try {
    await initDropdowns();
  } catch(err){ dbg('debugDash',{error:String(err)}); }

  // wire UI buttons (apply/reset/create)
  wireControls();

  // if user already set in loginInput, try to fetch table
  const userid = qs('loginInput')?qs('loginInput').value.trim():'';
  if (userid) {
    try { await fetchTable({}, userid); } catch(e){ dbg('debugDash',{error:String(e)}); }
  }
}

/* start */
(async function(){ await init(); })();
