/**
 * 03_api.js — Personal Finance System v2.0 (Static PWA)
 * Komunikasi ke Google Apps Script Web App (backend 04–07).
 * GET dipakai untuk membaca data. POST memakai Content-Type text/plain
 * agar browser tidak mengirim preflight OPTIONS yang tidak didukung Apps Script.
 * Key dikirim lewat parameter URL (key=...), sesuai pengecekan di 04_ApiRouter.gs.
 * Semua fungsi bersifat global.
 */

/** UUID untuk request_id (anti-duplikasi). Memakai crypto bawaan browser. */
function pfUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}

/**
 * Inti semua panggilan API. Mengembalikan isi "data" dari respons.
 * Melempar Error berisi pesan yang bisa langsung ditampilkan ke pengguna.
 */
async function apiRequest_(method, params, body) {
  const cfg = getConfig();
  if (!cfg) throw new Error('Koneksi belum diatur. Buka Pengaturan dan isi URL Web App serta API Key.');

  const semua = Object.assign({}, params || {}, { key: cfg.key });
  const query = Object.keys(semua)
    .filter(function (k) { return semua[k] !== undefined && semua[k] !== null && semua[k] !== ''; })
    .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(semua[k]); })
    .join('&');
  const url = cfg.url + (cfg.url.indexOf('?') >= 0 ? '&' : '?') + query;

  const opsi = method === 'POST'
    ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body || {}) }
    : { method: 'GET', cache: 'no-store' };

  let res;
  try {
    res = await fetch(url, opsi);
  } catch (e) {
    throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet dan URL Web App.');
  }

  const teks = await res.text();
  let json;
  try {
    json = JSON.parse(teks);
  } catch (e) {
    throw new Error('Respons server tidak valid (HTTP ' + res.status + '). Pastikan Web App sudah di-deploy dengan akses "Siapa saja".');
  }

  if (!json.ok) throw new Error(json.error || 'Terjadi kesalahan di server.');
  return json.data;
}

/** Cek koneksi dan key. */
function apiPing() {
  return apiRequest_('GET', { action: 'ping' });
}

/** Ringkasan lengkap untuk dashboard, akun, portofolio, dan master. */
function apiBootstrap() {
  return apiRequest_('GET', { action: 'bootstrap' });
}

/** Riwayat transaksi terfilter dan berhalaman. f = { month, q, page, page_size }. */
function apiTransactions(f) {
  return apiRequest_('GET', {
    action: 'transactions',
    month: f.month,
    q: f.q,
    page: f.page,
    page_size: f.page_size
  });
}

/** Mencatat transaksi baru. tx harus memuat request_id. */
function apiRecordTx(tx) {
  return apiRequest_('POST', { action: 'record_tx' }, tx);
}

/** Edit atau hapus transaksi. op = 'update' atau 'delete'. changes = objek kolom yang diubah. */
function apiManageTx(txId, op, changes, alasan) {
  return apiRequest_('POST', { action: 'manage_tx' }, {
    tx_id: txId,
    op: op,
    changes: changes || {},
    alasan: alasan || ''
  });
}

/**
 * Tambah atau ubah master data.
 * entity: accounts | categories | assets | goals | parties | budgets | rules | valuations
 * id: kosong untuk tambah baru, isi ID untuk ubah.
 */
function apiUpsertMaster(entity, id, data) {
  return apiRequest_('POST', { action: 'upsert_master' }, {
    entity: entity,
    id: id || '',
    data: data || {}
  });
}
