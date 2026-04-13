// ============================================================
// evidence.js — Evidence Module
// - Form fields: Tanggal, PIC, Catatan, Pengesahan
// - Upload foto → localStorage (base64)
// - Submit metadata → Google Sheets (EVIDENCE sheet via GAS)
// - Generate PDF report (jsPDF + html2canvas)
// ============================================================

// ── State ─────────────────────────────────────────────────────
let EV = {
  files:         [],   // { name, size, type, dataUrl }
  selectedHazard: null,
  storedEvidences: []  // loaded from GAS
};

// ── LocalStorage helpers ──────────────────────────────────────
const LS_KEY = (noHazard) => `iadl_ev_${noHazard}`;

function lsSaveFiles(noHazard, files) {
  try {
    localStorage.setItem(LS_KEY(noHazard), JSON.stringify(files));
  } catch(e) {
    // localStorage quota — strip large files gracefully
    const slim = files.map(f => ({ ...f, dataUrl: f.dataUrl.substring(0, 50000) }));
    try { localStorage.setItem(LS_KEY(noHazard), JSON.stringify(slim)); } catch(_) {}
    toast('Peringatan: beberapa file terlalu besar untuk cache lokal.', 'warning');
  }
}

function lsLoadFiles(noHazard) {
  try {
    const raw = localStorage.getItem(LS_KEY(noHazard));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsDeleteFiles(noHazard) {
  localStorage.removeItem(LS_KEY(noHazard));
}

// ── Populate hazard dropdown ───────────────────────────────────
function populateEvidenceHazardSelect() {
  const sel = document.getElementById('evidenceHazardSelect');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Pilih No Hazard —</option>';
  STATE.records.forEach(r => {
    const o = document.createElement('option');
    o.value = r['No Hazard'];
    o.textContent = `${r['No Hazard']} — ${(r['Aktifitas'] || '').substring(0, 45)}`;
    sel.appendChild(o);
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

  // Restore files from localStorage
  EV.files = lsLoadFiles(val);
  renderFilePreview();

  // Load history from GAS
  loadEvidenceHistory(val);
}

// ── Load history from GAS ──────────────────────────────────────
async function loadEvidenceHistory(noHazard) {
  const historyWrap = document.getElementById('evidenceHistoryWrap');
  const historyBody = document.getElementById('evidenceHistoryBody');
  historyWrap.style.display = 'block';
  historyBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px;color:var(--clr-muted)"><div class="mini-spinner" style="margin:0 auto"></div></td></tr>`;

  try {
    const res = await fetchEvidences(noHazard);
    EV.storedEvidences = res.ok ? res.evidences : [];
    renderEvidenceHistory();
  } catch {
    historyBody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--clr-muted);padding:16px">Tidak dapat memuat riwayat.</td></tr>`;
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
      <td style="font-size:11px;color:var(--clr-muted)">${String(e['TimeStamp']).substring(0,16)}</td>
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
function handleFileSelect(files) {
  const MAX = 10 * 1024 * 1024; // 10MB
  Array.from(files).forEach(f => {
    if (f.size > MAX) { toast(`File "${f.name}" terlalu besar (maks 10MB).`, 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      EV.files.push({ name: f.name, size: f.size, type: f.type, dataUrl: e.target.result });
      if (EV.selectedHazard) lsSaveFiles(EV.selectedHazard, EV.files);
      renderFilePreview();
    };
    reader.readAsDataURL(f);
  });
}

function removeEvidenceFile(idx) {
  EV.files.splice(idx, 1);
  if (EV.selectedHazard) lsSaveFiles(EV.selectedHazard, EV.files);
  renderFilePreview();
}

function renderFilePreview() {
  const list = document.getElementById('evidencePreviewList');
  if (!list) return;
  if (!EV.files.length) { list.innerHTML = ''; return; }

  list.innerHTML = EV.files.map((f, i) => {
    const isImg = f.type.startsWith('image/');
    const thumb = isImg
      ? `<img src="${f.dataUrl}" class="ev-thumb" alt="${f.name}" />`
      : `<div class="ev-thumb ev-thumb-pdf"><i class="bi bi-file-earmark-pdf-fill"></i></div>`;
    return `
      <div class="ev-file-item">
        ${thumb}
        <div class="ev-file-info">
          <span class="ev-file-name">${f.name}</span>
          <span class="ev-file-size">${(f.size/1024).toFixed(1)} KB · ${isImg ? 'Gambar' : 'PDF'}</span>
        </div>
        <button class="ev-remove-btn" onclick="removeEvidenceFile(${i})" title="Hapus">
          <i class="bi bi-x"></i>
        </button>
      </div>`;
  }).join('');
}

// ── Submit Evidence ────────────────────────────────────────────
async function submitEvidence() {
  if (!EV.selectedHazard) { toast('Pilih nomor hazard terlebih dahulu.', 'error'); return; }

  const tanggal      = document.getElementById('evTanggal').value;
  const pic          = document.getElementById('evPIC').value.trim();
  const catatan      = document.getElementById('evCatatan').value.trim();
  const dibuatOleh   = document.getElementById('evDibuatOleh').value.trim();
  const disetujui    = document.getElementById('evDisetujui').value.trim();
  const mengetahui   = document.getElementById('evMengetahui').value.trim();

  if (!tanggal) { toast('Isi Tanggal Evidence terlebih dahulu.', 'error'); return; }
  if (!pic)     { toast('Isi nama PIC terlebih dahulu.', 'error'); return; }

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
      toast(res.msg, 'success');
      // Files already saved to localStorage — no need to re-save
      await loadEvidenceHistory(EV.selectedHazard);
    } else {
      toast(res.msg || 'Gagal menyimpan.', 'error');
    }
  } catch {
    toast('Tidak dapat terhubung ke server.', 'error');
  }
  hideLoading();
}

function clearEvidence() {
  EV.files = [];
  if (EV.selectedHazard) lsSaveFiles(EV.selectedHazard, []);
  document.getElementById('evidenceFileInput').value = '';
  document.getElementById('evCatatan').value   = '';
  document.getElementById('evTanggal').value   = '';
  document.getElementById('evPIC').value       = '';
  document.getElementById('evDibuatOleh').value  = '';
  document.getElementById('evDisetujui').value   = '';
  document.getElementById('evMengetahui').value  = '';
  renderFilePreview();
  toast('Form evidence dikosongkan.', 'success');
}

// ── Drag & Drop init ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('uploadZone');
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFileSelect(e.dataTransfer.files);
  });
  zone.addEventListener('click', e => {
    if (!e.target.closest('button')) document.getElementById('evidenceFileInput').click();
  });
});

// ══════════════════════════════════════════════════════════════
// PDF REPORT GENERATOR
// Uses jsPDF (loaded in index.html)
// ══════════════════════════════════════════════════════════════

async function generatePDFReport(evIdx) {
  // evIdx = index in EV.storedEvidences; if null = use current form values
  let evData, noHazard, localFiles;

  if (typeof evIdx === 'number' && EV.storedEvidences[evIdx]) {
    evData    = EV.storedEvidences[evIdx];
    noHazard  = evData['No Hazard'];
    localFiles = lsLoadFiles(noHazard);
  } else {
    // Generate from current form
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
  showLoading('Membuat PDF report...');

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297;
    const ML = 18, MR = 18, MT = 18;
    const CW = PW - ML - MR; // content width

    // ── Color palette ──
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

    let y = MT; // cursor Y

    // ─── HEADER BANNER ───────────────────────────────────────
    doc.setFillColor(...C.teal);
    doc.rect(0, 0, PW, 36, 'F');

    // Accent stripe
    doc.setFillColor(10, 120, 110);
    doc.rect(0, 32, PW, 4, 'F');

    doc.setTextColor(...C.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('LAPORAN EVIDENCE', ML, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Identifikasi Aspek Dampak Lingkungan & Kendali Risiko — Monokem', ML, 21);

    // Report ID + date top-right
    doc.setFontSize(8);
    const printDate = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    doc.text(`Dicetak: ${printDate}`, PW - MR, 14, { align: 'right' });
    doc.text(`Dept: ${evData['Departemen'] || STATE.dept || '—'}`, PW - MR, 20, { align: 'right' });

    y = 44;

    // ─── SECTION: INFO HAZARD ──────────────────────────────
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
      const maxW = fw - 6;
      doc.text(val, x + 3, row_y + 7, { maxWidth: maxW });
    };

    const drawRiskChip = (level, x, row_y) => {
      const col = riskColor(level);
      doc.setFillColor(col[0], col[1], col[2], 0.1);
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
    // Left accent bar
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
    // Risk badge right
    const rLevel = hazardRec['Penilaian Risiko'] || '';
    drawRiskChip(rLevel, ML + CW - 32, y + 3);
    // PxD
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

    // Deskripsi row
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

    // Risk scores row
    drawField('Prob. Awal',    hazardRec['Nilai Probabilitas'] || '—',              ML,                HW4, y);
    drawField('Dampak Awal',   hazardRec['Nilai Dampak'] || '—',                    ML + HW4+2,        HW4, y);
    drawField('Prob. Akhir',   hazardRec['Nilai Pengendalian Probabilitas'] || '—', ML + (HW4+2)*2,    HW4, y);
    drawField('Dampak Akhir',  hazardRec['Nilai Penilaian Dampak'] || '—',          ML + (HW4+2)*3,    HW4, y);
    y += 13;

    // Pengendalian
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

    // ─── SECTION: EVIDENCE INFO ─────────────────────────────
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
        // New page if not enough space
        if (y > PH - 80) { doc.addPage(); y = MT; }
        drawSectionTitle('Dokumentasi Foto Evidence');

        const imgW = (CW - 4) / 2;
        const imgH = 55;
        let col = 0;

        for (let i = 0; i < imgFiles.length; i++) {
          if (y + imgH + 14 > PH - 30) { doc.addPage(); y = MT; col = 0; }

          const x = col === 0 ? ML : ML + imgW + 4;

          // Image frame
          doc.setFillColor(...C.bgLight); doc.setDrawColor(...C.border);
          doc.roundedRect(x, y, imgW, imgH + 10, 2, 2, 'FD');

          // Caption bar at top
          doc.setFillColor(...C.teal);
          doc.roundedRect(x, y, imgW, 7, 2, 2, 'F');
          doc.rect(x, y + 4, imgW, 3, 'F'); // square bottom corners for top bar
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C.white);
          doc.text(`Foto ${i + 1}: ${imgFiles[i].name.substring(0,35)}`, x + 3, y + 5);

          // Image
          try {
            doc.addImage(imgFiles[i].dataUrl, 'JPEG', x + 2, y + 9, imgW - 4, imgH - 2, undefined, 'MEDIUM');
          } catch(imgErr) {
            doc.setFontSize(8); doc.setTextColor(...C.muted);
            doc.text('[Gagal memuat gambar]', x + imgW/2, y + imgH/2 + 7, { align: 'center' });
          }

          col++;
          if (col >= 2) { col = 0; y += imgH + 14; }
        }
        if (col === 1) y += imgH + 14; // flush last odd image
        y += 4;

        // Non-image files list
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
      // No files notice
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

      // Top label bar
      doc.setFillColor(...C.tealLight); doc.setDrawColor(...C.tealBorder);
      doc.roundedRect(sx, y, sigW, 8, 2, 2, 'FD');
      doc.rect(sx, y + 5, sigW, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.teal);
      doc.text(lbl, sx + sigW / 2, y + 5.5, { align: 'center' });

      // Signature area
      doc.setDrawColor(...C.border);
      doc.setLineDash([2, 2]);
      doc.line(sx + 6, y + 28, sx + sigW - 6, y + 28);
      doc.setLineDash([]);

      // Name
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.slate);
      doc.text(sigNames[i], sx + sigW / 2, y + 33, { align: 'center', maxWidth: sigW - 4 });
    });
    y += sigH + 6;

    // Tanggal pengesahan
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
    toast('Gagal membuat PDF: ' + err.message, 'error');
  }
  hideLoading();
}
