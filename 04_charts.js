/**
 * 04_charts.js — Personal Finance System v2.0 (Static PWA)
 * Rendering grafik Chart.js untuk tab Analitik:
 *   - chartTrend   : tren arus kas 12 bulan (masuk vs keluar)
 *   - chartBudget  : budget vs realisasi per kategori (bulan berjalan)
 *   - chartAlloc   : alokasi aset berdasarkan nilai pokok
 * Dipanggil dari 05_app.js lewat renderCharts(data).
 */

const PF_CHART_COLORS_ = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4', '#8b5cf6', '#84cc16', '#ec4899'];
const PF_CHARTS_ = {};

/** Warna teks dan garis mengikuti tema aktif. */
function chartTheme_() {
  const attr = document.documentElement.getAttribute('data-theme');
  const gelap = attr === 'dark' ||
    (!attr && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return { teks: gelap ? '#cbd5e1' : '#475569', garis: gelap ? '#1e293b' : '#e2e8f0' };
}

function hancurkanChart_(kunci) {
  if (PF_CHARTS_[kunci]) {
    PF_CHARTS_[kunci].destroy();
    delete PF_CHARTS_[kunci];
  }
}

/** Format singkat sumbu: 1500000 -> "Rp1,5 jt", 20000 -> "Rp20 rb". */
function singkatRp_(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return 'Rp' + (v / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
  if (Math.abs(v) >= 1000) return 'Rp' + Math.round(v / 1000).toLocaleString('id-ID') + ' rb';
  return 'Rp' + v;
}

/** Nama kategori dari daftar tree (induk dan subkategori). */
function mapNamaKategori_(categories) {
  const peta = {};
  (categories || []).forEach(function (c) {
    peta[c.category_id] = c.category_name;
    (c.children || []).forEach(function (s) { peta[s.category_id] = s.category_name; });
  });
  return peta;
}

/** Entry point. Dipanggil setiap data baru dimuat dan saat tab Analitik dibuka. */
function renderCharts(data) {
  if (typeof Chart === 'undefined' || !data) return;
  gambarTren_(data);
  gambarBudget_(data);
  gambarAlokasi_(data);
}

function gambarTren_(data) {
  const kanvas = document.getElementById('chartTrend');
  hancurkanChart_('trend');
  if (!kanvas) return;
  const t = chartTheme_();
  const tren = data.cashflow_trend || [];

  PF_CHARTS_.trend = new Chart(kanvas, {
    type: 'bar',
    data: {
      labels: tren.map(function (x) { return x.period.substring(5) + '/' + x.period.substring(2, 4); }),
      datasets: [
        { label: 'Masuk', data: tren.map(function (x) { return x.income; }), backgroundColor: '#10b981', borderRadius: 4 },
        { label: 'Keluar', data: tren.map(function (x) { return x.expense; }), backgroundColor: '#f43f5e', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: t.teks } } },
      scales: {
        x: { ticks: { color: t.teks }, grid: { color: t.garis } },
        y: { ticks: { color: t.teks, callback: singkatRp_ }, grid: { color: t.garis } }
      }
    }
  });
}

function gambarBudget_(data) {
  const kanvas = document.getElementById('chartBudget');
  hancurkanChart_('budget');
  if (!kanvas) return;
  const daftar = data.budgets || [];
  if (!daftar.length) return;
  const t = chartTheme_();
  const nama = mapNamaKategori_(data.categories);

  PF_CHARTS_.budget = new Chart(kanvas, {
    type: 'bar',
    data: {
      labels: daftar.map(function (b) { return nama[b.category_id] || b.category_id; }),
      datasets: [
        { label: 'Anggaran', data: daftar.map(function (b) { return b.budget_amount; }), backgroundColor: '#94a3b8', borderRadius: 4 },
        { label: 'Realisasi', data: daftar.map(function (b) { return b.actual; }), backgroundColor: '#6366f1', borderRadius: 4 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { labels: { color: t.teks } } },
      scales: {
        x: { ticks: { color: t.teks, callback: singkatRp_ }, grid: { color: t.garis } },
        y: { ticks: { color: t.teks }, grid: { color: t.garis } }
      }
    }
  });
}

function gambarAlokasi_(data) {
  const kanvas = document.getElementById('chartAlloc');
  hancurkanChart_('alloc');
  if (!kanvas) return;
  const aset = (data.assets || []).filter(function (a) { return a.status === 'ACTIVE'; });
  if (!aset.length) return;
  const t = chartTheme_();

  PF_CHARTS_.alloc = new Chart(kanvas, {
    type: 'doughnut',
    data: {
      labels: aset.map(function (a) { return a.asset_name; }),
      datasets: [{
        data: aset.map(function (a) { return a.principal_amount; }),
        backgroundColor: aset.map(function (_, i) { return PF_CHART_COLORS_[i % PF_CHART_COLORS_.length]; }),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: t.teks } } }
    }
  });
}
