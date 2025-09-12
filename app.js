// ====== Configuration: set your Apps Script URL here ======
window.APPSCRIPT_URL = "https://script.google.com/macros/s/AKfycbxAo8oSHyqP7Roj_LDmrbFtOhoi47a0Zhz6M7IRlHJrl1kiTsKNuTx5ptAZv7OYceODAA/exec";
// =========================================================

/* helpers */
function qs(id){return document.getElementById(id)}
function dbg(id,obj){try{qs(id).textContent = typeof obj === 'string' ? obj : JSON.stringify(obj,null,2)}catch(e){console.log(e)}}
function escapeHtml(s){ return (''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function toNum(v){ if (v===null||v===undefined) return NaN; const s=(''+v).replace(/,/g,'').trim(); if(s==='') return NaN; const n=Number(s); return isNaN(n)?NaN:n }
function fmt(n){ if (n===''||n===null||n===undefined) return ''; if (isNaN(n)) return ''; if (Math.abs(n)>=1000) return Number(n).toLocaleString(); if (Math.abs(n - Math.round(n))>0 && Math.abs(n) < 1) return Number(n).toFixed(4); if (Math.abs(n - Math.round(n))>0) return Number(n).toFixed(4); return String(Math.round(n)) }

/* network */
async function callApi(action, method='GET', payload=null){
  if (!window.APPSCRIPT_URL) return Promise.reject(new Error('APPSCRIPT_URL not set'));
  if (method === 'GET') {
    const u = new URL(window.APPSCRIPT_URL);
    u.searchParams.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>u.searchParams.set(k, typeof payload[k]==='string'? payload[k]: JSON.stringify(payload[k])));
    return fetch(u.toString(), { method:'GET', mode:'cors' }).then(r=>r.json());
  } else {
    const params = new URLSearchParams();
    params.set('action', action);
    if (payload && typeof payload === 'object') Object.keys(payload).forEach(k=>{
      const v = payload[k];
      params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    return fetch(window.APPSCRIPT_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' },
      body: params.toString(),
      mode:'cors'
    }).then(r=>r.json());
  }
}

/* render main table */
function renderTable(rows){
  if (!rows || rows.length===0){ qs('output').innerHTML = '<div class="card">No data</div>'; return }
  const headers = ["S No.","Engineer","Gram Panchayat","Type of work","Name of work","Year","Status",
    "Unskilled","Semi-skilled","Skilled","Material","Contingency","Total Cost",
    "Unskilled Exp","Semi-skilled Exp","Skilled Exp","Material Exp","Contingency Exp","Total Exp",
    "Category","Balance Mandays","% expenditure","Remark"];
  let html = '<table id="dataTable"><thead><tr>';
  headers.forEach(h=> html += '<th>'+escapeHtml(h)+'</th>');
  html += '</tr></thead><tbody>';

  rows.forEach((r,idx)=>{
    const arr = Array.isArray(r)? r.slice() : (r && typeof r === 'object'? Object.values(r): [r]);
    while(arr.length && (arr[0]===''||arr[0]===null||arr[0]===undefined)) arr.shift();
    let a = arr.map(x=> x===null||x===undefined? '': (''+x).trim());
    let payload = {};
    if (a.length >= 23){
      const slice = a.slice(a.length - 23);
      payload['Engineer'] = slice[0] || '';
      payload['Gram Panchayat'] = slice[1] || '';
      payload['Type of work'] = slice[2] || '';
      payload['Name of work'] = slice[3] || '';
      payload['Year'] = slice[4] || '';
      payload['Status'] = slice[5] || '';
      const sKeys = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
      for (let i=0;i<sKeys.length;i++) payload[sKeys[i]] = slice[6+i] || '';
      const eKeys = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
      for (let i=0;i<eKeys.length;i++) payload[eKeys[i]] = slice[12+i] || '';
      payload['Category'] = slice[18] || '';
      payload['Balance Mandays'] = slice[19] || '';
      payload['% expenditure'] = slice[20] || '';
      payload['Remark'] = slice[21] || '';
      payload._raw = a.slice();
    } else {
      payload['Engineer'] = a[1] || '';
      payload['Gram Panchayat'] = a[2] || '';
      payload['Type of work'] = a[3] || '';
      payload['Name of work'] = a[4] || '';
      payload['Year'] = a[5] || '';
      payload['Status'] = a[6] || '';
      const sKeys = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost'];
      for (let i=0;i<sKeys.length;i++) payload[sKeys[i]] = a[7+i] || '';
      const eKeys = ['Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
      for (let i=0;i<eKeys.length;i++) payload[eKeys[i]] = a[13+i] || '';
      payload['Category'] = a[19] || '';
      payload['Balance Mandays'] = a[20] || '';
      payload['% expenditure'] = a[21] || '';
      payload['Remark'] = a[22] || '';
      payload._raw = a.slice();
    }

    html += '<tr data-payload="' + escapeHtml(JSON.stringify(payload)) + '">';
    html += '<td>' + (idx+1) + '</td>';
    html += '<td>' + escapeHtml(payload['Engineer']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Gram Panchayat']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Type of work']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Name of work']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Year']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Status']||'') + '</td>';

    const compact = ['Unskilled','Semi-skilled','Skilled','Material','Contingency','Total Cost','Unskilled Exp','Semi-skilled Exp','Skilled Exp','Material Exp','Contingency Exp','Total Exp'];
    compact.forEach(k=> html += '<td>' + escapeHtml(payload[k]||'') + '</td>');

    html += '<td>' + escapeHtml(payload['Category']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Balance Mandays']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['% expenditure']||'') + '</td>';
    html += '<td>' + escapeHtml(payload['Remark']||'') + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  qs('output').innerHTML = html;
  installRowClickHandlers();
}

/* row click handlers */
function installRowClickHandlers(){
  const table = qs('dataTable'); if (!table) return;
  table.querySelectorAll('tbody tr').forEach(tr=>{
    tr.style.cursor = 'pointer';
    tr.onclick = ()=>{
      const p = tr.getAttribute('data-payload'); if (!p) return;
      let payload;
      try{ payload = JSON.parse(p) } catch(e){ payload = { _raw: p } }
      showModalDetail(payload);
    }
  })
}

/* compute planned/exp arrays with swap detection */
function computeSectionsFromRaw(rawArr){
  const raw = i=> (Array.isArray(rawArr)? (rawArr[i-1]===undefined? '': rawArr[i-1]) : '');
  const plannedIdx=[8,9,10,11,12,13], expIdx=[14,15,16,17,18,19];
  const planned = plannedIdx.map(i=> toNum(raw(i)) ), exp = expIdx.map(i=> toNum(raw(i)) );
  const sum = a=> a.reduce((s,x)=> s + (isNaN(x)?0:x), 0);
  const plannedSum = sum(planned), expSum = sum(exp);
  let swapped = false;
  if ((Math.abs(plannedSum) < 1e-6 && Math.abs(expSum) > 1e-6) || (plannedSum!==0 && expSum!==0 && Math.abs(plannedSum) < Math.abs(expSum)*0.4)) swapped = true;
  return {planned: swapped? exp : planned, exp: swapped? planned : exp, swapped, plannedSum, expSum};
}

/* modal: compact grid (no duplicate name) */
const modalOverlay = qs('modalOverlay'), modalTitle = qs('modalTitle'), modalMeta = qs('modalMeta'), modalBody = qs('modalBody');
let currentModalData = null;
function showModalDetail(map){
  currentModalData = map;
  const name = map['Name of work'] || '';
  const gp = map['Gram Panchayat'] || '';
  const type = map['Type of work'] || '';
  const year = map['Year'] || map['Year of Work'] || '';
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
  html += '<div class="cell num" style="font-weight:800">' + (totalBal === ''? '': fmt(totalBal)) + '</div>';
  html += '</div>';

  html += '<div style="margin-top:12px;color:var(--muted)"><strong>Category:</strong> ' + escapeHtml(category) + '  &nbsp; | &nbsp; <strong>% Exp:</strong> ' + escapeHtml(pct) + '  &nbsp; | &nbsp; <strong>Balance Mandays:</strong> ' + escapeHtml(balanceMandays) + '</div>';

  if (map._raw && Array.isArray(map._raw)) html += '<details style="margin-top:10px"><summary>Raw row data (debug)</summary><pre>' + escapeHtml(JSON.stringify(map._raw, null,2)) + '</pre></details>';

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
  const rows = [];
  rows.push(['Name of work', map['Name of work'] || '']);
  rows.push(['Gram Panchayat', map['Gram Panchayat'] || '']);
  rows.push([]);
  rows.push(['Particular','Section','Expenditure','Balance']);
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
  const a = document.createElement('a'); a.href = url; a.download = ((map['Name of work']||'work').toString().replace(/[^\w\-]/g,'_').slice(0,60)) + '_details.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

/* export main table */
qs('exportBtn').addEventListener('click', ()=>{
  const table = qs('dataTable'); if(!table) return alert('No table to export');
  const rows = Array.from(table.querySelectorAll('thead tr, tbody tr'));
  const csv = rows.map(tr=> Array.from(tr.querySelectorAll('th,td')).map(td=>{
    let txt = td.innerText.replace(/\r?\n/g,' ').trim();
    if(txt.indexOf('"') !== -1) txt = txt.replace(/"/g,'""');
    return (txt.indexOf(',')!==-1 || txt.indexOf('"')!==-1) ? '"' + txt + '"' : txt;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='works_dashboard.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

/* main load flow */
async function fetchTable(filter={}, userid=''){
  try{
    const res = await callApi('getFilteredData','POST',{filter, userid});
    dbg('debugDash', {filteredRes:res});
    let rows = [];
    if (res && res.ok && res.rows) rows = res.rows; else if (Array.isArray(res)) rows = res; else if (res.rows) rows = res.rows;
    renderTable(rows);
  }catch(err){
    dbg('debugDash',String(err)); qs('output').innerHTML = '<div class="card">Error loading table</div>';
  }
}

/* login button triggers fetch with userid */
qs('loginBtn').addEventListener('click', ()=>{
  const v = qs('loginInput').value.trim(); if(!v) return alert('Enter UserID'); fetchTable({}, v);
});

/* initial small init: try to read last update info */
(async function(){
  try{
    const dd = await callApi('getDropdownData','GET');
    if(dd && dd.ok && dd.data) qs('lastUpdate').innerText = 'Last update: ' + (dd.data.updateTime || '');
  }catch(e){}
})();
