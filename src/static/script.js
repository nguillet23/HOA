// ── State ─────────────────────────────────────────────────────────────────────
const filePaths   = { target:'', balance:'', operating:'', reserve:'', cy:'', py:'' };
const fileDirs    = { target:'', balance:'', operating:'', reserve:'', cy:'', py:'' };
let   backupFolder = '';
let   restoredData = null;

const FILE_KEYS = ['target','balance','operating','reserve','cy','py'];
const FILE_LABELS = {
  target:    'Budget Macro Workbook',
  balance:   'Balance Sheet',
  operating: 'Operating Budget Export',
  reserve:   'Reserve Budget Export',
  cy:        'Current Year Income Statement',
  py:        'Prior Year Income Statement',
};

// ── Progress ──────────────────────────────────────────────────────────────────
const STAGES = [
  ["Preparing…",                          5],
  ["Reading source files…",              20],
  ["Processing Balance Sheet…",          35],
  ["Processing Budget Exports…",         50],
  ["Processing Income Statements…",      65],
  ["Writing to workbook…",               80],
  ["Saving & moving files…",             92],
  ["Complete",                          100],
];

function setProgress(idx) {
  const wrap = document.getElementById('prog-wrap');
  const fill = document.getElementById('prog-fill');
  const stEl = document.getElementById('prog-stage');
  const pcEl = document.getElementById('prog-pct');
  if (idx < 0) { wrap.style.display='none'; fill.style.width='0%'; return; }
  const i = Math.min(idx, STAGES.length-1);
  const [label, pct] = STAGES[i];
  wrap.style.display = 'block';
  fill.style.width = pct + '%';
  stEl.textContent = label;
  pcEl.textContent = pct + '%';
}
function hideProgress() { setTimeout(() => setProgress(-1), 1400); }

// ── Native file picker ────────────────────────────────────────────────────────
async function pickFile(key) {
  const btn = document.getElementById('btn-' + key);
  btn.textContent = 'Opening…';
  btn.disabled = true;

  // Use the last known directory for this key, or the shared folder, or home
  const initDir = fileDirs[key] || backupFolder || '';

  try {
    const res  = await fetch('/pick-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, init_dir: initDir }),
    });
    const data = await res.json();

    if (data.ok && data.path) {
      setFilePath(key, data.path, data.filename, data.dir);
      clearValidationItem('file-' + key);
    } else if (data.error) {
      markFileError(key, data.error);
    }
  } catch (err) {
    alert('Could not open file browser. Make sure the app server is running.');
  }

  // Restore button
  btn.innerHTML = '<svg viewBox="0 0 16 16" style="width:11px;height:11px;fill:rgba(255,255,255,.85)"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg> Browse';
  btn.disabled = false;
}

function setFilePath(key, fullPath, filename, dir) {
  filePaths[key] = fullPath;
  fileDirs[key]  = dir || '';

  const tile    = document.getElementById('tile-' + key);
  const display = document.getElementById('path-display-' + key);
  const status  = document.getElementById('status-' + key);

  tile.classList.add('done');
  tile.classList.remove('file-error');
  display.textContent = filename || fullPath;
  display.classList.remove('placeholder');
  status.textContent  = '✓ ' + filename;
}

function markFileError(key, msg) {
  const tile   = document.getElementById('tile-' + key);
  const status = document.getElementById('status-' + key);
  tile.classList.remove('done');
  tile.classList.add('file-error');
  status.textContent = '✗ ' + msg;
}

// ── Folder picker ─────────────────────────────────────────────────────────────
function applyFolder(fullPath) {
  backupFolder = fullPath;
  const parts  = fullPath.replace(/\\/g, '/').split('/');
  const name   = parts[parts.length-1] || fullPath;
  document.getElementById('folder-name').textContent = name;
  document.getElementById('folder-name').classList.remove('placeholder');
  document.getElementById('folder-picker').classList.add('has-path');
  document.getElementById('field-backup').classList.remove('field-error');
  clearValidationItem('field-backup');
}

async function browseFolder() {
  const btn = document.querySelector('.folder-browse-btn');
  btn.innerHTML = 'Opening…';
  btn.disabled  = true;
  try {
    const res  = await fetch('/pick-folder', { method:'POST' });
    const data = await res.json();
    if (data.ok && data.path) {
      applyFolder(data.path);
      await fetch('/memory/folder', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ last_backup_folder: data.path }),
      });
    }
  } catch (e) {
    alert('Could not open folder browser.');
  }
  btn.innerHTML = '<svg viewBox="0 0 16 16" style="width:13px;height:13px;fill:rgba(255,255,255,.85)"><path d="M1 3a1 1 0 011-1h4l2 2h6a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3z"/></svg> Browse';
  btn.disabled  = false;
}

// ── Association dropdown ──────────────────────────────────────────────────────
function onAssocChange(sel) {
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('number-hidden').value = opt ? (opt.dataset.num||'') : '';
  document.getElementById('field-association').classList.remove('field-error');
  clearValidationItem('field-association');
}

fetch('/api/associations')
.then(response => response.json())
.then(data => {
    const dropdown = document.getElementById('assoc-select');
    
    data.forEach(item => {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.setAttribute('data-num', item.num);  // Preserve your data-num attribute
    dropdown.appendChild(option);
    });
})
.catch(error => console.error('Error loading associations:', error));

// ── Validation ────────────────────────────────────────────────────────────────
function clearValidationItem(key) {
  const li = document.getElementById('vli-' + key);
  if (li) li.remove();
  if (document.getElementById('validation-error-list').children.length === 0)
    document.getElementById('validation-banner').classList.remove('show');
}

function validateAll() {
  const errors = [];

  // Association
  const assocSel = document.getElementById('assoc-select');
  if (!assocSel.value) {
    document.getElementById('field-association').classList.add('field-error');
    errors.push({ key:'field-association', msg:'<strong>Association Name</strong> is missing' });
  } else {
    document.getElementById('field-association').classList.remove('field-error');
  }

  // Month
  const month = document.getElementById('sel-month').value;
  if (!month) {
    document.getElementById('field-month').classList.add('field-error');
    errors.push({ key:'field-month', msg:'<strong>Month</strong> is missing' });
  } else {
    document.getElementById('field-month').classList.remove('field-error');
  }

  // Year
  const year = document.getElementById('inp-year').value.trim();
  const yearOk = /^\d{4}$/.test(year) && parseInt(year)>=2000 && parseInt(year)<=2100;
  if (!yearOk) {
    document.getElementById('field-year').classList.add('field-error');
    errors.push({ key:'field-year', msg:'<strong>Year</strong> is missing or invalid (4-digit, 2000–2100)' });
  } else {
    document.getElementById('field-year').classList.remove('field-error');
  }

  // Budget Year
  const budgetYear = document.getElementById('inp-budget-year').value.trim();
  const budgetYearOk = /^\d{4}$/.test(budgetYear) && parseInt(budgetYear)>=2000 && parseInt(budgetYear)<=2100;
  if (!budgetYearOk) {
    document.getElementById('field-budget-year').classList.add('field-error');
    errors.push({ key:'field-budget-year', msg:'<strong>Budget Year</strong> is missing or invalid (4-digit, 2000–2100)' });
  } else {
    document.getElementById('field-budget-year').classList.remove('field-error');
  }

  // Password
  const pw = document.getElementById('inp-password').value;
  if (!pw) {
    document.getElementById('field-password').classList.add('field-error');
    errors.push({ key:'field-password', msg:'<strong>Workbook Password</strong> is required' });
  } else {
    document.getElementById('field-password').classList.remove('field-error');
  }

  // Backup folder
  if (!backupFolder) {
    document.getElementById('field-backup').classList.add('field-error');
    errors.push({ key:'field-backup', msg:'<strong>Backup Folder</strong> — no folder selected' });
  } else {
    document.getElementById('field-backup').classList.remove('field-error');
  }

  // Files
  FILE_KEYS.forEach(key => {
    if (!filePaths[key]) {
      document.getElementById('tile-' + key).classList.add('file-error');
      errors.push({ key:'file-'+key, msg:`<strong>${FILE_LABELS[key]}</strong> — no file selected` });
    } else {
      document.getElementById('tile-' + key).classList.remove('file-error');
    }
  });

  if (errors.length > 0) {
    const banner = document.getElementById('validation-banner');
    const title  = document.getElementById('validation-title');
    const list   = document.getElementById('validation-error-list');
    const fc = errors.filter(e => e.key.startsWith('file-')).length;
    const dc = errors.length - fc;
    const parts = [];
    if (dc) parts.push(`${dc} detail field${dc>1?'s':''}`);
    if (fc) parts.push(`${fc} source file${fc>1?'s':''}`);
    title.textContent = `Please fix ${parts.join(' and ')} before processing:`;
    list.innerHTML = '';
    errors.forEach(({ key, msg }) => {
      const li = document.createElement('li');
      li.id = 'vli-' + key;
      li.innerHTML = msg;
      list.appendChild(li);
    });
    banner.classList.add('show');
    const firstKey = errors[0].key;
    const target = firstKey.startsWith('file-')
      ? document.getElementById('tile-' + firstKey.replace('file-',''))
      : document.getElementById(firstKey);
    if (target) target.scrollIntoView({ behavior:'smooth', block:'center' });
    return false;
  }

  document.getElementById('validation-banner').classList.remove('show');
  return true;
}

// ── Log ───────────────────────────────────────────────────────────────────────
function addLog(msg, level='info') {
  document.getElementById('log-wrap').classList.add('show');
  const body = document.getElementById('log-body');
  const ts   = new Date().toLocaleTimeString('en-US', { hour12:false });
  const line = document.createElement('div');
  line.className = 'll ' + level;
  line.innerHTML = `<span class="ts">[${ts}]</span>&nbsp;<span class="m">${msg}</span>`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}
function clearLog() {
  document.getElementById('log-body').innerHTML = '';
  document.getElementById('log-wrap').classList.remove('show');
}

// ── Run ───────────────────────────────────────────────────────────────────────
async function runProcess() {
  if (!validateAll()) return;

  const btn = document.getElementById('run-btn');
  const resultBlock = document.getElementById('result-block');
  clearLog();
  resultBlock.classList.remove('show','fail');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Processing…';

  setProgress(0);
  addLog('Sending file paths to server…');

  const payload = {
    association:   document.getElementById('assoc-select').value.trim(),
    number:        document.getElementById('number-hidden').value.trim(),
    month:         document.getElementById('sel-month').value,
    year:          document.getElementById('inp-year').value.trim(),
    budget_year:   document.getElementById('inp-budget-year').value.trim(),
    password:      document.getElementById('inp-password').value,
    backup_folder: backupFolder,
  };
  FILE_KEYS.forEach(k => { payload['path_' + k] = filePaths[k]; });

  try {
    setProgress(1);
    const res = await fetch('/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setProgress(2); await sleep(350);
    setProgress(3); await sleep(350);
    setProgress(4); await sleep(350);
    setProgress(5); await sleep(350);
    setProgress(6);

    const data = await res.json();
    if (data.logs) data.logs.forEach(l => addLog(l.msg, l.level));

    setProgress(7);

    if (data.ok) {
      document.getElementById('result-title').textContent = '✓ Processing Complete';
      document.getElementById('result-folder').innerHTML =
        `Files moved &amp; renamed to: <span>${data.dest_folder}</span>`;
      const filesEl = document.getElementById('result-files');
      filesEl.innerHTML = '';
      data.output_files.forEach(f => {
        const el = document.createElement('div');
        el.className = 'rf';
        el.innerHTML = `<span>${f.src}</span><span class="arrow">→</span><span class="dst">${f.dst}</span>`;
        filesEl.appendChild(el);
      });
      resultBlock.classList.add('show');

      // Persist metadata + file paths used
      await fetch('/memory', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ association: payload.association, number: payload.number, month: payload.month, year: payload.year }),
      });
      await fetch('/memory/files', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ paths: filePaths }),
      });

      // Clear file selections since the originals were moved
      FILE_KEYS.forEach(clearFileSelection);

    } else {
      const errMsgs = (data.logs||[]).filter(l=>l.level==='error');
      document.getElementById('result-title').textContent = '✗ Processing Failed';
      document.getElementById('result-folder').innerHTML = errMsgs.length
        ? 'Error: <span>' + errMsgs.map(l=>l.msg).join(' | ') + '</span>'
        : 'Please review the process log for details.';
      document.getElementById('result-files').innerHTML = '';
      resultBlock.classList.add('show','fail');
    }
  } catch (err) {
    addLog('Network error: ' + err.message, 'error');
    document.getElementById('result-title').textContent = 'Connection Error';
    document.getElementById('result-folder').innerHTML = 'Could not reach the local server.';
    resultBlock.classList.add('show','fail');
    setProgress(7);
  }

  hideProgress();
  btn.disabled = false;
  btn.innerHTML = 'Run Budget Processor';
}

function clearFileSelection(key) {
  filePaths[key] = '';
  fileDirs[key]  = '';
  const tile    = document.getElementById('tile-' + key);
  const display = document.getElementById('path-display-' + key);
  const status  = document.getElementById('status-' + key);
  tile.classList.remove('done','file-error');
  display.textContent = 'No file selected';
  display.classList.add('placeholder');
  const extHints = { target:'.xlsm', balance:'.xls / .xlsx', operating:'.xls / .xlsx', reserve:'.xls / .xlsx', cy:'.xls / .xlsx', py:'.xls / .xlsx' };
  status.textContent = 'Required · ' + (extHints[key] || '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Stop app ──────────────────────────────────────────────────────────────────
async function stopApp() {
  if (!confirm("This will shut down the Budget Processor server.\n\nYou will need to double-click the launcher again to restart it.\n\nStop the app?")) return;
  try { await fetch('/shutdown', { method:'POST' }); } catch(e) {}
  document.body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:Montserrat,sans-serif;color:#1e3a5f;gap:16px;">' +
    '<div style="font-size:40px;">✓</div>' +
    '<div style="font-size:20px;font-weight:700;">Budget Processor Stopped</div>' +
    '<div style="font-size:14px;color:#6b7f93;">You can close this tab. Double-click the launcher to restart.</div>' +
    '</div>';
}

// ── Memory, session restore ───────────────────────────────────────────────────
const MONTH_NAMES = {
  '01':'January','02':'February','03':'March','04':'April',
  '05':'May','06':'June','07':'July','08':'August',
  '09':'September','10':'October','11':'November','12':'December',
};

async function initPage() {
  let data = {};
  try {
    const res = await fetch('/memory');
    data = await res.json();
  } catch(e) {}

  const hasAssoc      = data.last_association && data.last_number;
  const hasFolder     = data.last_backup_folder;
  const hasPeriod     = data.last_month && data.last_year;
  const hasBudgetYear = data.last_budget_year;

  if (hasAssoc || hasFolder || hasPeriod || hasBudgetYear) {
    let parts = [];
    if (hasAssoc)  parts.push(`<span>${data.last_association} (#${data.last_number})</span>`);
    if (hasPeriod) { const m = MONTH_NAMES[data.last_month]||data.last_month; parts.push(`period <span>${m} ${data.last_year}</span>`); }
    if (hasBudgetYear) parts.push(`budget year <span>${data.last_budget_year}</span>`);
    if (hasFolder) {
      const fp = (data.last_backup_folder||'').replace(/\\/g,'/').split('/');
      parts.push(`backup folder <span>${fp[fp.length-1]||data.last_backup_folder}</span>`);
    }
    document.getElementById('restore-detail').innerHTML = 'Last session: ' + parts.join(' · ') + '. Restore these values?';
    document.getElementById('restore-banner').classList.add('show');
    restoredData = data;
  }

  // Date defaults if no saved period
  if (!restoredData || (!restoredData.last_month && !restoredData.last_year)) {
    const now = new Date();
    document.getElementById('sel-month').value = String(now.getMonth()+1).padStart(2,'0');
    document.getElementById('inp-year').value  = now.getFullYear();
  }
  if (!restoredData || !restoredData.last_budget_year) {
    const now = new Date();
    document.getElementById('inp-budget-year').value = now.getFullYear();
  }
}

function restoreSession() {
  if (!restoredData) return;
  const d = restoredData;

  function flash(id) {
    const el = document.getElementById(id);
    el.classList.add('field-restored');
    setTimeout(() => el.classList.remove('field-restored'), 1800);
  }

  if (d.last_association) {
    const sel = document.getElementById('assoc-select');
    sel.value = d.last_association;
    onAssocChange(sel);
    flash('field-association');
  }
  if (d.last_month) {
    document.getElementById('sel-month').value = d.last_month;
    document.getElementById('field-month').classList.remove('field-error');
    flash('field-month');
  }
  if (d.last_year) {
    document.getElementById('inp-year').value = d.last_year;
    document.getElementById('field-year').classList.remove('field-error');
    flash('field-year');
  }
  if (d.last_budget_year) {
    document.getElementById('inp-budget-year').value = d.last_budget_year;
    document.getElementById('field-budget-year').classList.remove('field-error');
    flash('field-budget-year');
  }
  if (d.last_backup_folder) {
    applyFolder(d.last_backup_folder);
  }

  document.getElementById('restore-banner').classList.remove('show');
}

function dismissRestore() {
  document.getElementById('restore-banner').classList.remove('show');
}

// Live-clear field errors
['assoc-select','sel-month','inp-year','inp-budget-year','inp-password'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  ['input','change'].forEach(evt => el.addEventListener(evt, () => {
    const fieldMap = {
      'assoc-select':'field-association',
      'sel-month':'field-month',
      'inp-year':'field-year',
      'inp-budget-year':'field-budget-year',
      'inp-password':'field-password'
    };
    const fid = fieldMap[id];
    if (fid) {
      document.getElementById(fid).classList.remove('field-error');
      clearValidationItem(fid);
    }
  }));
});

window.onload = () => initPage();