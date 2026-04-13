// ============================================================
// dashboard.js — Dashboard Analytics & Charts
// ============================================================

// Chart.js instances (for re-render cleanup)
let _charts = {};

function destroyChart(key) {
  if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }
}

function renderDashboard() {
  if (!STATE.records.length) {
    document.getElementById('dashboardEmpty').style.display = 'block';
    document.getElementById('dashboardContent').style.display = 'none';
    return;
  }
  document.getElementById('dashboardEmpty').style.display = 'none';
  document.getElementById('dashboardContent').style.display = 'block';

  renderRiskDonut();
  renderProbDampakScatter();
  renderKondisiBar();
  renderKlasifikasiBar();
  renderTopHazardTable();
}

// ── Donut: Risk Level Distribution ───────────────────────────
function renderRiskDonut() {
  destroyChart('donut');
  const r = STATE.records;
  const counts = {
    Extreme: r.filter(x => x['Penilaian Risiko'] === 'Extreme').length,
    High:    r.filter(x => x['Penilaian Risiko'] === 'High').length,
    Medium:  r.filter(x => x['Penilaian Risiko'] === 'Medium').length,
    Low:     r.filter(x => x['Penilaian Risiko'] === 'Low').length,
  };
  const ctx = document.getElementById('chartRiskDonut')?.getContext('2d');
  if (!ctx) return;
  _charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#10b981'],
        borderWidth: 3,
        borderColor: '#fff',
        hoverOffset: 8
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} (${Math.round(ctx.parsed / r.length * 100)}%)`
          }
        }
      },
      animation: { animateScale: true, duration: 600 }
    }
  });
}

// ── Scatter: Prob vs Dampak ───────────────────────────────────
function renderProbDampakScatter() {
  destroyChart('scatter');
  const colorMap = { Extreme: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#10b981' };
  const datasets = ['Extreme','High','Medium','Low'].map(level => ({
    label: level,
    data: STATE.records
      .filter(r => r['Penilaian Risiko'] === level)
      .map(r => ({ x: Number(r['Nilai Probabilitas']) || 0, y: Number(r['Nilai Dampak']) || 0 })),
    backgroundColor: colorMap[level] + 'cc',
    pointRadius: 6,
    pointHoverRadius: 9
  }));

  const ctx = document.getElementById('chartScatter')?.getContext('2d');
  if (!ctx) return;
  _charts.scatter = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      scales: {
        x: { title: { display: true, text: 'Probabilitas (1–6)' }, min: 0, max: 7, ticks: { stepSize: 1 } },
        y: { title: { display: true, text: 'Dampak (1–5)' },      min: 0, max: 6, ticks: { stepSize: 1 } }
      },
      plugins: { legend: { position: 'bottom' } },
      animation: { duration: 500 }
    }
  });
}

// ── Bar: Kondisi Distribution ─────────────────────────────────
function renderKondisiBar() {
  destroyChart('kondisi');
  const labels = ['Normal','Abnormal','Emergency'];
  const vals   = labels.map(l => STATE.records.filter(r => r['Kondisi'] === l).length);
  const ctx    = document.getElementById('chartKondisi')?.getContext('2d');
  if (!ctx) return;
  _charts.kondisi = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: ['#10b981aa','#f59e0baa','#ef4444aa'],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      animation: { duration: 500 }
    }
  });
}

// ── Bar: Klasifikasi ──────────────────────────────────────────
function renderKlasifikasiBar() {
  destroyChart('klasifikasi');
  const labels = ['Ekstrim','Tinggi','Sedang','Rendah'];
  const vals   = labels.map(l => STATE.records.filter(r => r['Klasifikasi Resiko'] === l).length);
  const ctx    = document.getElementById('chartKlasifikasi')?.getContext('2d');
  if (!ctx) return;
  _charts.klasifikasi = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: ['#ef4444aa','#f59e0baa','#3b82f6aa','#10b981aa'],
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      animation: { duration: 500 }
    }
  });
}

// ── Table: Top 10 Highest Risk ────────────────────────────────
function renderTopHazardTable() {
  const sorted = [...STATE.records]
    .filter(r => r['PxD Awal'])
    .sort((a, b) => Number(b['PxD Awal']) - Number(a['PxD Awal']))
    .slice(0, 10);

  const tbody = document.getElementById('topHazardBody');
  if (!tbody) return;

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:32px"><i class="bi bi-inbox"></i><p>Belum ada data.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = sorted.map((r, i) => `
    <tr>
      <td class="font-mono text-center" style="font-size:11px;color:var(--clr-muted)">${i + 1}</td>
      <td><span class="no-hazard-code">${r['No Hazard'] || '—'}</span></td>
      <td class="bold-cell" style="max-width:200px;white-space:normal">${r['Aktifitas'] || '—'}</td>
      <td class="font-mono text-center" style="color:var(--clr-amber);font-weight:600">${r['PxD Awal'] || '—'}</td>
      <td>${riskBadge(r['Penilaian Risiko'])}</td>
    </tr>`).join('');
}
