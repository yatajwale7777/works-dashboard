// ====== Configuration: set your Apps Script URL here ======
window.APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAo8oSHyqP7Roj_LDmrbFtOhoi47a0Zhz6M7IRlHJrl1kiTsKNuTx5ptAZv7OYceODAA/exec";
// =========================================================


/* helpers */
function qs(id){return document.getElementById(id)}
function dbg(id,obj){try{qs(id).textContent = typeof obj === 'string' ? obj : JSON.stringify(obj,null,2)}catch(e){console.log(e)}}
function escapeHtml(s){ return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function toNum(v){ if (v===null||v===undefined) return NaN; const s=(''+v).replace(/,/g,'').trim(); if(s==='') return NaN; const n=Number(s); return isNaN(n)?NaN:n }
function fmt(n){ if (n===''||n===null||n===undefined) return ''; if (isNaN(n)) return ''; if (Math.abs(n)>=1000) return Number(n).toLocaleString(); if (Math.abs(n - Math.round(n))>0 && Math.abs(n) < 1) return Number(n).toFixed(4); if (Math.abs(n - Math.round(n))>0) return Number(n).toFixed(4); return String(Math.round(n)) }

/* network (GET/POST) */
async function callApi(action, method='GET', payload=null){
  if (!window.APPSCRIPT_URL) return Promise.reject(new Error('APPSCRIPT_URL not set'));
  if (method === 'GET') {
    const u = new URL(window.APPSCRIPT_URL);
    u.searchParams.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>u.searchParams.set(k, typeof payload[k]==='string'? payload[k]: JSON.stringify(payload[k])));
    return fetch(u.toString(), { method:'GET', mode:'cors' }).then(r=>r.json());
  } else {
    const params = new URLSearchParams(); params.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>{ const v = payload[k]; params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v)); });
    return fetch(window.APPSCRIPT_URL, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' }, body: params.toString(), mode:'cors' }).then(r=>r.json());
  }
}

/* populate dropdowns */
function populate(id, arr){ const sel = qs(id); if(!sel) return; const cur = sel.value; sel.innerHTML = '<option value=\"\">--All--</option>'; (arr||[]).forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); }); if (cur) sel.value = cur; }

/* init (load dropdowns) */
async function init(){
  if (!window.APPSCRIPT_URL || window.APPSCRIPT_URL.trim() === '') { dbg('debugDash','Set window.APPSCRIPT_URL'); return; }
  try {
    const dd = await callApi('getDropdownData','GET');
    if (dd && dd.ok && dd.data) {
      const dt = dd.data;
      qs('lastUpdate').innerText = 'Last Update: ' + (dt.updateTime || '');
      populate('year', dt.years || []);
      populate('work', dt.works || []);
      populate('status', dt.status || []);
      populate('category', dt.categories || []);
      populate('engineer', dt.engineers || []);
      window._gpsByEngineer = dt.gpsByEngineer || {};
      dbg('debugDash',{dropdowns:dt});
    } else dbg('debugDash',{error:dd});
  } catch(err){ dbg('debugDash',{error:String(err)}); }
}

/* Login / Logout */
qs('loginBtn').addEventListener('click', ()=>{ const v = qs('loginInput').value.trim(); if (!v) return alert('Enter UserID or Name'); doLogin(v); });
qs('logoutBtn').addEventListener('click', ()=>{ qs('loginInput').value=''; qs('userInfo').innerText=''; qs('filtersCard').style.display='none'; qs('output').innerHTML=''; qs('logoutBtn').style.display='none'; });

async function doLogin(val){
  try {
    const res = await callApi('validateUserCredential','POST',{ input: val });
    dbg('debugDash',{validate:res});
    if (!res) { alert('Invalid user or backend error'); return; }
    let u = (res.user || res);
    if (res.ok && res.user) u = res.user;
    if (!u || !u.valid) { alert('Invalid UserID/Name'); return; }
    qs('userInfo').innerText = 'Logged in: ' + u.name + ' (' + u.userid + ')';
    qs('logoutBtn').style.display = 'inline-block';
    const gp = qs('gp'); gp.innerHTML = '<option value=\"\">--All--</option>';
    (u.panchayats||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; gp.appendChild(o); });
    if (window._gpsByEngineer) {
      const gpsByEngineer = window._gpsByEngineer;
      const engines = Object.keys(gpsByEngineer).filter(e=>{
        const arr = (gpsByEngineer[e]||[]).map(x=>(''+x).trim().toLowerCase());
        return (u.panchayats||[]).some(up => arr.indexOf((''+up).trim().toLowerCase()) !== -1);
      });
      populate('engineer', engines);
      window._engineers = engines.map(x=>(''+x).trim());
    }
    qs('filtersCard').style.display = 'block';
    await fetchTable({}, u.userid);
  } catch(err){ dbg('debugDash',{loginError:String(err)}); alert('Login error: '+String(err)); }
}

/* Filters apply/reset */
qs('filterBtn').addEventListener('click', async function(){
  const filter = { engineer: qs('engineer').value, gp: qs('gp').value, year: qs('year').value, work: qs('work').value, status: qs('status').value, category: qs('category').value, search: qs('search').value };
  const userid = qs('loginInput').value.trim();
  await fetchTable(filter, userid);
});
qs('resetBtn').addEventListener('click', function(){ qs('engineer').value=''; qs('gp').value=''; qs('year').value=''; qs('work').value=''; qs('status').value=''; qs('category').value=''; qs('search').value=''; });

/* fetch table */
async function fetchTable(filter, userid){
  try {
    if (!userid) { alert('Please login first'); return; }
    const res = await callApi('getFilteredData','POST',{ filter: filter, userid: userid });
    dbg('debugDash',{filteredRes:res});
    let rows = [];
    if (res && res.ok && res.rows) rows = res.rows;
    else if (Array.isArray(res)) rows = res;
    else if (res.rows) rows = res.rows;
    renderTable(rows);
  } catch(err){ dbg('debugDash',{fetchTableError:String(err)}); }
}

/* Render table (same as earlier) */
function renderTable(rows){
  const out = qs('output'); out.innerHTML = '';
  if (!rows || rows.length === 0) { out.innerHTML = '<div class=\"card\">No data for selected filters</div>'; return; }

  const headers = [
    "S No.","Engineer","Gram Panchayat","Type of work","Name of work",
    "Year of Work","Status","Unskilled","Semi-skilled","Skilled","Material","Contingency","Total Cost",
    "Unskilled Exp","Semi-skilled Exp","Skilled Exp","Material Exp","Contingency Exp","Total Exp",
    "Category","Balance Mandays","% expenditure","Remark"
  ];

  let html = '<table id=\"dataTable\"><thead><tr>';
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
      map['Engineer'] = slice[0] || '';
      map['Gram Panchayat'] = slice[1] || '';
      map['Type of work'] = slice[2] || '';
      map['Name of work'] = slice[3] || '';
      map['Year of Work'] = slice[4] || '';
      map['Status'] = slice[5] || '';
      const skeys = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
      for (let i=0;i<skeys.length;i++) map[skeys[i]] = slice[6 + i] || '';
      const ekeys = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
      for (let i=0;i<ekeys.length;i++) map[ekeys[i]] = slice[12 + i] || '';
      map['Category'] = slice[18] || '';
      map['Balance Mandays'] = slice[19] || '';
      map['% expenditure'] = slice[20] || '';
      map['Remark'] = slice[21] || '';
      map._raw = arr.slice();
    } else {
      if (arr.length > 0 && /^\d+$/.test(arr[0])) arr.shift();
      map['Engineer'] = arr[0] || '';
      map['Gram Panchayat'] = arr[1] || '';
      map['Type of work'] = arr[2] || '';
      map['Name of work'] = arr[3] || '';
      map['Year of Work'] = arr[4] || '';
      map['Status'] = arr[5] || '';
      const skeys = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
      for (let i=0;i<skeys.length;i++) map[skeys[i]] = arr[6 + i] || '';
      const ekeys = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
      for (let i=0;i<ekeys.length;i++) map[ekeys[i]] = arr[12 + i] || '';
      map['Category'] = arr[18] || '';
      map['Balance Mandays'] = arr[19] || '';
      map['% expenditure'] = arr[20] || '';
      map['Remark'] = arr[21] || '';
      map._raw = arr.slice();
    }

    const disp = headers.slice(1).map(h => {
      let v = map[h] || '';
      if (h === 'Engineer') v = (''+v).replace(/^\s*\d+\s*[\.\-\)\:]*\s*/,'').trim();
      if (h === 'Balance Mandays') {
        const n = Number((''+v).replace(/,/g,''));
        if (!isNaN(n)) v = String(Math.round(n));
      }
      if (h === '% expenditure') {
        let n = (''+v).replace(/%/g,'').trim();
        let num = Number(n);
        if (!isNaN(num)) {
          if (num > 0 && num < 2) num = Math.round(num * 100);
          else num = Math.round(num);
          v = num + '%';
        } else v = v || '';
      }
      return v;
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
  dbg('debugDash','Rendered ' + rows.length + ' rows. (strict mapping used when row length >=23)');
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
    swapped: swapped,
    plannedSum: plannedSum,
    expSum: expSum
  };
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

  modalTitle.textContent = name || 'Work Details';
  modalMeta.textContent = gp + (type? ('  |  ' + type):'') + (year? ('  |  ' + year):'') + (status? ('  |  ' + status):'');

  const raw = Array.isArray(map._raw)? map._raw : null;
  let plannedArr = [], expArr = [], swapped=false;
  if (raw){ const c = computeSectionsFromRaw(raw); plannedArr = c.planned; expArr = c.exp; swapped = c.swapped; }
  else {
    plannedArr = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'].map(k=> toNum(map[k]));
    expArr = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'].map(k=> toNum(map[k]));
  }

  let html = '';
  if (swapped) html += '<div class=\"swap-note\">Note: planned/expenditure columns looked swapped in source; values were recalculated.</div>';

  html += '<div class=\"sections-grid\">';
  html += '<div class=\"hdr\">Particular</div><div class=\"hdr\">Section</div><div class=\"hdr\">Expenditure</div><div class=\"hdr\">Balance</div>';
  const parts = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
  for (let i=0;i<6;i++){
    const s = (!isNaN(plannedArr[i])? plannedArr[i] : '');
    const e = (!isNaN(expArr[i])? expArr[i] : '');
    let bal = '';
    if (s !== '' && e !== '') bal = s - e;
    else if (s !== '' && (e === '' || isNaN(e))) bal = s;
    else if ((s === '' || isNaN(s)) && e !== '') bal = -e;

    html += '<div class=\"part\">' + escapeHtml(parts[i]) + '</div>';
    html += '<div class=\"cell num\">' + (s === ''? '': fmt(s)) + '</div>';
    html += '<div class=\"cell num\">' + (e === ''? '': fmt(e)) + '</div>';
    html += '<div class=\"cell num\">' + (bal === ''? '': fmt(bal)) + '</div>';
  }

  const totalPlanned = plannedArr.reduce? plannedArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : '';
  const totalExp = expArr.reduce? expArr.reduce((a,b)=> a + (isNaN(b)?0:b),0) : '';
  const totalBal = (totalPlanned !== '' && totalExp !== '')? (totalPlanned - totalExp) : '';
  html += '<div class=\"part\" style=\"font-weight:800\">Total</div>';
  html += '<div class=\"cell num\" style=\"font-weight:800\">' + (totalPlanned === ''? '': fmt(totalPlanned)) + '</div>';
  html += '<div class=\"cell num\" style=\"font-weight:800\">' + (totalExp === ''? '': fmt(totalExp)) + '</div>';
  html += '<div class=\"cell num\" style=\"font-weight:800\">' + (totalBal === ''? '': fmt(totalBal)) + '</div>';
  html += '</div>';

  html += '<div style=\"margin-top:12px;color:var(--muted)\"><strong>Category:</strong> ' + escapeHtml(category) + '  &nbsp; | &nbsp; <strong>% Exp:</strong> ' + escapeHtml(pct) + '  &nbsp; | &nbsp; <strong>Balance Mandays:</strong> ' + escapeHtml(balanceMandays) + '</div>';

  if (map._raw && Array.isArray(map._raw)) html += '<details style=\"margin-top:10px\"><summary>Raw row data (debug)</summary><pre>' + escapeHtml(JSON.stringify(map._raw, null,2)) + '</pre></details>';

  modalBody.innerHTML = html;
  openModal();
}
function openModal(){ modalOverlay.style.display = 'flex'; document.body.style.overflow='hidden'; modalOverlay.setAttribute('aria-hidden','false') }
function closeModal(){ modalOverlay.style.display = 'none'; document.body.style.overflow='auto'; modalOverlay.setAttribute('aria-hidden','true'); qs('modalBody').innerHTML = '' }
qs('modalClose').addEventListener('click', closeModal)
modalOverlay.addEventListener('click', function(e){ if (e.target === modalOverlay) closeModal() })

/* modal export */
qs('modalExport').addEventListener('click', function(){
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
qs('exportBtn').addEventListener('click', ()=> {
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
    const postSel = qs('c_post'); postSel.innerHTML = '<option value=\"\">--select post--</option>';
    (posts||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; postSel.appendChild(o); });

    const pansRes = await callApi('getPanchayatOptionsFromUserIdSheet','GET');
    let pans = (pansRes && pansRes.result) ? pansRes.result : (Array.isArray(pansRes)?pansRes:[]);
    if (!pans || pans.length===0) {
      const fallback = await callApi('getAllPanchayatsFromSheet1','GET');
      pans = (fallback && fallback.result) ? fallback.result : (Array.isArray(fallback)?fallback:[]);
    }
    const sel = qs('c_panchayats'); sel.innerHTML = '';
    (pans||[]).forEach(p=>{ const o=document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o); });

    dbg('debugCreate',{posts:posts,panchayats:pans});
  } catch(err){ dbg('debugCreate',{error:String(err)}); }
}
qs('btnSave').addEventListener('click', async ()=>{
  const name = qs('c_name').value.trim(); const post = qs('c_post').value.trim(); const engg = qs('c_engg').value.trim(); const dcode = qs('c_dcode').value.trim() || '77';
  const sel = qs('c_panchayats'); const pans = Array.from(sel.selectedOptions).map(o=>o.value);
  if (!name || !post || pans.length===0) { qs('statusCreate').innerText = 'Fill name, post and select at least 1 panchayat'; return; }
  qs('btnSave').disabled = true; qs('statusCreate').innerText = 'Saving (demo)...';
  try {
    const payload = { name: name, post: post, dcode: dcode, panchayats: pans, engg: engg };
    const res = await callApi('appendOrUpdateUser','POST', payload);
    dbg('debugCreate',{saveRes:res});
    if (res && (res.ok || res.result) && res.result && (res.result.action === 'created' || res.result.action === 'updated')) {
      qs('statusCreate').innerText = 'Saved (demo): ' + res.result.userid;
      tabDashboard.click(); qs('loginInput').value = res.result.userid; doLogin(res.result.userid);
    } else {
      qs('statusCreate').innerText = 'Save (demo) failed: ' + (res && res.error ? res.error : JSON.stringify(res));
    }
  } catch(err){ qs('statusCreate').innerText = 'Save (demo) error: ' + String(err); dbg('debugCreate',{saveException:String(err)}); }
  finally{ qs('btnSave').disabled = false; }
});

/* utilities */
function decodeHtml(s){ if (!s) return s; return s.replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,'\\'') }
function roundTo(n,d){ if (!isFinite(n)) return n; const p=Math.pow(10,d||4); return Math.round(n*p)/p; }

/* tabs */
const tabDashboard = qs('tabDashboard'), tabCreate = qs('tabCreate');
tabDashboard.addEventListener('click', ()=>{ tabDashboard.classList.add('active'); tabCreate.classList.remove('active'); qs('panelDashboard').style.display='block'; qs('panelCreate').style.display='none'; });
tabCreate.addEventListener('click', ()=>{ tabCreate.classList.add('active'); tabDashboard.classList.remove('active'); qs('panelCreate').style.display='block'; qs('panelDashboard').style.display='none'; if (!window._createLoaded) { loadOptionsCreate(); window._createLoaded = true; } });

/* init */
(async function(){ await init(); })();