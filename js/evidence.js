// ============================================================
// evidence.js — Evidence Module
// - Form fields: Tanggal, PIC, Catatan, Pengesahan
// - Upload foto → IndexedDB (base64)
// - Submit metadata → Google Sheets (EVIDENCE sheet via GAS)
// - Generate PDF report (jsPDF + html2canvas)
// ============================================================

// ── IndexedDB Helper ────────────────────────────────────────
const DB_NAME = 'IADL_Evidence_DB';
const DB_VERSION = 1;
const STORE_NAME = 'evidence_files';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

async function idbSaveFiles(noHazard, files) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Remove old data for this hazard
    store.delete(noHazard);
    
    // Store new data
    store.put({
      id: noHazard,
      files: files,
      timestamp: new Date().toISOString()
    });
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => {
        // If storage full, try without images
        if (event.target.error && event.target.error.name === 'QuotaExceededError') {
          const slimFiles = files.map(f => ({
            ...f,
            dataUrl: f.dataUrl ? f.dataUrl.substring(0, 50000) + '...' : ''
          }));
          const retryTx = db.transaction(STORE_NAME, 'readwrite');
          const retryStore = retryTx.objectStore(STORE_NAME);
          retryStore.put({ id: noHazard + '_slim', files: slimFiles, timestamp: new Date().toISOString() });
          retryTx.oncomplete = () => resolve();
          retryTx.onerror = () => reject(event.target.error);
        } else {
          reject(event.target.error);
        }
      };
    });
  } catch (error) {
    console.error('IndexedDB save error:', error);
    throw error;
  }
}

async function idbLoadFiles(noHazard) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(noHazard);
    
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.files : []);
      };
      request.onerror = () => resolve([]);
    });
  } catch (error) {
    console.error('IndexedDB load error:', error);
    return [];
  }
}

async function idbDeleteFiles(noHazard) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(noHazard);
    store.delete(noHazard + '_slim');
    
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (error) {
    console.error('IndexedDB delete error:', error);
  }
}

// ── State ─────────────────────────────────────────────────────
let EV = {
  files:         [],   // { name, size, type, dataUrl }
  selectedHazard: null,
  storedEvidences: [],  // loaded from GAS
  processing: false    // Flag to prevent double submission
};

// ── Populate hazard dropdown ───────────────────────────────────
function populateEvidenceHazardSelect() {
  const sel = document.getElementById('evidenceHazardSelect');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Pilih No Hazard —</option>';
  STATE.records.forEach(r => {
    if (r['No Hazard']) {
      const o = document.createElement('option');
      o.value = r['No Hazard'];
      o.textContent = `${r['No Hazard']} — ${(r['Aktifitas'] || '').substring(0, 45)}`;
      sel.appendChild(o);
    }
  });
  if (prev) { sel.value = prev; }
}

// ── Hazard selection change ────────────────────────────────────
async function onEvidenceHazardChange(val) {
  EV.selectedHazard = val || null;
  EV.files = [];

  const uploadArea  = document.getElementById('evidenceUploadArea');
  const emptyState  = document.getElementById('evidenceEmptyState');
  const hazardInfo  = document.getElementById('evidenceHazardInfo');
  const historyWrap = document.getElementById('evidenceHistoryWrap');

  if (!val) {
    uploadArea.style.display  = 'none';
    emptyState.style.display  = 'block';
    hazardInfo.style.display  = 'none';
    historyWrap.style.display = 'none';
    return;
  }

  // Populate hazard info chip
  const rec = STATE.records.find(r => r['No Hazard'] === val);
  if (rec) {
    hazardInfo.style.display = 'block';
    hazardInfo.innerHTML = `
      <div class="ev-hazard-chip">
        <span class="no-hazard-code">${rec['No Hazard']}</span>
        ${riskBadge(rec['Penilaian Risiko'])}
        <span class="ev-hazard-chip-text">${rec['Aktifitas'] || ''}</span>
        <span class="ev-hazard-chip-dept"><i class="bi bi-building me-1"></i>${rec['Departemen'] || ''}</span>
      </div>`;
  }

  emptyState.style.display = 'none';
  uploadArea.style.display = 'block';

  // Restore files from IndexedDB (with loading indicator)
  showLoading('Memuat file evidence...');
  try {
    EV.files = await idbLoadFiles(val);
    renderFilePreview();
  } catch (error) {
    console.error('Failed to load files from IndexedDB:', error);
    toast('Gagal memuat file dari cache lokal.', 'warning');
  }
  hideLoading();

  // Load history from GAS
  loadEvidenceHistory(val);
}

// ── Load history from GAS ──────────────────────────────────────
async function loadEvidenceHistory(noHazard) {
  const historyWrap = document.getElementById('evidenceHistoryWrap');
  const historyBody = document.getElementById('evidenceHistoryBody');
  historyWrap.style.display = 'block';
  historyBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px;color:var(--clr-muted)">
    <div class="mini-spinner" style="margin:0 auto"></div>
    <span style="margin-top:8px;display:block;font-size:12px">Memuat riwayat...</span>
  </td></tr>`;

  try {
    const res = await fetchEvidences(noHazard);
    EV.storedEvidences = res.ok ? res.evidences : [];
    renderEvidenceHistory();
  } catch (error) {
    historyBody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--clr-muted);padding:16px">
      <i class="bi bi-exclamation-circle me-1"></i>Tidak dapat memuat riwayat.</td></tr>`;
    console.error('Evidence history load error:', error);
  }
}

function renderEvidenceHistory() {
  const body = document.getElementById('evidenceHistoryBody');
  if (!body) return;
  if (!EV.storedEvidences.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state" style="padding:28px"><i class="bi bi-inbox"></i><p>Belum ada evidence tersimpan.</p></div></td></tr>`;
    return;
  }
  body.innerHTML = EV.storedEvidences.map((e, i) => `
    <tr>
      <td style="font-size:11px;color:var(--clr-muted)">${String(e['TimeStamp'] || '').substring(0,16)}</td>
      <td><span class="no-hazard-code">${e['No Hazard'] || '—'}</span></td>
      <td>${e['Tanggal'] || '—'}</td>
      <td style="font-weight:600">${e['PIC'] || '—'}</td>
      <td class="font-mono text-center">${e['Jumlah File'] || 0}</td>
      <td style="max-width:180px;font-size:12px;color:var(--clr-muted)">${e['Catatan'] || '—'}</td>
      <td>
        <button class="btn-edit-soft" onclick="generatePDFReport(${i})" title="Generate PDF Report">
          <i class="bi bi-file-earmark-pdf"></i>
        </button>
      </td>
    </tr>`).join('');
}

// ── File selection & drag-drop ─────────────────────────────────
async function handleFileSelect(files) {
  const MAX = 10 * 1024 * 1024; // 10MB
  const filePromises = Array.from(files).map(f => {
    return new Promise((resolve, reject) => {
      if (f.size > MAX) {
        toast(`File "${f.name}" terlalu besar (maks 10MB).`, 'error');
        resolve(null);
        return;
      }
      
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(f.type) && !f.type.startsWith('image/')) {
        toast(`File "${f.name}" tidak didukung. Gunakan PNG, JPG, atau PDF.`, 'warning');
        resolve(null);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = e => resolve({
        name: f.name,
        size: f.size,
        type: f.type,
        dataUrl: e.target.result
      });
      reader.onerror = () => {
        toast(`Gagal membaca file "${f.name}".`, 'error');
        resolve(null);
      };
      reader.readAsDataURL(f);
    });
  });
  
  showLoading('Memproses file...');
  const results = await Promise.all(filePromises);
  const newFiles = results.filter(f => f !== null);
  
  EV.files.push(...newFiles);
  
  if (EV.selectedHazard) {
    try {
      await idbSaveFiles(EV.selectedHazard, EV.files);
    } catch (error) {
      console.error('Failed to save to IndexedDB:', error);
      toast('Gagal menyimpan file ke cache lokal. Beberapa file mungkin tidak tersimpan.', 'error');
    }
  }
  
  renderFilePreview();
  hideLoading();
  
  if (newFiles.length > 0) {
    toast(`${newFiles.length} file berhasil ditambahkan.`, 'success');
  }
}

async function removeEvidenceFile(idx) {
  EV.files.splice(idx, 1);
  if (EV.selectedHazard) {
    try {
      await idbSaveFiles(EV.selectedHazard, EV.files);
    } catch (error) {
      console.error('Failed to update IndexedDB:', error);
    }
  }
  renderFilePreview();
}

function renderFilePreview() {
  const list = document.getElementById('evidencePreviewList');
  if (!list) return;
  if (!EV.files.length) { 
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--clr-muted);font-size:12px">Belum ada file dipilih.</div>'; 
    return; 
  }

  const totalSize = EV.files.reduce((sum, f) => sum + (f.size || 0), 0);
  const sizeInfo = totalSize > 0 ? `<div style="font-size:11px;color:var(--clr-muted);margin-bottom:8px">Total: ${EV.files.length} file · ${(totalSize/1024/1024).toFixed(2)} MB</div>` : '';

  list.innerHTML = sizeInfo + EV.files.map((f, i) => {
    const isImg = f.type && f.type.startsWith('image/');
    const thumb = isImg
      ? `<img src="${f.dataUrl}" class="ev-thumb" alt="${f.name}" loading="lazy" />`
      : `<div class="ev-thumb ev-thumb-pdf"><i class="bi bi-file-earmark-pdf-fill"></i></div>`;
    const fileSize = f.size ? `${(f.size/1024).toFixed(1)} KB` : 'Unknown';
    return `
      <div class="ev-file-item">
        ${thumb}
        <div class="ev-file-info">
          <span class="ev-file-name">${f.name}</span>
          <span class="ev-file-size">${fileSize} · ${isImg ? 'Gambar' : 'PDF'}</span>
        </div>
        <button class="ev-remove-btn" onclick="removeEvidenceFile(${i})" title="Hapus">
          <i class="bi bi-x"></i>
        </button>
      </div>`;
  }).join('');
}

// ── Submit Evidence ────────────────────────────────────────────
async function submitEvidence() {
  if (EV.processing) {
    toast('Sedang memproses evidence sebelumnya. Harap tunggu.', 'warning');
    return;
  }
  
  if (!EV.selectedHazard) { toast('Pilih nomor hazard terlebih dahulu.', 'error'); return; }

  const tanggal      = document.getElementById('evTanggal').value;
  const pic          = document.getElementById('evPIC').value.trim();
  const catatan      = document.getElementById('evCatatan').value.trim();
  const dibuatOleh   = document.getElementById('evDibuatOleh').value.trim();
  const disetujui    = document.getElementById('evDisetujui').value.trim();
  const mengetahui   = document.getElementById('evMengetahui').value.trim();

  // Validation with specific messages
  if (!tanggal) { toast('Isi Tanggal Evidence terlebih dahulu.', 'error'); document.getElementById('evTanggal').focus(); return; }
  if (!pic)     { toast('Isi nama PIC terlebih dahulu.', 'error'); document.getElementById('evPIC').focus(); return; }
  if (pic.length < 3) { toast('Nama PIC minimal 3 karakter.', 'warning'); document.getElementById('evPIC').focus(); return; }

  EV.processing = true;
  const submitBtn = document.querySelector('button[onclick="submitEvidence()"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="mini-spinner" style="width:14px;height:14px;border-color:rgba(255,255,255,0.3)"></span> Menyimpan...';
  }
  
  const data = {
    'No Hazard':      EV.selectedHazard,
    'Departemen':     STATE.dept,
    'Tanggal':        tanggal,
    'PIC':            pic,
    'Catatan':        catatan,
    'Jumlah File':    EV.files.length,
    'Dibuat Oleh':    dibuatOleh,
    'Disetujui Oleh': disetujui,
    'Mengetahui':     mengetahui,
  };

  showLoading('Menyimpan evidence ke Google Sheets...');
  try {
    const res = await submitEvidenceToGAS(data);
    if (res.ok) {
      toast(res.msg || 'Evidence berhasil disimpan!', 'success');
      // Ensure files are saved to IndexedDB
      if (EV.files.length > 0) {
        await idbSaveFiles(EV.selectedHazard, EV.files);
      }
      await loadEvidenceHistory(EV.selectedHazard);
    } else {
      toast(res.msg || 'Gagal menyimpan evidence.', 'error');
    }
  } catch (error) {
    const errorMsg = handleApiError(error, 'Gagal menyimpan evidence');
    toast(errorMsg, 'error');
    console.error('Evidence submission error:', error);
  } finally {
    hideLoading();
    EV.processing = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

function clearEvidence() {
  if (EV.files.length > 0) {
    if (!confirm('Anda yakin ingin menghapus semua file yang telah diupload? Data yang sudah tersimpan di Google Sheets tidak akan terhapus.')) {
      return;
    }
  }
  
  EV.files = [];
  if (EV.selectedHazard) {
    idbDeleteFiles(EV.selectedHazard).catch(console.error);
  }
  document.getElementById('evidenceFileInput').value = '';
  document.getElementById('evCatatan').value   = '';
  document.getElementById('evTanggal').value   = '';
  document.getElementById('evPIC').value       = '';
  document.getElementById('evDibuatOleh').value  = '';
  document.getElementById('evDisetujui').value   = '';
  document.getElementById('evMengetahui').value  = '';
  renderFilePreview();
  toast('Form evidence dikosongkan.', 'info');
}

// ── Drag & Drop init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.add('drag-over');
  });
  
  zone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('drag-over');
  });
  
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  });
  
  zone.addEventListener('click', (e) => {
    if (!e.target.closest('button') && !e.target.closest('.ev-file-item') && !e.target.closest('.ev-remove-btn')) {
      document.getElementById('evidenceFileInput').click();
    }
  });
});

// ══════════════════════════════════════════════════════════════
// PDF REPORT GENERATOR
// Uses jsPDF (loaded in index.html)
// ══════════════════════════════════════════════════════════════

async function generatePDFReport(evIdx) {
  if (EV.processing) {
    toast('Sedang memproses laporan lain. Harap tunggu.', 'warning');
    return;
  }
  
  let evData, noHazard, localFiles;

  if (typeof evIdx === 'number' && EV.storedEvidences[evIdx]) {
    evData    = EV.storedEvidences[evIdx];
    noHazard  = evData['No Hazard'];
    showLoading('Memuat file dari cache lokal...');
    try {
      localFiles = await idbLoadFiles(noHazard);
    } catch (error) {
      localFiles = [];
      console.error('Failed to load files for PDF:', error);
    }
    hideLoading();
  } else {
    noHazard = EV.selectedHazard;
    if (!noHazard) { toast('Pilih hazard terlebih dahulu.', 'error'); return; }
    evData = {
      'No Hazard':      noHazard,
      'Departemen':     STATE.dept,
      'Tanggal':        document.getElementById('evTanggal').value,
      'PIC':            document.getElementById('evPIC').value,
      'Catatan':        document.getElementById('evCatatan').value,
      'Dibuat Oleh':    document.getElementById('evDibuatOleh').value,
      'Disetujui Oleh': document.getElementById('evDisetujui').value,
      'Mengetahui':     document.getElementById('evMengetahui').value,
    };
    localFiles = EV.files;
  }

  const hazardRec = STATE.records.find(r => r['No Hazard'] === noHazard) || {};
  
  EV.processing = true;
  showLoading('Membuat PDF report...');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297;
    const ML = 18, MR = 18, MT = 18;
    const CW = PW - ML - MR;

    const C = {
      teal:      [13,  148, 136],
      tealLight: [240, 253, 250],
      tealBorder:[204, 251, 241],
      slate:     [15,  23,  42],
      muted:     [100, 116, 139],
      border:    [226, 232, 240],
      white:     [255, 255, 255],
      red:       [239, 68,  68],
      amber:     [245, 158, 11],
      blue:      [59,  130, 246],
      green:     [16,  185, 129],
      bgLight:   [248, 250, 252],
    };

    const riskColor = (level) => {
      if (level === 'Extreme') return C.red;
      if (level === 'High')    return C.amber;
      if (level === 'Medium')  return C.blue;
      return C.green;
    };

    let y = MT;

    // ─── HEADER BANNER ───────────────────────────────────────
    doc.setFillColor(...C.teal);
    doc.rect(0, 0, PW, 36, 'F');
    doc.setFillColor(10, 120, 110);
    doc.rect(0, 32, PW, 4, 'F');

    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('LAPORAN EVIDENCE', ML, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Identifikasi Aspek Dampak Lingkungan & Kendali Risiko — Monokem', ML, 21);

    doc.setFontSize(8);
    const printDate = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    doc.text(`Dicetak: ${printDate}`, PW - MR, 14, { align: 'right' });
    doc.text(`Dept: ${evData['Departemen'] || STATE.dept || '—'}`, PW - MR, 20, { align: 'right' });

    y = 44;

    const drawSectionTitle = (title, icon = '') => {
      doc.setFillColor(...C.tealLight);
      doc.setDrawColor(...C.tealBorder);
      doc.roundedRect(ML, y, CW, 8, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.teal);
      doc.text((icon ? icon + '  ' : '') + title.toUpperCase(), ML + 4, y + 5.5);
      y += 11;
    };

    const drawField = (label, value, x, fw, row_y, accent = false) => {
      doc.setFillColor(...C.bgLight);
      doc.setDrawColor(...C.border);
      doc.roundedRect(x, row_y, fw, 9, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(label.toUpperCase(), x + 3, row_y + 3.5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(accent ? C.teal[0] : C.slate[0], accent ? C.teal[1] : C.slate[1], accent ? C.teal[2] : C.slate[2]);
      const val = String(value || '—');
      doc.text(val, x + 3, row_y + 7, { maxWidth: fw - 6 });
    };

    const drawRiskChip = (level, x, row_y) => {
      const col = riskColor(level);
      doc.setFillColor(col[0] + 40 < 255 ? col[0] + 80 : 255, col[1] + 40 < 255 ? col[1] + 80 : 255, col[2] + 40 < 255 ? col[2] + 80 : 255);
      doc.setDrawColor(...col);
      doc.roundedRect(x, row_y + 1, 26, 7, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...col);
      doc.text(level || '—', x + 13, row_y + 5.5, { align: 'center' });
    };

    // No Hazard + Risk level header card
    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.border);
    doc.roundedRect(ML, y, CW, 18, 3, 3, 'FD');
    doc.setFillColor(...C.teal);
    doc.roundedRect(ML, y, 4, 18, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.teal);
    doc.text(noHazard, ML + 8, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    const aktShort = (hazardRec['Aktifitas'] || '').substring(0, 80);
    doc.text(aktShort, ML + 8, y + 13, { maxWidth: CW - 50 });
    const rLevel = hazardRec['Penilaian Risiko'] || '';
    drawRiskChip(rLevel, ML + CW - 32, y + 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(`PxD: ${hazardRec['PxD Awal'] || '—'} → ${hazardRec['PxD Akhir'] || '—'}`, ML + CW - 32, y + 15, { align: 'center', maxWidth: 30 });
    y += 22;

    // Info grid: 4 columns
    drawSectionTitle('Informasi Hazard');
    const HW4 = (CW - 6) / 4;
    drawField('Lokasi',      hazardRec['Lokasi']      || '—', ML,             HW4, y);
    drawField('Kondisi',     hazardRec['Kondisi']     || '—', ML + HW4 + 2,   HW4, y);
    drawField('Klasifikasi', hazardRec['Klasifikasi Resiko'] || '—', ML + (HW4+2)*2, HW4, y);
    drawField('Departemen',  hazardRec['Departemen']  || STATE.dept || '—', ML + (HW4+2)*3, HW4, y);
    y += 13;

    const HW2 = (CW - 4) / 2;
    const descHazard = hazardRec['Deskripsi Hazard'] || '—';
    const descDampak = hazardRec['Dampak'] || '—';
    const descLines1 = doc.splitTextToSize(descHazard, HW2 - 6);
    const descLines2 = doc.splitTextToSize(descDampak, HW2 - 6);
    const descH = Math.max(descLines1.length, descLines2.length) * 4 + 10;

    doc.setFillColor(...C.bgLight);
    doc.setDrawColor(...C.border);
    doc.roundedRect(ML, y, HW2, descH, 1.5, 1.5, 'FD');
    doc.setFontSize(7); doc.setTextColor(...C.muted); doc.setFont('helvetica','normal');
    doc.text('DESKRIPSI ASPEK', ML+3, y+3.5);
    doc.setFontSize(8.5); doc.setTextColor(...C.slate); doc.setFont('helvetica','normal');
    doc.text(descLines1, ML+3, y+8);

    doc.roundedRect(ML + HW2 + 4, y, HW2, descH, 1.5, 1.5, 'FD');
    doc.setFontSize(7); doc.setTextColor(...C.muted);
    doc.text('DAMPAK LINGKUNGAN', ML + HW2 + 7, y+3.5);
    doc.setFontSize(8.5); doc.setTextColor(...C.slate);
    doc.text(descLines2, ML + HW2 + 7, y+8);
    y += descH + 4;

    drawField('Prob. Awal',    hazardRec['Nilai Probabilitas'] || '—',              ML,                HW4, y);
    drawField('Dampak Awal',   hazardRec['Nilai Dampak'] || '—',                    ML + HW4+2,        HW4, y);
    drawField('Prob. Akhir',   hazardRec['Nilai Pengendalian Probabilitas'] || '—', ML + (HW4+2)*2,    HW4, y);
    drawField('Dampak Akhir',  hazardRec['Nilai Penilaian Dampak'] || '—',          ML + (HW4+2)*3,    HW4, y);
    y += 13;

    const descKendali = hazardRec['Deskripsi Pengendalian'] || '—';
    const kendaliLines = doc.splitTextToSize(descKendali, CW - 6);
    const kendaliH = kendaliLines.length * 4 + 10;
    doc.setFillColor(...C.bgLight); doc.setDrawColor(...C.border);
    doc.roundedRect(ML, y, CW, kendaliH, 1.5, 1.5, 'FD');
    doc.setFontSize(7); doc.setTextColor(...C.muted); doc.setFont('helvetica','normal');
    doc.text('PENGENDALIAN: ' + (hazardRec['Pengendalian Risiko'] || '—'), ML+3, y+3.5);
    doc.setFontSize(8.5); doc.setTextColor(...C.slate);
    doc.text(kendaliLines, ML+3, y+8);
    y += kendaliH + 6;

    drawSectionTitle('Data Evidence');
    drawField('Tanggal',  evData['Tanggal'] || '—',      ML,           HW2,    y, false);
    drawField('PIC',      evData['PIC']     || '—',      ML + HW2 + 4, HW2,    y, false);
    y += 13;

    const catatan = evData['Catatan'] || '—';
    const catatanLines = doc.splitTextToSize(catatan, CW - 6);
    const catatanH = catatanLines.length * 4 + 10;
    doc.setFillColor(...C.bgLight); doc.setDrawColor(...C.border);
    doc.roundedRect(ML, y, CW, catatanH, 1.5, 1.5, 'FD');
    doc.setFontSize(7); doc.setTextColor(...C.muted); doc.setFont('helvetica','normal');
    doc.text('CATATAN EVIDENCE', ML+3, y+3.5);
    doc.setFontSize(8.5); doc.setTextColor(...C.slate);
    doc.text(catatanLines, ML+3, y+8);
    y += catatanH + 6;

    // ─── SECTION: FOTO EVIDENCE ─────────────────────────────
    if (localFiles && localFiles.length > 0) {
      const imgFiles = localFiles.filter(f => f.type && f.type.startsWith('image/'));
      if (imgFiles.length > 0) {
        if (y > PH - 80) { doc.addPage(); y = MT; }
        drawSectionTitle('Dokumentasi Foto Evidence');

        const imgW = (CW - 4) / 2;
        const imgH = 55;
        let col = 0;

        for (let i = 0; i < imgFiles.length; i++) {
          if (y + imgH + 14 > PH - 30) { doc.addPage(); y = MT; col = 0; }

          const x = col === 0 ? ML : ML + imgW + 4;

          doc.setFillColor(...C.bgLight); doc.setDrawColor(...C.border);
          doc.roundedRect(x, y, imgW, imgH + 10, 2, 2, 'FD');

          doc.setFillColor(...C.teal);
          doc.roundedRect(x, y, imgW, 7, 2, 2, 'F');
          doc.rect(x, y + 4, imgW, 3, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
          doc.text(`Foto ${i + 1}: ${imgFiles[i].name.substring(0,35)}`, x + 3, y + 5);

          try {
            doc.addImage(imgFiles[i].dataUrl, 'JPEG', x + 2, y + 9, imgW - 4, imgH - 2, undefined, 'MEDIUM');
          } catch(imgErr) {
            doc.setFontSize(8); doc.setTextColor(...C.muted);
            doc.text('[Gagal memuat gambar]', x + imgW/2, y + imgH/2 + 7, { align: 'center' });
          }

          col++;
          if (col >= 2) { col = 0; y += imgH + 14; }
        }
        if (col === 1) y += imgH + 14;
        y += 4;

        const otherFiles = localFiles.filter(f => !f.type || !f.type.startsWith('image/'));
        if (otherFiles.length > 0) {
          if (y > PH - 40) { doc.addPage(); y = MT; }
          drawSectionTitle('Dokumen Lampiran');
          otherFiles.forEach((f, i) => {
            doc.setFillColor(...C.bgLight); doc.setDrawColor(...C.border);
            doc.roundedRect(ML, y, CW, 8, 1.5, 1.5, 'FD');
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.slate);
            doc.text(`${i + 1}.  ${f.name}  —  ${(f.size/1024).toFixed(1)} KB`, ML + 4, y + 5.5);
            y += 10;
          });
          y += 4;
        }
      }
    } else {
      doc.setFillColor(254, 242, 242); doc.setDrawColor(254, 202, 202);
      doc.roundedRect(ML, y, CW, 10, 2, 2, 'FD');
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...C.muted);
      doc.text('Tidak ada file foto yang tersimpan secara lokal untuk laporan ini.', ML + 4, y + 6.5);
      y += 14;
    }

    // ─── SECTION: PENGESAHAN ────────────────────────────────
    if (y > PH - 65) { doc.addPage(); y = MT; }
    drawSectionTitle('Pengesahan');

    const sigW = (CW - 8) / 3;
    const sigH = 36;
    const sigLabels   = ['Dibuat Oleh', 'Disetujui Oleh', 'Mengetahui'];
    const sigNames    = [
      evData['Dibuat Oleh']    || '___________________',
      evData['Disetujui Oleh'] || '___________________',
      evData['Mengetahui']     || '___________________',
    ];

    sigLabels.forEach((lbl, i) => {
      const sx = ML + i * (sigW + 4);
      doc.setFillColor(...C.bgLight); doc.setDrawColor(...C.border);
      doc.roundedRect(sx, y, sigW, sigH, 2, 2, 'FD');

      doc.setFillColor(...C.tealLight); doc.setDrawColor(...C.tealBorder);
      doc.roundedRect(sx, y, sigW, 8, 2, 2, 'FD');
      doc.rect(sx, y + 5, sigW, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.teal);
      doc.text(lbl, sx + sigW / 2, y + 5.5, { align: 'center' });

      doc.setDrawColor(...C.border);
      doc.setLineDash([2, 2]);
      doc.line(sx + 6, y + 28, sx + sigW - 6, y + 28);
      doc.setLineDash([]);

      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.slate);
      doc.text(sigNames[i], sx + sigW / 2, y + 33, { align: 'center', maxWidth: sigW - 4 });
    });
    y += sigH + 6;

    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...C.muted);
    doc.text(`Tanggal: ${evData['Tanggal'] || printDate}  |  Departemen: ${evData['Departemen'] || STATE.dept || '—'}`, ML, y);
    y += 6;

    // ─── FOOTER on each page ────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFillColor(...C.bgLight);
      doc.rect(0, PH - 10, PW, 10, 'F');
      doc.setDrawColor(...C.border);
      doc.line(0, PH - 10, PW, PH - 10);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted);
      doc.text('IADL Monokem — Laporan Evidence Hazard', ML, PH - 4.5);
      doc.text(`Halaman ${p} dari ${totalPages}`, PW - MR, PH - 4.5, { align: 'right' });
      doc.text(noHazard, PW / 2, PH - 4.5, { align: 'center' });
    }

    // ─── Save ────────────────────────────────────────────────
    const fname = `Evidence_${noHazard}_${(evData['Tanggal'] || printDate).replace(/\//g,'-')}.pdf`;
    doc.save(fname);
    toast('PDF report berhasil dibuat!', 'success');
  } catch(err) {
    console.error('PDF error:', err);
    toast('Gagal membuat PDF: ' + (err.message || 'Kesalahan tidak diketahui'), 'error');
  } finally {
    hideLoading();
    EV.processing = false;
  }
}