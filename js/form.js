// ============================================================
// form.js — Form Input, Validation, Risk Calc, Hints
// ============================================================

// ── Risk Calculation ──────────────────────────────────────────
function calcRisk() {
  const p   = Number(document.getElementById('f_prob').value);
  const d   = Number(document.getElementById('f_dampakVal').value);
  const pxd = (p && d) ? p * d : '';
  document.getElementById('f_pxdAwal').value        = pxd || '';
  const level = pxd ? riskLevel(pxd) : '—';
  document.getElementById('f_riskAwal').value       = level;
  document.getElementById('previewRiskAwal').textContent = level;
}

function calcRiskAfter() {
  const p   = Number(document.getElementById('f_ctrlProb').value);
  const d   = Number(document.getElementById('f_ctrlDampak').value);
  const pxd = (p && d) ? p * d : '';
  document.getElementById('f_pxdAkhir').value       = pxd || '';
  const level = pxd ? riskLevel(pxd) : '—';
  document.getElementById('f_riskAkhir').value      = level;
  document.getElementById('previewRiskAkhir').textContent = level;

  // Reduction badge
  const pxdAwal  = Number(document.getElementById('f_pxdAwal').value);
  const badge    = document.getElementById('riskReductionBadge');
  const badgeEl  = document.getElementById('riskReductionText');
  if (pxd && pxdAwal && badge && badgeEl) {
    const delta = pxdAwal - pxd;
    badge.style.display = 'block';
    if (delta > 0) {
      badgeEl.textContent = `↓ Turun ${delta} poin`;
      badgeEl.className   = 'risk-badge risk-low';
    } else if (delta === 0) {
      badgeEl.textContent = '= Tidak berubah';
      badgeEl.className   = 'risk-badge risk-medium';
    } else {
      badgeEl.textContent = `↑ Naik ${Math.abs(delta)} poin`;
      badgeEl.className   = 'risk-badge risk-extreme';
    }
  } else if (badge) badge.style.display = 'none';
}

// ── Form Reset ────────────────────────────────────────────────
function resetForm() {
  document.getElementById('dataForm').reset();
  document.getElementById('f_row').value = '';
  ['f_pxdAwal','f_riskAwal','f_pxdAkhir','f_riskAkhir'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('previewRiskAwal').textContent  = '—';
  document.getElementById('previewRiskAkhir').textContent = '—';
  document.getElementById('btnSubmitLabel').textContent   = 'Simpan Data';
  STATE.editMode = false;

  // Hide all hint panels
  ['kondisi_val','klasifikasi_val','prob_val','dampak_val',
   'pengendalian_val','ctrl_prob_val','ctrl_dampak_val'].forEach(k => {
    const el = document.getElementById(k + '_hint');
    if (el) el.style.display = 'none';
  });
  const badge = document.getElementById('riskReductionBadge');
  if (badge) badge.style.display = 'none';
}

// ── Open Form (new entry) ─────────────────────────────────────
async function openNewForm() {
  resetForm();
  switchTab('form');
  showLoading('Mengambil nomor hazard...');
  try {
    const res = await fetchLastNo();
    document.getElementById('f_noHazard').value = res.ok ? res.next : 'IADL0001';
  } catch { document.getElementById('f_noHazard').value = 'IADL0001'; }
  hideLoading();
  STATE.editMode = false;
  document.getElementById('btnSubmitLabel').textContent = 'Simpan Data';
}

// ── Submit / Update ───────────────────────────────────────────
async function submitForm(e) {
  e.preventDefault();

  const ts   = new Date().toLocaleString('id-ID');
  const data = {
    'TimeStamp':                       ts,
    'Departemen':                      STATE.dept,
    'Aktifitas':                       document.getElementById('f_aktifitas').value,
    'Lokasi':                          document.getElementById('f_lokasi').value,
    'Kondisi':                         document.getElementById('f_kondisi').value,
    'No Hazard':                       document.getElementById('f_noHazard').value,
    'Klasifikasi Resiko':              document.getElementById('f_klasifikasi').value,
    'Deskripsi Hazard':                document.getElementById('f_descHazard').value,
    'Dampak':                          document.getElementById('f_dampak').value,
    'Nilai Probabilitas':              document.getElementById('f_prob').value,
    'Nilai Dampak':                    document.getElementById('f_dampakVal').value,
    'PxD Awal':                        document.getElementById('f_pxdAwal').value,
    'Penilaian Risiko':                document.getElementById('f_riskAwal').value,
    'Pengendalian Risiko':             document.getElementById('f_pengendalian').value,
    'Deskripsi Pengendalian':          document.getElementById('f_descPengendalian').value,
    'Nilai Pengendalian Probabilitas': document.getElementById('f_ctrlProb').value,
    'Nilai Penilaian Dampak':          document.getElementById('f_ctrlDampak').value,
    'PxD Akhir':                       document.getElementById('f_pxdAkhir').value,
    'Risiko Setelah Pengendalian':     document.getElementById('f_riskAkhir').value,
  };

  const rowNum = document.getElementById('f_row').value;
  if (rowNum) data._row = Number(rowNum);

  showLoading(rowNum ? 'Memperbarui data...' : 'Menyimpan data...');
  try {
    const res = await saveRecord(data, !!rowNum);
    if (res.ok) {
      toast(res.msg, 'success');
      resetForm();
      await loadRecords();
      switchTab('data');
    } else {
      toast(res.msg || 'Gagal menyimpan.', 'error');
    }
  } catch (e) {
    toast('Tidak dapat terhubung ke server.', 'error');
  }
  hideLoading();
}

// ── Edit Record (load into form) ──────────────────────────────
function editRecord(idx) {
  const rec = STATE.records[idx];
  if (!rec) return;

  switchTab('form');

  document.getElementById('f_row').value               = rec._row;
  document.getElementById('f_noHazard').value          = rec['No Hazard'] || '';
  document.getElementById('f_aktifitas').value         = rec['Aktifitas'] || '';
  document.getElementById('f_lokasi').value            = rec['Lokasi'] || '';
  document.getElementById('f_descHazard').value        = rec['Deskripsi Hazard'] || '';
  document.getElementById('f_dampak').value            = rec['Dampak'] || '';
  document.getElementById('f_descPengendalian').value  = rec['Deskripsi Pengendalian'] || '';

  const setSelect = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setSelect('f_kondisi',      rec['Kondisi']);
  setSelect('f_klasifikasi',  rec['Klasifikasi Resiko']);
  setSelect('f_prob',         rec['Nilai Probabilitas']);
  setSelect('f_dampakVal',    rec['Nilai Dampak']);
  setSelect('f_pengendalian', rec['Pengendalian Risiko']);
  setSelect('f_ctrlProb',     rec['Nilai Pengendalian Probabilitas']);
  setSelect('f_ctrlDampak',   rec['Nilai Penilaian Dampak']);

  showSelectHint('kondisi_val',      rec['Kondisi'] || '');
  showSelectHint('klasifikasi_val',  rec['Klasifikasi Resiko'] || '');
  showSelectHint('prob_val',         rec['Nilai Probabilitas'] || '');
  showSelectHint('dampak_val',       rec['Nilai Dampak'] || '');
  showSelectHint('pengendalian_val', rec['Pengendalian Risiko'] || '');
  showSelectHint('ctrl_prob_val',    rec['Nilai Pengendalian Probabilitas'] || '');
  showSelectHint('ctrl_dampak_val',  rec['Nilai Penilaian Dampak'] || '');

  calcRisk();
  calcRiskAfter();

  document.getElementById('btnSubmitLabel').textContent = 'Perbarui Data';
  STATE.editMode = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Inline Hint Panels ────────────────────────────────────────
const SELECT_HINTS = {
  kondisi_val: {
    'Normal':    { color: '#4ade80', bg: 'rgba(34,197,94,0.06)',  icon: 'bi-check-circle',   text: 'Operasi berlangsung sesuai prosedur standar. Semua sistem berfungsi dalam batas desain normal.' },
    'Abnormal':  { color: '#fbbf24', bg: 'rgba(245,158,11,0.06)', icon: 'bi-exclamation-circle', text: 'Kondisi di luar normal: start-up, shutdown, perawatan periodik, atau parameter di ambang batas.' },
    'Emergency': { color: '#f87171', bg: 'rgba(239,68,68,0.06)',  icon: 'bi-x-octagon',      text: 'Situasi darurat: kebakaran, ledakan, tumpahan masif B3, atau kondisi yang memerlukan evakuasi segera.' }
  },
  klasifikasi_val: {
    'Ekstrim': { color: '#f87171', bg: 'rgba(239,68,68,0.06)',  icon: 'bi-exclamation-octagon-fill', text: 'Risiko sangat tinggi. Dampak lingkungan bersifat luas, parah, dan sulit dipulihkan. Aktifitas harus dihentikan.' },
    'Tinggi':  { color: '#fbbf24', bg: 'rgba(245,158,11,0.06)', icon: 'bi-exclamation-triangle-fill', text: 'Risiko tinggi. Berpotensi mencemari lingkungan secara signifikan. Pengendalian serius diperlukan.' },
    'Sedang':  { color: '#60a5fa', bg: 'rgba(0,153,255,0.06)',  icon: 'bi-dash-circle-fill', text: 'Risiko sedang. Dampak terbatas dan dapat dipulihkan. Pengendalian rutin sudah mencukupi.' },
    'Rendah':  { color: '#4ade80', bg: 'rgba(34,197,94,0.06)',  icon: 'bi-check-circle-fill', text: 'Risiko rendah. Dampak minimal, dapat dikelola dengan prosedur standar operasi.' }
  },
  prob_val: {
    '1': { color: '#4ade80', bg: 'rgba(34,197,94,0.06)',  icon: 'bi-1-circle', text: 'Sangat Jarang — Belum pernah terjadi. Frekuensi < 1× per 10 tahun.' },
    '2': { color: '#86efac', bg: 'rgba(34,197,94,0.04)',  icon: 'bi-2-circle', text: 'Jarang — Pernah terjadi sekali. ~1× per 5–10 tahun.' },
    '3': { color: '#fde68a', bg: 'rgba(245,158,11,0.05)', icon: 'bi-3-circle', text: 'Kadang-kadang — Dapat terjadi kondisi tertentu. ~1× per 1–5 tahun.' },
    '4': { color: '#fbbf24', bg: 'rgba(245,158,11,0.06)', icon: 'bi-4-circle', text: 'Sering — Sudah terjadi beberapa kali. ~1× per bulan hingga per tahun.' },
    '5': { color: '#fb923c', bg: 'rgba(249,115,22,0.06)', icon: 'bi-5-circle', text: 'Sangat Sering — Terjadi berulang kali. ~1× per minggu hingga per bulan.' },
    '6': { color: '#f87171', bg: 'rgba(239,68,68,0.07)',  icon: 'bi-6-circle', text: 'Hampir Pasti — Hampir dipastikan terjadi. Kejadian harian atau rutin.' }
  },
  dampak_val: {
    '1': { color: '#4ade80', bg: 'rgba(34,197,94,0.06)',  icon: 'bi-1-square', text: 'Tidak Signifikan — Dampak sangat kecil dan lokal. Pulih sendiri dalam hitungan jam.' },
    '2': { color: '#86efac', bg: 'rgba(34,197,94,0.04)',  icon: 'bi-2-square', text: 'Minor — Dampak kecil, penanganan oleh tim internal. Pemulihan < 1 minggu.' },
    '3': { color: '#fde68a', bg: 'rgba(245,158,11,0.05)', icon: 'bi-3-square', text: 'Sedang — Dampak terbatas namun nyata. Pemulihan 1–4 minggu.' },
    '4': { color: '#fb923c', bg: 'rgba(249,115,22,0.06)', icon: 'bi-4-square', text: 'Mayor — Dampak luas, perlu bantuan eksternal. Pemulihan > 1 bulan.' },
    '5': { color: '#f87171', bg: 'rgba(239,68,68,0.07)',  icon: 'bi-5-square', text: 'Katastrofik — Kerusakan permanen dan luas. Sanksi hukum berat, tuntutan pidana.' }
  }
};
SELECT_HINTS.ctrl_prob_val   = SELECT_HINTS.prob_val;
SELECT_HINTS.ctrl_dampak_val = SELECT_HINTS.dampak_val;
SELECT_HINTS.pengendalian_val = {
  'Eliminasi':       { color: '#4ade80', bg: 'rgba(34,197,94,0.06)',  icon: 'bi-slash-circle',            text: 'Menghilangkan sumber bahaya sepenuhnya. Paling efektif. Contoh: berhenti menggunakan bahan kimia berbahaya.' },
  'Substitusi':      { color: '#a3e635', bg: 'rgba(163,230,53,0.06)', icon: 'bi-arrow-left-right',         text: 'Mengganti hazard dengan yang lebih aman. Contoh: ganti pelarut organik dengan water-based.' },
  'Rekayasa Teknik': { color: '#60a5fa', bg: 'rgba(0,153,255,0.06)',  icon: 'bi-tools',                   text: 'Modifikasi teknis fisik. Contoh: secondary containment, scrubber, ventilasi lokal.' },
  'Administrasi':    { color: '#c4b5fd', bg: 'rgba(196,181,253,0.05)',icon: 'bi-file-earmark-text',        text: 'Pengendalian melalui prosedur. Contoh: SOP pengelolaan limbah, jadwal inspeksi, pelatihan K3LH.' },
  'APD':             { color: '#fca5a5', bg: 'rgba(239,68,68,0.05)',  icon: 'bi-shield-fill-exclamation',  text: 'Alat Pelindung Diri — PILIHAN TERAKHIR. Tidak mengurangi hazard, hanya melindungi individu.' }
};

function showSelectHint(key, value) {
  const panel = document.getElementById(key + '_hint');
  if (!panel) return;
  if (!value || !SELECT_HINTS[key] || !SELECT_HINTS[key][value]) {
    panel.style.display = 'none'; return;
  }
  const h = SELECT_HINTS[key][value];
  panel.style.display = 'block';
  panel.style.background  = h.bg;
  panel.style.borderColor = h.color + '44';
  panel.innerHTML = `<div class="hint-panel-inner">
    <div class="hint-panel-title" style="color:${h.color}"><i class="bi ${h.icon}"></i>${value}</div>
    <div style="font-size:12px;color:var(--clr-muted);line-height:1.55">${h.text}</div>
  </div>`;
}
