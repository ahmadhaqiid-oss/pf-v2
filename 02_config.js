/**
 * 02_config.js — Personal Finance System v2.0 (Static PWA)
 * Konfigurasi koneksi, tema, dan formatter.
 * Dimuat pertama setelah index.html (defer), sebelum 03_api.js dan 05_app.js.
 * Semua fungsi bersifat global.
 */

const PF_STORAGE_KEY_ = 'pf2_config_v1';
const PF_THEME_KEY_ = 'pf2_theme';
const PF_TZ_ = 'Asia/Jakarta';
const PF_KEY_MIN_LEN_ = 16;

// ============================================================
// Penyimpanan aman (localStorage bisa diblokir di mode privat)
// ============================================================
function pfStorageGet_(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function pfStorageSet_(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

function pfStorageRemove_(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (e) { /* abaikan */ }
}

// ============================================================
// Konfigurasi koneksi
// ============================================================

/** Mengembalikan { url, key } dari localStorage, atau null jika belum diset. */
function getConfig() {
  const raw = pfStorageGet_(PF_STORAGE_KEY_);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || !obj.url || !obj.key) return null;
    return { url: String(obj.url), key: String(obj.key) };
  } catch (e) {
    return null;
  }
}

function isConfigured() {
  return getConfig() !== null;
}

/** Memvalidasi lalu menyimpan konfigurasi. Melempar Error jika tidak valid. */
function saveConfig(url, key) {
  const u = String(url || '').trim();
  const k = String(key || '').trim();
  validateConfig_(u, k);
  const ok = pfStorageSet_(PF_STORAGE_KEY_, JSON.stringify({ url: u, key: k, savedAt: new Date().toISOString() }));
  if (!ok) throw new Error('Gagal menyimpan konfigurasi. Penyimpanan perangkat mungkin penuh atau diblokir.');
  return true;
}

function clearConfig() {
  pfStorageRemove_(PF_STORAGE_KEY_);
}

function validateConfig_(url, key) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error('URL harus berbentuk https://script.google.com/macros/s/.../exec');
  }
  if (key.length < PF_KEY_MIN_LEN_) {
    throw new Error('API Key terlalu pendek (minimal ' + PF_KEY_MIN_LEN_ + ' karakter).');
  }
}

/** Mengembalikan teks JSON konfigurasi untuk disalin atau dibagikan. */
function exportConfigJson() {
  const cfg = getConfig();
  if (!cfg) throw new Error('Belum ada konfigurasi untuk diekspor.');
  return JSON.stringify({ url: cfg.url, key: cfg.key }, null, 2);
}

/** Mengimpor konfigurasi dari teks JSON yang ditempel pengguna. */
function importConfigJson(text) {
  let obj;
  try {
    obj = JSON.parse(String(text || '').trim());
  } catch (e) {
    throw new Error('Teks bukan JSON yang valid.');
  }
  if (!obj || !obj.url || !obj.key) throw new Error('JSON harus berisi "url" dan "key".');
  saveConfig(obj.url, obj.key);
  return true;
}

// ============================================================
// Tema (terang / gelap / ikuti sistem)
// ============================================================

/** Nilai yang valid: 'light', 'dark', atau 'system'. */
function getThemePref() {
  const v = pfStorageGet_(PF_THEME_KEY_);
  return (v === 'light' || v === 'dark') ? v : 'system';
}

function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'light' || pref === 'dark') {
    root.setAttribute('data-theme', pref);
  } else {
    root.removeAttribute('data-theme');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const gelap = pref === 'dark' ||
      (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    meta.setAttribute('content', gelap ? '#020617' : '#f1f5f9');
  }
}

/** Siklus: system -> light -> dark -> system. Mengembalikan nilai baru. */
function cycleTheme() {
  const urutan = ['system', 'light', 'dark'];
  const next = urutan[(urutan.indexOf(getThemePref()) + 1) % urutan.length];
  pfStorageSet_(PF_THEME_KEY_, next);
  applyTheme(next);
  return next;
}

// ============================================================
// Formatter angka, persen, dan tanggal
// ============================================================

const PF_RP_FMT_ = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

const PF_PCT_FMT_ = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const PF_TGL_FMT_ = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
});

const PF_BULAN_FMT_ = new Intl.DateTimeFormat('id-ID', {
  month: 'long', year: 'numeric', timeZone: 'UTC'
});

/** Rupiah: 521866 -> "Rp 521.866". Null/kosong -> "-". */
function rp(n) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '-';
  return PF_RP_FMT_.format(Number(n));
}

/** Persen: 0.4481 -> "44,8%". Null -> "-". */
function pct(r) {
  if (r === null || r === undefined || isNaN(Number(r))) return '-';
  return PF_PCT_FMT_.format(Number(r));
}

/** Tanggal YYYY-MM-DD -> "20 Nov 2026". Dihitung dalam UTC agar tidak bergeser. */
function fmtTgl(ymd) {
  const d = ymdToDate_(ymd);
  return d ? PF_TGL_FMT_.format(d) : '-';
}

/** Periode YYYY-MM -> "November 2026". */
function fmtPeriode(period) {
  const d = ymdToDate_(String(period || '') + '-01');
  return d ? PF_BULAN_FMT_.format(d) : '-';
}

function ymdToDate_(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

/** Tanggal hari ini di zona Asia/Jakarta, format YYYY-MM-DD. */
function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PF_TZ_, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
}

/** Jam sekarang di Asia/Jakarta, format HH:mm:ss. */
function nowHms() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PF_TZ_, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date());
}

/** Waktu singkat untuk indikator "terakhir sinkron", format HH:mm. */
function nowHm() {
  return nowHms().substring(0, 5);
}

/** Mengubah nilai input number menjadi angka, atau NaN jika kosong/tidak valid. */
function parseAmount(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
}

// Jalankan tema segera agar tidak ada kedipan saat halaman dimuat
applyTheme(getThemePref());
