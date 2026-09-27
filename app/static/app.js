let globalResults = [];

const PRESETS = {
  agencies: "growthx.com, digitalmarketer.com, webflow.com, vwo.com, hotjar.com",
  medical: "mayoclinic.org, zocdoc.com, webmd.com, healthline.com",
  ecommerce: "gymshark.com, allbirds.com, glossier.com, warbyparker.com"
};

function loadPreset(key) {
  const input = document.getElementById('targetInput');
  if (input && PRESETS[key]) {
    input.value = PRESETS[key];
    const statusMsg = document.getElementById('statusMessage');
    if (statusMsg) statusMsg.innerText = `Loaded preset: ${key.toUpperCase()} (${PRESETS[key].split(',').length} targets)`;
  }
}

async function executeScan() {
  const inputEl = document.getElementById('targetInput');
  const input = inputEl ? inputEl.value.trim() : "";
  if (!input) {
    alert("Please enter at least one target domain.");
    return;
  }

  const domains = input.split(/[\n,]+/).map(d => d.trim()).filter(Boolean);
  const scanBtn = document.getElementById('scanBtn');
  const statusMsg = document.getElementById('statusMessage');

  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.classList.add('opacity-50');
  }
  if (statusMsg) {
    statusMsg.innerText = "⏳ Infiltrating and analyzing targets in parallel...";
  }

  try {
    const resp = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains })
    });

    if (!resp.ok) throw new Error("Failed to scan targets.");

    const data = await resp.json();
    globalResults = data;
    renderResults(data);
    updateMetrics(data);

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.classList.remove('hidden');
    if (statusMsg) statusMsg.innerText = `✅ Audit complete. ${data.length} targets analyzed.`;
  } catch (err) {
    if (statusMsg) statusMsg.innerText = `❌ Error: ${err.message}`;
  } finally {
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.classList.remove('opacity-50');
    }
  }
}

function renderResults(results) {
  const tbody = document.getElementById('resultsTableBody');
  const resultCount = document.getElementById('resultCount');
  if (resultCount) resultCount.innerText = `${results.length} Targets`;
  if (!tbody) return;

  if (results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-slate-500 mono text-xs">No results.</td></tr>`;
    return;
  }

  tbody.innerHTML = results.map((r, idx) => {
    const scoreColor = r.deficit_score > 60 ? 'text-red-400 bg-red-950/40 border-red-800/60' :
                       r.deficit_score > 35 ? 'text-amber-400 bg-amber-950/40 border-amber-800/60' :
                       'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    
    const techBadges = r.cms_tech.length > 0 
      ? r.cms_tech.map(t => `<span class="inline-block px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 mono border border-slate-700/60">${t}</span>`).join(' ')
      : `<span class="text-slate-500 text-[11px] mono">Custom Stack</span>`;

    const analyticsBadges = r.analytics_tools.length > 0
      ? r.analytics_tools.map(a => `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-indigo-950/60 text-indigo-300 mono border border-indigo-800/50">${a}</span>`).join(' ')
      : `<span class="text-rose-400 text-[11px] mono font-semibold">⚠️ No Analytics Found</span>`;

    const contacts = [...r.emails_found, ...r.phones_found];
    const contactDisplay = contacts.length > 0
      ? contacts.slice(0, 2).map(c => `<div class="text-[11px] text-cyan-300 mono">${c}</div>`).join('')
      : `<span class="text-slate-500 text-[11px] mono">Form only</span>`;

    return `
      <tr class="hover:bg-slate-900/50 transition">
        <td class="py-3 px-4">
          <div class="font-bold text-white flex items-center gap-1.5">
            <a href="${r.url}" target="_blank" class="hover:text-cyan-400 underline decoration-slate-700 underline-offset-2">${r.domain}</a>
          </div>
          <div class="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">${r.title}</div>
        </td>
        <td class="py-3 px-4">${techBadges}</td>
        <td class="py-3 px-4"><div class="flex flex-wrap gap-1 max-w-xs">${analyticsBadges}</div></td>
        <td class="py-3 px-4">
          <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold mono border ${scoreColor}">
            ${r.deficit_score} / 100
          </span>
        </td>
        <td class="py-3 px-4">${contactDisplay}</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-2">
            <button onclick="generateAuditReport(${idx})" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-semibold mono border border-slate-700 transition">
              📄 Audit PDF
            </button>
            <button onclick="openPitchModal(${idx})" class="px-2.5 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white text-[11px] font-semibold mono transition">
              ✉️ Pitch
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function updateMetrics(results) {
  const scanned = document.getElementById('metric-scanned');
  const deficits = document.getElementById('metric-deficits');
  const pipeline = document.getElementById('metric-pipeline');
  const latency = document.getElementById('metric-latency');

  if (scanned) scanned.innerText = results.length;
  
  const highDeficits = results.filter(r => r.deficit_score >= 35).length;
  if (deficits) deficits.innerText = highDeficits;
  
  const pipelineVal = highDeficits * 350;
  if (pipeline) pipeline.innerText = `$${pipelineVal.toLocaleString()}`;

  const avgLat = Math.round(results.reduce((acc, cur) => acc + cur.latency_ms, 0) / (results.length || 1));
  if (latency) latency.innerHTML = `${avgLat}<span class="text-xs text-slate-400">ms</span>`;
}

async function exportCSV() {
  if (globalResults.length === 0) return;
  const resp = await fetch('/api/export-csv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(globalResults)
  });
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexuspulse_leads_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openPitchModal(index) {
  const item = globalResults[index];
  if (!item) return;

  const pitchText = 
`Subject: Revenue leakage identified on ${item.domain}

Hi team,

I ran an autonomous technical audit across ${item.domain} this morning and identified critical bottlenecks directly impacting your inbound conversion:

1. ${item.opportunities[0] || 'Technical tracking gap'}
2. Response latency: ${item.latency_ms}ms
3. Retargeting Pixel: ${item.has_meta_pixel ? 'Active' : 'CRITICAL DEFICIT - Missing'}
4. Mobile Optimization: ${item.is_mobile_ready ? 'Detected' : 'Attention required'}

We have pre-engineered solutions to patch these leaks within 48 hours without disrupting your live operations.

Would you be open to a 5-minute walkthrough of the full report?

Best regards,
Operations Lead // NexusPulse Intelligence`;

  const modalEl = document.getElementById('modalPitchContent');
  const modalBox = document.getElementById('pitchModal');
  if (modalEl) modalEl.innerText = pitchText;
  if (modalBox) modalBox.classList.remove('hidden');
}

function closeModal() {
  const modalBox = document.getElementById('pitchModal');
  const toast = document.getElementById('copyToast');
  if (modalBox) modalBox.classList.add('hidden');
  if (toast) toast.classList.add('opacity-0');
}

function copyPitch() {
  const modalEl = document.getElementById('modalPitchContent');
  if (!modalEl) return;
  const text = modalEl.innerText;
  navigator.clipboard.writeText(text);
  const toast = document.getElementById('copyToast');
  if (toast) {
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 2000);
  }
}

function generateAuditReport(index) {
  const r = globalResults[index];
  if (!r) return;

  const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>NexusPulse Executive Audit: ${r.domain}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css">
  <style>
    body { font-family: sans-serif; background: #ffffff; color: #0f172a; padding: 40px; }
    .mono { font-family: monospace; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body class="max-w-4xl mx-auto space-y-8">
  <div class="no-print flex justify-between items-center bg-gray-900 text-white p-4 rounded-xl mb-6">
    <span class="mono text-xs text-blue-400">NEXUSPULSE // EXECUTIVE PRINTABLE AUDIT</span>
    <button onclick="window.print()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold mono">Print / Save as PDF</button>
  </div>

  <div class="border-b border-gray-200 pb-6 flex justify-between items-start">
    <div>
      <div class="text-xs uppercase mono tracking-widest text-gray-400">Technical Diagnostic & Conversion Audit</div>
      <h1 class="text-3xl font-extrabold text-gray-900 mt-1">${r.domain}</h1>
      <p class="text-sm text-gray-500 mt-1">Generated: ${new Date().toLocaleDateString()} | System Engine: NexusPulse v1.0</p>
    </div>
    <div class="text-right">
      <div class="inline-block px-4 py-2 rounded-xl text-center ${r.deficit_score > 50 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
        <div class="text-xs font-bold mono uppercase">Deficit Score</div>
        <div class="text-2xl font-black mono">${r.deficit_score} / 100</div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="border border-gray-200 p-4 rounded-xl">
      <div class="text-xs text-gray-500 uppercase mono">SSL Encryption</div>
      <div class="text-lg font-bold ${r.has_ssl ? 'text-green-600' : 'text-red-600'}">${r.has_ssl ? 'Active (Secure)' : 'Critical Failure'}</div>
    </div>
    <div class="border border-gray-200 p-4 rounded-xl">
      <div class="text-xs text-gray-500 uppercase mono">Retargeting Pixel</div>
      <div class="text-lg font-bold ${r.has_meta_pixel ? 'text-green-600' : 'text-red-600'}">${r.has_meta_pixel ? 'Active' : 'Missing'}</div>
    </div>
    <div class="border border-gray-200 p-4 rounded-xl">
      <div class="text-xs text-gray-500 uppercase mono">Mobile Responsive</div>
      <div class="text-lg font-bold ${r.is_mobile_ready ? 'text-green-600' : 'text-yellow-600'}">${r.is_mobile_ready ? 'Optimized' : 'Attention Required'}</div>
    </div>
    <div class="border border-gray-200 p-4 rounded-xl">
      <div class="text-xs text-gray-500 uppercase mono">Server Latency</div>
      <div class="text-lg font-bold text-gray-800">${r.latency_ms} ms</div>
    </div>
  </div>

  <div class="space-y-4">
    <h3 class="text-base font-bold text-gray-900 uppercase mono tracking-wider">Identified Optimization Opportunities</h3>
    <ul class="space-y-2">
      ${r.opportunities.map(op => `
        <li class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
          <span class="text-red-500 font-bold">⚠️</span>
          <span class="text-gray-700">${op}</span>
        </li>
      `).join('')}
    </ul>
  </div>

  <div class="p-6 bg-gray-900 text-gray-100 rounded-2xl space-y-2">
    <h4 class="font-bold text-sm text-blue-400 uppercase mono">Architectural Recommendation</h4>
    <p class="text-sm leading-relaxed text-gray-300">
      Traffic driven to ${r.domain} without calibrated analytics and retargeting pixels results in uncaptured leads and untracked marketing spend. Resolving these infrastructure bottlenecks restores full attribution and lifts mobile inquiry conversion.
    </p>
  </div>

  <div class="text-center pt-8 border-t border-gray-200 text-xs text-gray-400 mono">
    CONFIDENTIAL INTELLIGENCE DELIVERABLE // NEXUSPULSE ENTERPRISE
  </div>
</body>
</html>
  `;

  const w = window.open('', '_blank');
  w.document.write(reportHtml);
  w.document.close();
}
