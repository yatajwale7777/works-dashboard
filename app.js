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

/* network (GET/POST) */
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

  // drop last total row if present
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    const str = JSON.stringify(last).toLowerCase();
    if (str.includes('total')) rows.pop();
  }

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
            // as last resort, try to pick numbers near expected indices
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

    const disp = headers.slice(1).map(h => {
      let v = map[h] || '';
      if (h === 'Engineer') v = (''+v).replace(/^\s*\d+\s*[\.\-\)\:]*/,'').trim();
      if (h === 'Balance Mandays') {
        const n = Number((''+v).replace(/,/g,''));
        if (!isNaN(n)) v = String(Math.round(n));
      }
      if (h === '% expenditure') {
        let pctDisplay = '';
        try {
          if (map._raw) {
            const c = computeSectionsFromRaw(map._raw);
            const tp = c.planned.reduce((a,b)=>a+(isNaN(b)?0:b),0);
            const te = c.exp.reduce((a,b)=>a+(isNaN(b)?0:b),0);
            if (tp) pctDisplay = Math.round((te/tp)*100)+'%';
          }
          if (!pctDisplay) {
            let rawPct = (''+v).replace(/%/g,'').trim();
            let pnum = Number(rawPct);
            if (!isNaN(pnum)) { if (Math.abs(pnum)<=1) pnum*=100; pctDisplay=Math.round(pnum)+'%'; }
          }
        } catch(e){ pctDisplay=v; }
        v = pctDisplay;
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
}
