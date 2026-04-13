// ============================================================
// ui.js — UI Utilities: Toast, Loading, Tabs, Navigation
// ============================================================

// ── Loading Overlay ──────────────────────────────────────────
function showLoading(text = 'Memuat data...') {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loadingOverlay').classList.add('active');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

// ── Toast Notifications ───────────────────────────────────────
function toast(msg, type = 'success') {
  const c  = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  const icon = type === 'success' ? 'bi-check-circle-fill' : type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-x-circle-fill';
  el.innerHTML = `<i class="bi ${icon} toast-icon"></i><span class="toast-text">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></button>`;
  c.appendChild(el);
  // Auto-remove after 3.5s with fade
  const timer = setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
  el.querySelector('.toast-close').addEventListener('click', () => clearTimeout(timer));
}

// ── Tab Navigation ────────────────────────────────────────────
function switchTab(tabId) {
  // Deactivate all
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  // Activate target
  const btn   = document.querySelector(`[data-tab="${tabId}"]`);
  const panel = document.getElementById(`tab-${tabId}`);
  if (btn)   btn.classList.add('active');
  if (panel) { panel.classList.add('active'); }

  STATE.activeTab = tabId;

  // Tab-specific init
  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'data') renderTable();
}

// ── Stats Cards Update ────────────────────────────────────────
function updateStats() {
  const r = STATE.records;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('statTotal',   r.length);
  set('statExtreme', r.filter(x => x['Penilaian Risiko'] === 'Extreme').length);
  set('statHigh',    r.filter(x => x['Penilaian Risiko'] === 'High').length);
  set('statMedium',  r.filter(x => x['Penilaian Risiko'] === 'Medium').length);
  set('statLow',     r.filter(x => x['Penilaian Risiko'] === 'Low').length);
}

// ── Tooltip System ────────────────────────────────────────────
let _activeIcon = null;

document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', function(e) {
    const icon = e.target.closest('.hint-icon');
    if (icon) {
      e.stopPropagation();
      if (_activeIcon === icon) { closeTooltip(); return; }
      showHintTooltip(icon, icon.dataset.hint);
      return;
    }
    const tooltip = document.getElementById('hintTooltip');
    if (tooltip && !tooltip.contains(e.target)) closeTooltip();
  });
});

function closeTooltip() {
  const t = document.getElementById('hintTooltip');
  if (t) { t.style.display = 'none'; t.classList.remove('visible'); }
  _activeIcon = null;
}

function showHintTooltip(iconEl, key) {
  const def = HINTS[key];
  if (!def) return;
  const t = document.getElementById('hintTooltip');
  t.innerHTML = `
    <div class="ht-header"><i class="bi ${def.icon} ht-header-icon"></i><span class="ht-header-title">${def.title}</span></div>
    <div class="ht-body">${def.body}</div>`;
  t.style.display = 'block';
  t.classList.add('visible');
  _activeIcon = iconEl;

  const rect = iconEl.getBoundingClientRect();
  const tw   = 300;
  let left   = rect.left + window.scrollX;
  let top    = rect.bottom + window.scrollY + 6;
  if (left + tw > window.innerWidth - 16) left = window.innerWidth - tw - 16;
  if (left < 8) left = 8;
  t.style.left  = left + 'px';
  t.style.top   = top + 'px';
  t.style.width = tw + 'px';
  t.style.animation = 'none';
  requestAnimationFrame(() => { t.style.animation = 'tooltipIn 0.18s ease forwards'; });
}
