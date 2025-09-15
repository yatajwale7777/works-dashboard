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
    script.src = url + sep + encodeURIComponent(cbParam) + '=' + cbName;
    script.onerror = function(){ reject(new Error('JSONP script load error')); cleanup(); };
    const to = setTimeout(()=>{ reject(new Error('JSONP timeout')); cleanup(); }, timeoutMs);
    function cleanup(){ clearTimeout(to); try{ delete window[cbName]; }catch(e){} script.remove(); }
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

/* helper: unique + clean small utility used for categories */
function uniqClean(arr){
  const seen = new Set();
  const out = [];
  (arr||[]).forEach(x=>{
    if (x === null || x === undefined) return;
    let s = (''+x).trim();
    if (!s) return;
    const low = s.toLowerCase();
    if (low === 'total' || low === 'na' || low === 'n/a' || low === 'nan') return;
    if (/^[\d\.\-\,\s]+$/.test(s)) return;
    if (s.length <= 1) return;
    s = s.replace(/\s+/g,' ').trim();
    if (seen.has(s)) return;
    seen.add(s);
    out.push(s);
  });
  out.sort();
  return out;
}

/* ---------- RENDER TABLE (same as your original) ---------- */
/* I copied your renderTable + modal code (unchanged) */
function renderTable(rows){
  const out = qs('output'); if (!out) return;
  out.innerHTML = '';

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

  const toNumLocal = v => { if (v === null || v === undefined) return NaN; const s = (''+v).replace(/,/g,'').trim(); if (s === '') return NaN; const n = Number(s); return isNaN(n)?NaN:n; };

  rows.forEach((r, ridx)=>{
    let arr = Array.isArray(r) ? r.slice() : (r && typeof r === 'object' ? Object.values(r) : [r]);
    arr = arr.map(x => x===null||x===undefined? '' : (''+x).trim());

    const map = {};
    map['Engineer'] = arr[1] !== undefined ? arr[1] : '';
    map['Gram Panchayat'] = arr[2] !== undefined ? arr[2] : '';
    map['Type of work'] = arr[3] !== undefined ? arr[3] : '';
    map['Name of work'] = arr[4] !== undefined ? arr[4] : '';
    map['Year of Work'] = arr[5] !== undefined ? arr[5] : '';
    map['Status'] = arr[6] !== undefined ? arr[6] : '';

    map['Unskilled'] = toNumLocal(arr[7]);
    map['Semi-skilled'] = toNumLocal(arr[8]);
    map['Skilled'] = toNumLocal(arr[9]);
    map['Material'] = toNumLocal(arr[10]);
    map['Contingency'] = toNumLocal(arr[11]);
    const sheetTotalCost = toNumLocal(arr[12]);
    map['Total Cost'] = !isNaN(sheetTotalCost) ? sheetTotalCost : NaN;

    map['Unskilled Exp'] = toNumLocal(arr[13]);
    map['Semi-skilled Exp'] = toNumLocal(arr[14]);
    map['Skilled Exp'] = toNumLocal(arr[15]);
    map['Material Exp'] = toNumLocal(arr[16]);
    map['Contingency Exp'] = toNumLocal(arr[17]);
    const sheetTotalExp = toNumLocal(arr[18]);
    map['Total Exp'] = !isNaN(sheetTotalExp) ? sheetTotalExp : NaN;

    map['Category'] = arr[19] !== undefined ? arr[19] : '';
    map['Balance Mandays'] = arr[20] !== undefined ? arr[20] : '';
    map['% expenditure'] = arr[21] !== undefined ? arr[21] : '';
    map['Remark'] = arr[22] !== undefined ? arr[22] : '';

    try {
      if (isNaN(map['Total Cost'])) {
        const totalPl = [map['Unskilled'],map['Semi-skilled'],map['Skilled'],map['Material'],map['Contingency']].reduce((a,b)=> a + (isNaN(b)?0:b), 0);
        if (!isNaN(totalPl) && totalPl !== 0) map['Total Cost'] = totalPl;
      }
      if (isNaN(map['Total Exp'])) {
        const totalEx = [map['Unskilled Exp'],map['Semi-skilled Exp'],map['Skilled Exp'],map['Material Exp'],map['Contingency Exp']].reduce((a,b)=> a + (isNaN(b)?0:b), 0);
        if (!isNaN(totalEx) && totalEx !== 0) map['Total Exp'] = totalEx;
      }
    } catch(e){}

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

    map._raw = arr.slice();

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

  html += '</div>';

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
      const totalPlanned = plannedArr.reduce? plannedArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
      const totalExp = expArr.reduce? expArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : NaN;
      if (!isNaN(totalPlanned) && totalPlanned !== 0 && !isNaN(totalExp)) {
        pctDisplay = Math.round((totalExp / totalPlanned) * 100) + '%';
      } else pctDisplay = '';
    }
  } catch(e){ pctDisplay = ''; }

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
    else if (res.rows && Array.isArray(res.rows)) rows = res.rows;
    else if (res.result && Array.isArray(res.result)) rows = res.result;
    else if (res.data && res.data.rows && Array.isArray(res.data.rows)) rows = res.data.rows;
    else {
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

/* UI controls wiring: apply / reset / create tab fallback / save user */
function wireControls(){
  // apply button (your HTML uses id="filterBtn")
  let apply = qs('filterBtn') || qs('applyBtn') || document.querySelector('[data-action="applyFilter"]');
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
    console.warn('applyBtn not found — ensure button id="filterBtn" exists');
  }

  // reset button
  let reset = qs('resetBtn') || document.querySelector('[data-action="resetFilters"]');
  if (reset) {
    reset.addEventListener('click', ()=>{
      ['engineer','gp','work','status','year','category','search'].forEach(id=>{
        const el = qs(id);
        if (!el) return;
        if (el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
      });
      const userid = qs('loginInput')?qs('loginInput').value.trim():'';
      if (userid) fetchTable({}, userid);
    });
  } else {
    console.warn('resetBtn not found — ensure button id="resetBtn" exists');
  }

  // Create / tab wiring
  const tabDash = qs('tabDashboard'), tabCreate = qs('tabCreate'), panelDash = qs('panelDashboard'), panelCreate = qs('panelCreate');
  if (tabDash) tabDash.addEventListener('click', ()=>{ if (tabDash) tabDash.classList.add('active'); if (tabCreate) tabCreate.classList.remove('active'); if (panelDash) panelDash.style.display='block'; if (panelCreate) panelCreate.style.display='none'; });
  if (tabCreate) tabCreate.addEventListener('click', ()=>{ if (tabCreate) tabCreate.classList.add('active'); if (tabDash) tabDash.classList.remove('active'); if (panelCreate) panelCreate.style.display='block'; if (panelDash) panelDash.style.display='none'; });

  // also wire createBtn fallback if exists
  let create = qs('createBtn') || document.querySelector('[data-action="openCreateUser"]');
  if (create) {
    create.addEventListener('click', ()=>{
      const tab = qs('tabCreate');
      if (tab) tab.click();
      else {
        const panel = qs('createUserPanel') || qs('panelCreate') || document.getElementById('createUser');
        if (panel) panel.style.display = 'block';
      }
    });
  }

  // Save button on Create panel
  const saveBtn = qs('btnSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', async ()=>{
      const name = (qs('c_name')?qs('c_name').value.trim():'');
      const post = (qs('c_post')?qs('c_post').value.trim():'');
      const dcode = (qs('c_dcode')?qs('c_dcode').value.trim():'77');
      let panchayats = [];
      const sel = qs('c_panchayats');
      if (sel) {
        Array.from(sel.selectedOptions||[]).forEach(o=>{ if (o && o.value) panchayats.push(o.value); });
      }
      dbg('debugCreate',{sending:{name:name,post:post,dcode:dcode,panchayats:panchayats}});
      if (!name || !post || !panchayats.length) {
        qs('statusCreate').innerText = 'Please fill Name, Post and select at least one Panchayat.';
        return;
      }
      qs('statusCreate').innerText = 'Saving...';
      try {
        const payload = { name: name, post: post, dcode: dcode, panchayats: panchayats };

        // MAIN change: send top-level fields (not nested under "payload") so Apps Script handlers that expect name/post/panchayats work.
        const res = await callApi('appendOrUpdateUser','POST', payload);
        dbg('debugCreate',{result:res});

        // If backend returns an obvious success shape, treat as success
        if (res && (res.ok || res.result || res.user)) {
          qs('statusCreate').innerText = 'Saved: ' + JSON.stringify(res.result || res.user || res);
          try { await init(); } catch(e) { console.warn('init refresh failed', e); }
          return;
        }

        // If response didn't include expected fields, try direct POST with explicit top-level params (debugging fallback)
        const params = new URLSearchParams();
        params.set('action','appendOrUpdateUser');
        params.set('name', payload.name);
        params.set('post', payload.post);
        params.set('dcode', payload.dcode);
        params.set('panchayats', JSON.stringify(payload.panchayats));

        const resp = await fetch(window.APPSCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: params.toString(),
          mode: 'cors'
        });

        const rawText = await resp.text();
        let parsed = null;
        try { parsed = JSON.parse(rawText); } catch(e) { /* not json */ }

        dbg('debugCreate', { directFetchStatus: resp.status, statusText: resp.statusText, rawText: rawText, parsed: parsed });

        if (resp.ok && parsed && (parsed.ok || parsed.result || parsed.user)) {
          qs('statusCreate').innerText = 'Saved (direct): ' + JSON.stringify(parsed.result || parsed.user || parsed);
          try { await init(); } catch(e) { console.warn('init refresh failed', e); }
          return;
        } else {
          qs('statusCreate').innerText = 'Save response: ' + JSON.stringify(parsed || rawText);
          return;
        }

      } catch(err){
        qs('statusCreate').innerText = 'Save error: ' + String(err);
        dbg('debugCreate',{error:String(err)});
      }
    });
  }
}

/* initDropdowns + main init */
async function init(){
  if (!window.APPSCRIPT_URL || window.APPSCRIPT_URL.trim() === '') { dbg('debugDash','Set window.APPSCRIPT_URL'); return; }
  try {
    const dd = await callApi('getDropdownData','GET');
    if (dd && dd.ok && dd.data) {
      const dt = dd.data;
      if (qs('lastUpdate')) qs('lastUpdate').innerText = 'Last Update: ' + (dt.updateTime || '');
      populate('year', dt.years || []);
      populate('work', dt.works || []);
      populate('status', dt.status || []);
      populate('engineer', dt.engineers || []);
      window._gpsByEngineer = dt.gpsByEngineer || {};

      // Category: prefer dt.categories; if empty -> fallback to column 20 (index 19) extracted from rows
      let catList = Array.isArray(dt.categories) ? uniqClean(dt.categories) : [];
      if (!catList || catList.length === 0) {
        try {
          // get rows (unfiltered) and extract column index 19 (20th col)
          const rowsRes = await callApi('getFilteredData','POST',{ filter: {}, userid: '' });
          let rows = [];
          if (rowsRes && Array.isArray(rowsRes)) rows = rowsRes;
          else if (rowsRes && rowsRes.ok && Array.isArray(rowsRes.rows)) rows = rowsRes.rows;
          else if (rowsRes && Array.isArray(rowsRes.rows)) rows = rowsRes.rows;
          else if (rowsRes && rowsRes.rows && Array.isArray(rowsRes.rows)) rows = rowsRes.rows;
          const rawCats = (rows||[]).map(r => {
            if (!Array.isArray(r)) return '';
            // index 19 -> column 20
            return (r[19] === undefined || r[19] === null) ? '' : (''+r[19]).trim();
          });
          catList = uniqClean(rawCats);
        } catch(e){ dbg('debugDash',{categoryFallbackError: String(e)}); }
      }
      populate('category', catList || []);

      // populate create-panel panchayats (multi-select)
      const cPans = qs('c_panchayats');
      if (cPans) {
        cPans.innerHTML = '';
        const allPans = dt.allPanchayats || [];
        (allPans||[]).forEach(p=>{
          if (!p) return;
          const o = document.createElement('option'); o.value = p; o.textContent = p; cPans.appendChild(o);
        });
      }

      // populate posts for create panel
      try {
        let postsRes = await callApi('getPostOptionsFromUserIdSheet','GET');
        let posts = [];
        if (postsRes && postsRes.ok && Array.isArray(postsRes.result)) posts = postsRes.result;
        else if (Array.isArray(postsRes)) posts = postsRes;
        if ((!posts || posts.length === 0) && dt && Array.isArray(dt.posts)) posts = dt.posts;
        if (!posts || posts.length === 0) posts = ['Engg','GRS','Schive','AE','Other'];

        const cPost = qs('c_post');
        if (cPost) {
          cPost.innerHTML = '';
          posts.forEach(p=>{
            if (p === null || p === undefined) return;
            const s = (''+p).trim();
            if (!s) return;
            const o = document.createElement('option'); o.value = s; o.textContent = s; cPost.appendChild(o);
          });
        }
      } catch(e){
        dbg('debugDash',{postPopulateError: String(e)});
        const cPost = qs('c_post');
        if (cPost && cPost.options.length === 1 && (cPost.options[0].text||'').toLowerCase().indexOf('loading') !== -1) {
          cPost.innerHTML = '';
          ['Engg','GRS','Schive','AE','Other'].forEach(p=>{
            const o = document.createElement('option'); o.value = p; o.textContent = p; cPost.appendChild(o);
          });
        }
      }

      dbg('debugDash',{dropdowns:dt, categoryUsed: catList});
    } else {
      dbg('debugDash',{error:dd});
    }
  } catch(err){ dbg('debugDash',{error:String(err)}); }

  // wire UI buttons (apply/reset/create/save)
  wireControls();

  // attempt to auto-fetch if user already present input
  const userid = qs('loginInput')?qs('loginInput').value.trim():'';
  if (userid) {
    try { await fetchTable({}, userid); } catch(e){ dbg('debugDash',{error:String(e)}); }
  }
}

/* start */
(async function(){ await init(); })();
