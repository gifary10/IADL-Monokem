// ============================================================
// data.js — Table Render, CRUD Operations, Filters
// ============================================================

// ── Debounce utility ────────────────────────────────────────
let _debounceTimer = null;
function debounce(func, delay = 300) {
  return function(...args) {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => func.apply(this, args), delay);
  };
}

// ── Load Records from GAS ─────────────────────────────────────
async function loadRecords() {
  showLoading('Memuat data risiko...');
  try {
    const res = await fetchRecords(STATE.dept);
    if (res.ok) {
      STATE.records = res.records;
      renderTable();
      updateStats();
      // Trigger state change event
      window.dispatchEvent(new CustomEvent('recordsUpdated', { detail: STATE.records }));
    } else {
      const errorMsg = handleApiError(null, res.msg || 'Gagal memuat data.');
      toast(errorMsg, 'error');
    }
  } catch (e) {
    const errorMsg = handleApiError(e, 'Gagal memuat data dari server.');
    toast(errorMsg, 'error');
    console.error('Load records error:', e);
  }
  hideLoading();
}

// ── Debounced search handler ──────────────────────────────────
const debouncedRenderTable = debounce(() => renderTable(), 300);

// ── Render Table ──────────────────────────────────────────────
function renderTable() {
  const q     = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const fRisk = document.getElementById('filterRisk')?.value    || '';
  const fKond = document.getElementById('filterKondisi')?.value || '';

  const filtered = STATE.records.filter(r => {
    const match    = !q || [r['Aktifitas'], r['Lokasi'], r['Deskripsi Hazard'], r['No Hazard']]
      .some(v => String(v || '').toLowerCase().includes(q));
    const riskMatch = !fRisk || (r['Penilaian Risiko'] || '') === fRisk;
    const kondMatch = !fKond || r['Kondisi'] === fKond;
    return match && riskMatch && kondMatch;
  });

  const countEl = document.getElementById('recordCount');
  if (countEl) {
    countEl.textContent = `${filtered.length} entri`;
    if (q || fRisk || fKond) {
      countEl.textContent += ` (difilter dari ${STATE.records.length})`;
    }
  }

  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  if (!filtered.length) {
    const msg = STATE.records.length === 0 
      ? 'Belum ada data. Klik "Input Data Baru" untuk memulai.'
      : 'Tidak ada data ditemukan dengan filter yang dipilih.';
    tbody.innerHTML = `<tr><td colspan="21"><div class="empty-state"><i class="bi bi-inbox"></i><p>${msg}</p></div></td></tr>`;
    return;
  }

  const trunc = (val, len = 80) => { 
    const s = String(val || '—'); 
    return s.length > len ? s.substring(0, len) + '…' : s; 
  };

  // Use DocumentFragment for performance
  const frag = document.createDocumentFragment();
  filtered.forEach((r, i) => {
    const origIdx = STATE.records.indexOf(r);
    const ts      = r['TimeStamp'] ? String(r['TimeStamp']).substring(0, 16) : '—';
    const tr      = document.createElement('tr');
    tr.innerHTML = `
      <td class="text-muted-custom font-mono" style="font-size:11px">${i + 1}</td>
      <td style="font-size:11px;color:var(--clr-muted);white-space:nowrap">${ts}</td>
      <td style="font-size:12px">${r['Departemen'] || '—'}</td>
      <td class="bold-cell" style="max-width:150px;white-space:normal">${r['Aktifitas'] || '—'}</td>
      <td>${r['Lokasi'] || '—'}</td>
      <td><span class="risk-badge" style="background:rgba(148,163,184,0.1);color:var(--clr-subtle);border:1px solid var(--clr-border2)">${r['Kondisi'] || '—'}</span></td>
      <td><span class="no-hazard-code">${r['No Hazard'] || '—'}</span></td>
      <td>${r['Klasifikasi Resiko'] || '—'}</td>
      <td style="max-width:160px;white-space:normal;font-size:12px;color:var(--clr-muted)">${trunc(r['Deskripsi Hazard'])}</td>
      <td style="max-width:160px;white-space:normal;font-size:12px;color:var(--clr-muted)">${trunc(r['Dampak'])}</td>
      <td class="font-mono text-center">${r['Nilai Probabilitas'] || '—'}</td>
      <td class="font-mono text-center">${r['Nilai Dampak'] || '—'}</td>
      <td class="font-mono text-center" style="color:var(--clr-amber)">${r['PxD Awal'] || '—'}</td>
      <td>${riskBadge(r['Penilaian Risiko'])}</td>
      <td style="font-size:12px;color:var(--clr-muted)">${r['Pengendalian Risiko'] || '—'}</td>
      <td style="max-width:180px;white-space:normal;font-size:12px;color:var(--clr-muted)">${trunc(r['Deskripsi Pengendalian'])}</td>
      <td class="font-mono text-center">${r['Nilai Pengendalian Probabilitas'] || '—'}</td>
      <td class="font-mono text-center">${r['Nilai Penilaian Dampak'] || '—'}</td>
      <td class="font-mono text-center" style="color:var(--clr-green)">${r['PxD Akhir'] || '—'}</td>
      <td>${riskBadge(r['Risiko Setelah Pengendalian'])}</td>
      <td>
        <div class="action-btns">
          <button class="btn-edit-soft" data-idx="${origIdx}" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn-danger-soft" data-del="${origIdx}" title="Hapus"><i class="bi bi-trash3"></i></button>
        </div>
      </td>`;
    frag.appendChild(tr);
  });

  tbody.innerHTML = '';
  tbody.appendChild(frag);

  // Event delegation for edit/delete buttons
  tbody.querySelectorAll('[data-idx]').forEach(btn =>
    btn.addEventListener('click', () => editRecord(Number(btn.dataset.idx))));
  tbody.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => deleteRecord(Number(btn.dataset.del))));
}

// ── Delete Flow ───────────────────────────────────────────────
function deleteRecord(idx) {
  const rec = STATE.records[idx];
  if (!rec) {
    toast('Data tidak ditemukan.', 'error');
    return;
  }
  STATE.deleteRowNum   = rec._row;
  STATE.deleteHazardNo = rec['No Hazard'];
  document.getElementById('deleteHazardNo').textContent = rec['No Hazard'];
  new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
  const modalEl = document.getElementById('deleteModal');
  const modal = bootstrap.Modal.getInstance(modalEl);
  if (modal) modal.hide();
  
  showLoading('Menghapus data...');
  try {
    const res = await removeRecord(STATE.deleteRowNum);
    if (res.ok) {
      toast(res.msg || 'Data berhasil dihapus.', 'success');
      await loadRecords();
    } else {
      toast(res.msg || 'Gagal menghapus data.', 'error');
    }
  } catch (e) {
    const errorMsg = handleApiError(e, 'Gagal menghapus data dari server.');
    toast(errorMsg, 'error');
    console.error('Delete error:', e);
  }
  hideLoading();
}

// ── Export CSV ────────────────────────────────────────────────
function exportCSV() {
  if (!STATE.records.length) { 
    toast('Tidak ada data untuk diekspor.', 'warning'); 
    return; 
  }

  try {
    const headers = ['TimeStamp','Departemen','Aktifitas','Lokasi','Kondisi','No Hazard',
      'Klasifikasi Resiko','Deskripsi Hazard','Dampak','Nilai Probabilitas','Nilai Dampak',
      'PxD Awal','Penilaian Risiko','Pengendalian Risiko','Deskripsi Pengendalian',
      'Nilai Pengendalian Probabilitas','Nilai Penilaian Dampak','PxD Akhir','Risiko Setelah Pengendalian'];

    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const rows = STATE.records.map(r => headers.map(h => esc(r[h])).join(','));
    const csv  = [headers.map(esc).join(','), ...rows].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; 
    a.download = `IADL_${STATE.dept}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Data berhasil diekspor ke CSV.', 'success');
  } catch (e) {
    console.error('Export CSV error:', e);
    toast('Gagal mengekspor data ke CSV.', 'error');
  }
}

// ── Init search listeners ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    // Replace existing oninput with debounced version
    searchInput.removeAttribute('oninput');
    searchInput.addEventListener('input', debouncedRenderTable);
  }
  
  const filterRisk = document.getElementById('filterRisk');
  const filterKond = document.getElementById('filterKondisi');
  if (filterRisk) filterRisk.addEventListener('change', renderTable);
  if (filterKond) filterKond.addEventListener('change', renderTable);
});