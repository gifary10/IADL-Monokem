// ============================================================
// ui.js — UI Utilities: Toast, Loading, Tabs, Error Handler
// ============================================================

// ── Centralized Error Handler ────────────────────────────────
function handleApiError(error, fallbackMsg = 'Terjadi kesalahan') {
  if (!error) return fallbackMsg;
  
  const message = error.message || String(error);
  
  // Network errors
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
  }
  
  // HTTP status errors
  if (message.includes('HTTP 401') || message.includes('HTTP 403')) {
    setTimeout(() => {
      toast('Sesi berakhir. Silakan login kembali.', 'warning');
      doLogout();
    }, 1000);
    return 'Akses ditolak. Sesi mungkin telah berakhir.';
  }
  
  if (message.includes('HTTP 404')) {
    return 'Endpoint tidak ditemukan. Periksa konfigurasi URL.';
  }
  
  if (message.includes('HTTP 500') || message.includes('HTTP 502') || message.includes('HTTP 503')) {
    return 'Server sedang mengalami gangguan. Coba lagi nanti.';
  }
  
  if (message.includes('HTTP 429')) {
    return 'Terlalu banyak permintaan. Harap tunggu sebentar.';
  }
  
  // Quota errors
  if (message.includes('QuotaExceededError') || message.includes('quota')) {
    return 'Penyimpanan lokal penuh. Hapus beberapa data atau gunakan mode ringan.';
  }
  
  // Timeout
  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Koneksi timeout. Server terlalu lama merespons.';
  }
  
  // Return original message if available, otherwise fallback
  return message.length < 100 ? message : fallbackMsg;
}

// ── Loading Overlay ──────────────────────────────────────────
let _loadingHideTimer = null;

function showLoading(text = 'Memuat data...') {
  clearTimeout(_loadingHideTimer);
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = text;
  if (overlay) overlay.classList.add('active');
}

function hideLoading() {
  // Small delay to prevent flickering
  _loadingHideTimer = setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  }, 100);
}

// ── Toast Notifications ───────────────────────────────────────
let _toastIdCounter = 0;

function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  
  _toastIdCounter++;
  const toastId = `toast-${_toastIdCounter}`;
  const el = document.createElement('div');
  el.id = toastId;
  el.className = `toast-msg ${type}`;
  
  const iconMap = {
    'success': 'bi-check-circle-fill',
    'error':   'bi-x-circle-fill',
    'warning': 'bi-exclamation-triangle-fill',
    'info':    'bi-info-circle-fill'
  };
  
  const icon = iconMap[type] || iconMap['info'];
  el.innerHTML = `<i class="bi ${icon} toast-icon"></i><span class="toast-text">${msg}</span><button class="toast-close" aria-label="Tutup"><i class="bi bi-x"></i></button>`;
  c.appendChild(el);
  
  // Limit toasts to 5 visible at once
  const toasts = c.querySelectorAll('.toast-msg');
  if (toasts.length > 5) {
    const oldestToast = toasts[0];
    oldestToast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => oldestToast.remove(), 300);
  }
  
  // Auto-remove after 4s
  const timer = setTimeout(() => {
    const target = document.getElementById(toastId);
    if (target) {
      target.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => target.remove(), 300);
    }
  }, 4000);
  
  // Manual close
  const closeBtn = el.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      clearTimeout(timer);
      el.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    });
  }
}

// ── Tab Navigation ────────────────────────────────────────────
function switchTab(tabId) {
  // Cleanup previous tab resources
  if (STATE.activeTab === 'dashboard') {
    Object.keys(_charts || {}).forEach(key => {
      if (_charts[key]) {
        _charts[key].destroy();
        delete _charts[key];
      }
    });
  }
  
  // Deactivate all
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

  // Activate target
  const btn   = document.querySelector(`[data-tab="${tabId}"]`);
  const panel = document.getElementById(`tab-${tabId}`);
  if (btn)   btn.classList.add('active');
  if (panel) { 
    panel.classList.add('active'); 
    // Scroll to top of panel
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  STATE.activeTab = tabId;

  // Tab-specific init
  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'data') renderTable();
}

// ── Stats Cards Update ────────────────────────────────────────
function updateStats() {
  const r = STATE.records;
  const set = (id, val) => { 
    const el = document.getElementById(id); 
    if (el) el.textContent = val; 
  };
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
  
  // Close tooltip on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTooltip();
  });
  
  // Close tooltip on scroll
  window.addEventListener('scroll', () => {
    if (_activeIcon) closeTooltip();
  }, { passive: true });
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
  
  // Ensure tooltip stays within viewport
  if (left + tw > window.innerWidth - 16) left = window.innerWidth - tw - 16;
  if (left < 8) left = 8;
  
  // If tooltip would go below viewport, show above
  if (top + 200 > window.innerHeight + window.scrollY) {
    top = rect.top + window.scrollY - 210;
  }
  
  t.style.left  = left + 'px';
  t.style.top   = top + 'px';
  t.style.width = tw + 'px';
  t.style.animation = 'none';
  requestAnimationFrame(() => { t.style.animation = 'tooltipIn 0.18s ease forwards'; });
}

// ── Confirmation Dialog ───────────────────────────────────────
function confirmDialog(message, title = 'Konfirmasi') {
  return new Promise((resolve) => {
    const Modal = bootstrap.Modal;
    const modalHtml = `
      <div class="modal fade modal-dark" id="confirmModal" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body p-4">
              <p style="color:var(--clr-subtle)">${message}</p>
            </div>
            <div class="modal-footer">
              <button class="btn-ghost" data-bs-dismiss="modal" id="confirmCancel">Batal</button>
              <button class="btn-accent px-4" id="confirmOk">OK</button>
            </div>
          </div>
        </div>
      </div>`;
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild);
    
    const modalEl = document.getElementById('confirmModal');
    const modal = new Modal(modalEl);
    
    document.getElementById('confirmOk').onclick = () => {
      modal.hide();
      resolve(true);
    };
    
    document.getElementById('confirmCancel').onclick = () => {
      modal.hide();
      resolve(false);
    };
    
    modalEl.addEventListener('hidden.bs.modal', () => {
      modalEl.remove();
      resolve(false);
    });
    
    modal.show();
  });
}

// Expose confirmDialog globally
window.confirmDialog = confirmDialog;