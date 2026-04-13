// ============================================================
// hints.js — Tooltip Hint Definitions
// ============================================================

const HINTS = {
  no_hazard: {
    icon: 'bi-hash',
    title: 'Nomor Hazard (Auto)',
    body: `<p class="ht-desc">Nomor unik identifikasi hazard yang digenerate otomatis oleh sistem berdasarkan data terakhir di database. Format: <strong style="color:var(--clr-accent)">IADL####</strong></p>
    <div class="ht-example"><strong>Contoh:</strong> IADL0001, IADL0042, IADL0100</div>`
  },
  aktifitas: {
    icon: 'bi-activity',
    title: 'Aktifitas',
    body: `<p class="ht-desc">Tuliskan nama aktifitas atau kegiatan operasional yang menjadi sumber potensi hazard lingkungan.</p>
    <div class="ht-example"><strong>Contoh:</strong><br>• Pengisian bahan bakar genset<br>• Pengelasan logam di area terbuka<br>• Penyimpanan limbah B3 sementara</div>`
  },
  lokasi: {
    icon: 'bi-geo-alt',
    title: 'Lokasi',
    body: `<p class="ht-desc">Lokasi spesifik di mana aktifitas tersebut dilakukan. Sertakan nama area, gedung, atau lantai agar mudah diidentifikasi.</p>
    <div class="ht-example"><strong>Contoh:</strong><br>• Area Gudang B, Lantai 2<br>• Workshop Fabrikasi — Zona C<br>• TPS Limbah B3 — Belakang Pabrik</div>`
  },
  kondisi: {
    icon: 'bi-sliders',
    title: 'Kondisi Operasi',
    body: `<p class="ht-desc">Kondisi operasi saat aspek dampak lingkungan dapat terjadi.</p>
    <div class="ht-options">
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(34,197,94,0.15);color:#4ade80">N</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Normal</span>Operasi rutin dalam kondisi standar, semua sistem berfungsi normal.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(245,158,11,0.15);color:#fbbf24">Ab</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Abnormal</span>Start-up, shutdown, maintenance, atau parameter di luar normal.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(239,68,68,0.15);color:#f87171">Em</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Emergency</span>Darurat: kebakaran, tumpahan B3, membutuhkan evakuasi.</div></div>
    </div>`
  },
  klasifikasi: {
    icon: 'bi-layers',
    title: 'Klasifikasi Dampak',
    body: `<p class="ht-desc">Klasifikasi tingkat keparahan dampak lingkungan berdasarkan sifat dan luasannya.</p>
    <div class="ht-options">
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(239,68,68,0.15);color:#f87171">Ex</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Ekstrim</span>Dampak sangat luas, parah, sulit dipulihkan. Aktifitas harus dihentikan.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(245,158,11,0.15);color:#fbbf24">Ti</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Tinggi</span>Berpotensi mencemari lingkungan signifikan. Pengendalian serius diperlukan.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(59,130,246,0.15);color:#60a5fa">Se</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Sedang</span>Dampak terbatas, dapat dipulihkan. Pengendalian rutin memadai.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(34,197,94,0.15);color:#4ade80">Re</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Rendah</span>Dampak minimal, dikelola dengan prosedur standar.</div></div>
    </div>`
  },
  desc_hazard: {
    icon: 'bi-exclamation-triangle',
    title: 'Deskripsi Aspek Hazard',
    body: `<p class="ht-desc">Uraikan secara spesifik kondisi atau tindakan yang berpotensi menimbulkan dampak lingkungan. Fokus pada sumber hazard-nya.</p>
    <div class="ht-example"><strong>Contoh:</strong><br>• "Kebocoran tangki BBM solar akibat sambungan pipa yang aus"<br>• "Gas buang genset mengandung NOx dan SOx berlebih saat start-up"</div>`
  },
  dampak_desc: {
    icon: 'bi-wind',
    title: 'Dampak Lingkungan',
    body: `<p class="ht-desc">Uraikan dampak negatif terhadap lingkungan (tanah, air, udara, ekosistem) yang mungkin terjadi jika hazard terealisasi.</p>
    <div class="ht-example"><strong>Contoh:</strong><br>• "Kontaminasi tanah dan air tanah oleh tumpahan BBM"<br>• "Polusi udara dan gangguan pernapasan warga sekitar"</div>`
  },
  probabilitas: {
    icon: 'bi-bar-chart',
    title: 'Nilai Probabilitas (1–6)',
    body: `<p class="ht-desc">Seberapa sering hazard ini diperkirakan terjadi.</p>
    <table class="ht-table">
      <thead><tr><th>Skor</th><th>Level</th><th>Frekuensi</th></tr></thead>
      <tbody>
        <tr><td class="score-cell">1</td><td style="color:#4ade80;font-weight:600">Sangat Jarang</td><td>&lt; 1× per 10 tahun</td></tr>
        <tr><td class="score-cell">2</td><td style="color:#86efac;font-weight:600">Jarang</td><td>~1× per 5–10 tahun</td></tr>
        <tr><td class="score-cell">3</td><td style="color:#fde68a;font-weight:600">Kadang-kadang</td><td>~1× per 1–5 tahun</td></tr>
        <tr><td class="score-cell">4</td><td style="color:#fbbf24;font-weight:600">Sering</td><td>~1× per bulan–tahun</td></tr>
        <tr><td class="score-cell">5</td><td style="color:#fb923c;font-weight:600">Sangat Sering</td><td>~1× per minggu–bulan</td></tr>
        <tr><td class="score-cell">6</td><td style="color:#f87171;font-weight:600">Hampir Pasti</td><td>Harian / rutin</td></tr>
      </tbody>
    </table>`
  },
  nilai_dampak: {
    icon: 'bi-graph-up-arrow',
    title: 'Nilai Dampak (1–5)',
    body: `<p class="ht-desc">Tingkat keparahan dampak jika hazard terjadi.</p>
    <table class="ht-table">
      <thead><tr><th>Skor</th><th>Tingkat</th><th>Keterangan</th></tr></thead>
      <tbody>
        <tr><td class="score-cell">1</td><td style="color:#4ade80;font-weight:600">Tidak Signifikan</td><td>Dampak sangat kecil, lokal, pulih sendiri dalam jam.</td></tr>
        <tr><td class="score-cell">2</td><td style="color:#86efac;font-weight:600">Minor</td><td>Ditangani tim internal. Pemulihan &lt; 1 minggu.</td></tr>
        <tr><td class="score-cell">3</td><td style="color:#fbbf24;font-weight:600">Sedang</td><td>Tindakan segera. Pemulihan 1–4 minggu.</td></tr>
        <tr><td class="score-cell">4</td><td style="color:#fb923c;font-weight:600">Mayor</td><td>Bantuan eksternal. Pemulihan &gt; 1 bulan.</td></tr>
        <tr><td class="score-cell">5</td><td style="color:#f87171;font-weight:600">Katastrofik</td><td>Kerusakan permanen. Sanksi hukum berat.</td></tr>
      </tbody>
    </table>`
  },
  pxd: {
    icon: 'bi-calculator',
    title: 'PxD — Probabilitas × Dampak',
    body: `<p class="ht-desc">Nilai risiko awal dihitung otomatis dari perkalian Probabilitas dan Dampak.</p>
    <code class="ht-formula">PxD = Probabilitas × Dampak</code>
    <p class="ht-desc">Contoh: Prob = 3, Dampak = 4 → PxD = <strong style="color:var(--clr-accent)">12 (High)</strong></p>`
  },
  pxd_akhir: {
    icon: 'bi-calculator-fill',
    title: 'PxD Akhir — Setelah Pengendalian',
    body: `<p class="ht-desc">Nilai risiko setelah pengendalian diterapkan. Harus lebih rendah dari PxD Awal.</p>
    <code class="ht-formula">PxD Akhir = Prob. Akhir × Dampak Akhir</code>
    <div class="ht-example"><strong>Target ideal:</strong> PxD Akhir &lt; PxD Awal. Jika sama atau lebih tinggi, tinjau efektivitas pengendalian.</div>`
  },
  risk_level: {
    icon: 'bi-shield-half',
    title: 'Level Risiko Otomatis',
    body: `<p class="ht-desc">Level risiko ditentukan otomatis berdasarkan nilai PxD.</p>
    <div class="risk-matrix">
      <div class="rm-cell risk-low">1–5<br>LOW</div>
      <div class="rm-cell risk-medium">6–10<br>MED</div>
      <div class="rm-cell risk-high">11–15<br>HIGH</div>
      <div class="rm-cell risk-extreme">≥16<br>EXT</div>
    </div>`
  },
  pengendalian: {
    icon: 'bi-shield-check',
    title: 'Hirarki Pengendalian Risiko',
    body: `<p class="ht-desc">Pilih metode sesuai <strong>Hierarki Pengendalian HIRARC</strong> (urutan paling → paling kurang efektif):</p>
    <div class="ht-options">
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(34,197,94,0.15);color:#4ade80;font-size:10px;font-weight:800">1</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Eliminasi</span>Hilangkan sumber bahaya sepenuhnya.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(163,230,53,0.12);color:#86efac;font-size:10px;font-weight:800">2</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Substitusi</span>Ganti bahan/proses dengan yang lebih aman.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(245,158,11,0.12);color:#fbbf24;font-size:10px;font-weight:800">3</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Rekayasa Teknik</span>Modifikasi fisik/teknis untuk mengisolasi hazard.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(0,153,255,0.12);color:#60a5fa;font-size:10px;font-weight:800">4</div>
        <div class="ht-opt-text"><span class="ht-opt-name">Administrasi</span>SOP, pelatihan, rotasi kerja.</div></div>
      <div class="ht-option"><div class="ht-opt-badge" style="background:rgba(239,68,68,0.12);color:#f87171;font-size:10px;font-weight:800">5</div>
        <div class="ht-opt-text"><span class="ht-opt-name">APD</span>Pilihan TERAKHIR. Hanya melindungi individu.</div></div>
    </div>`
  },
  desc_pengendalian: {
    icon: 'bi-card-text',
    title: 'Deskripsi Pengendalian',
    body: `<p class="ht-desc">Uraikan langkah-langkah konkret pengendalian. Sertakan detail teknis, PIC, dan timeline.</p>
    <div class="ht-example"><strong>Contoh deskripsi yang baik:</strong><br>
    "Pemasangan drip tray kapasitas 110% di bawah tangki solar, dilengkapi sensor level dan alarm otomatis. PIC: Tim Teknik. Target: 30 hari."</div>`
  },
  ctrl_prob: {
    icon: 'bi-bar-chart-steps',
    title: 'Probabilitas Setelah Kendali',
    body: `<p class="ht-desc">Nilai probabilitas yang diperkirakan <strong>setelah</strong> pengendalian diterapkan. Harus ≤ nilai probabilitas awal.</p>
    <div class="ht-example"><strong>Panduan:</strong> Jika awalnya prob = 4, dan setelah alat deteksi otomatis dipasang kemungkinan turun drastis → isi 1 atau 2.<br><span style="color:var(--clr-red)">⚠ Jangan isi nilai lebih tinggi dari probabilitas awal.</span></div>`
  },
  ctrl_dampak: {
    icon: 'bi-graph-down-arrow',
    title: 'Dampak Setelah Kendali',
    body: `<p class="ht-desc">Nilai dampak yang diperkirakan <strong>setelah</strong> pengendalian diterapkan.</p>
    <div class="ht-example"><strong>Panduan:</strong> Jika dampak awal = 5, dan secondary containment membatasi ceceran → isi 2 atau 3.<br>Nilai dampak biasanya lebih sulit diturunkan dibanding probabilitas.</div>`
  }
};
