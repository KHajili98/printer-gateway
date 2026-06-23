'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function toast(msg, type = 'success') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  setTimeout(() => el.classList.remove('show'), 4000);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

function renderWorkers(workers) {
  const list = $('#workerList');
  list.innerHTML = '';

  if (!workers.length) {
    list.innerHTML = '<p class="card-desc">Heç bir işçi printer yoxdur.</p>';
    return;
  }

  workers.forEach((w, i) => {
    const div = document.createElement('div');
    div.className = 'worker-item';
    div.innerHTML = `
      <div class="field">
        <label>Ad</label>
        <input type="text" data-field="name" data-idx="${i}" value="${esc(w.name)}">
      </div>
      <div class="field">
        <label>IP</label>
        <input type="text" data-field="ip" data-idx="${i}" value="${esc(w.ip)}">
      </div>
      <div class="field">
        <label>Port</label>
        <input type="number" data-field="port" data-idx="${i}" value="${w.port || 9100}">
      </div>
      <button type="button" class="btn btn-danger" data-remove="${i}">Sil</button>
    `;
    list.appendChild(div);
  });

  list.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      workers.splice(Number(btn.dataset.remove), 1);
      renderWorkers(workers);
    });
  });
}

function esc(s) {
  return String(s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function collectWorkers() {
  const workers = [];
  $$('#workerList .worker-item').forEach((item) => {
    workers.push({
      name: item.querySelector('[data-field="name"]').value,
      ip: item.querySelector('[data-field="ip"]').value,
      port: Number(item.querySelector('[data-field="port"]').value) || 9100,
    });
  });
  return workers;
}

let workers = [];

function fillForm(cfg) {
  $('#port').value = cfg.port || 3000;
  $('#apiKey').value = cfg.apiKey || '';
  $('#mode').value = cfg.mode || 'both';
  $('#locationId').value = cfg.locationId || '1';
  $('#backendWsUrl').value = cfg.backendWsUrl || '';
  $('#gatewayToken').value = cfg.gatewayToken || '';
  $('#scanSubnet').value = cfg.scanSubnet || cfg.detectedSubnet || '192.168.1.';
  $('#scanPort').value = cfg.scanPort || 9100;

  const main = cfg.printers?.main || {};
  $('#mainName').value = main.name || 'Kassa printer';
  $('#mainIp').value = main.ip || '';
  $('#mainPort').value = main.port || 9100;

  workers = cfg.printers?.workers || [];
  renderWorkers(workers);
}

function collectForm() {
  return {
    port: Number($('#port').value) || 3000,
    apiKey: $('#apiKey').value.trim(),
    mode: $('#mode').value,
    locationId: $('#locationId').value.trim(),
    backendWsUrl: $('#backendWsUrl').value.trim(),
    gatewayToken: $('#gatewayToken').value.trim(),
    scanSubnet: $('#scanSubnet').value.trim(),
    scanPort: Number($('#scanPort').value) || 9100,
    printers: {
      main: {
        name: $('#mainName').value.trim(),
        ip: $('#mainIp').value.trim(),
        port: Number($('#mainPort').value) || 9100,
      },
      workers: collectWorkers(),
    },
  };
}

async function loadConfig() {
  const cfg = await api('/api/setup/config');
  fillForm(cfg);
  await refreshStatus();
}

async function refreshStatus() {
  const st = await api('/api/setup/status');
  const chipService = $('#chipService');
  chipService.className = 'chip ok';
  chipService.innerHTML = '<span class="dot"></span> Servis işləyir';

  const chipMain = $('#chipMain');
  const mainOk = st.printers?.main?.reachable;
  chipMain.className = mainOk ? 'chip ok' : 'chip bad';
  chipMain.innerHTML = `<span class="dot"></span> Əsas printer ${mainOk ? 'online' : 'offline'}`;

  const chipMode = $('#chipMode');
  chipMode.className = 'chip warn';
  chipMode.innerHTML = `<span class="dot"></span> ${st.mode || 'both'}`;

  const container = $('#printerStatus');
  container.innerHTML = '';

  if (st.printers?.main) {
    container.appendChild(printerRow('Əsas', st.printers.main.name || st.printers.main.ip, st.printers.main.reachable));
  }

  for (const w of st.printers?.workers || []) {
    container.appendChild(printerRow(w.name, w.ip, w.reachable));
  }

  if (!st.printers?.main && !(st.printers?.workers?.length)) {
    container.innerHTML = '<p class="card-desc">Printer konfiqurasiya edilməyib.</p>';
  }
}

function printerRow(name, ip, ok) {
  const div = document.createElement('div');
  div.className = 'printer-row';
  div.innerHTML = `
    <span>${esc(name)} <small style="color:var(--muted)">${esc(ip)}</small></span>
    <span class="badge ${ok ? 'ok' : 'bad'}">${ok ? 'Online' : 'Offline'}</span>
  `;
  return div;
}

async function saveConfig() {
  const payload = collectForm();
  const result = await api('/api/setup/config', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  toast(result.message || 'Saxlanildi');
  if (result.config) fillForm(result.config);
}

async function testPrint(target) {
  toast('Test çap göndərilir...', 'success');
  try {
    const r = await api('/api/setup/test', {
      method: 'POST',
      body: JSON.stringify({ target }),
    });
    toast(r.message || 'Test çap uğurlu');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function runScan() {
  const btn = $('#btnScan');
  const label = $('#scanLabel');
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span> Scan...';

  try {
    const subnet = $('#scanSubnet').value.trim();
    const port = Number($('#scanPort').value) || 9100;
    const result = await api('/api/setup/scan', {
      method: 'POST',
      body: JSON.stringify({ subnet, port }),
    });

    const box = $('#scanResults');
    box.classList.remove('hidden');

    if (!result.found?.length) {
      box.innerHTML = '<p class="card-desc">Printer tapılmadı.</p>';
      return;
    }

    box.innerHTML = result.found.map((p) => `
      <div class="scan-item">
        <span>${p.ip}:${p.port}</span>
        <button type="button" class="btn btn-secondary btn-sm" data-use-ip="${p.ip}">Əsas printer et</button>
      </div>
    `).join('');

    box.querySelectorAll('[data-use-ip]').forEach((b) => {
      b.addEventListener('click', () => {
        $('#mainIp').value = b.dataset.useIp;
        toast(`${b.dataset.useIp} əsas printer olaraq seçildi`);
      });
    });

    toast(`${result.found.length} printer tapıldı (${result.scanDurationMs}ms)`);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    label.textContent = 'Scan başlat';
  }
}

$('#btnSave').addEventListener('click', () => saveConfig().catch((e) => toast(e.message, 'error')));
$('#btnRestart').addEventListener('click', async () => {
  if (!confirm('Servis yenidən başladilacaq. Davam?')) return;
  await api('/api/setup/restart', { method: 'POST' });
  toast('Servis yenidən başladilir... Bir neçə saniyə gözləyin.');
  setTimeout(() => location.reload(), 3000);
});
$('#btnGenKey').addEventListener('click', async () => {
  const r = await api('/api/setup/generate-key', { method: 'POST' });
  $('#apiKey').value = r.apiKey;
  toast('Yeni API açarı yaradıldı');
});
$('#btnTestMain').addEventListener('click', () => testPrint({ type: 'main' }));
$('#btnAddWorker').addEventListener('click', () => {
  workers.push({ name: 'Yeni printer', ip: '', port: 9100 });
  renderWorkers(workers);
});
$('#btnScan').addEventListener('click', () => runScan());
$('#btnRefreshStatus').addEventListener('click', () => refreshStatus().catch((e) => toast(e.message, 'error')));

loadConfig().catch((e) => toast(e.message, 'error'));
setInterval(() => refreshStatus().catch(() => {}), 15000);
