/**
 * 05_app.js — Personal Finance System v2.0 (Static PWA)
 * Logika utama Alpine.js: state, navigasi, form transaksi/aset/nilai pasar, dan master data.
 * Dimuat setelah 02_config.js, 03_api.js, dan 04_charts.js. Fungsi app() dipanggil dari index.html.
 */

const PF_TX_TYPES_ = [
  { v: 'EXPENSE', l: 'Pengeluaran' },
  { v: 'INCOME', l: 'Pemasukan' },
  { v: 'TRANSFER', l: 'Pindah Akun' },
  { v: 'DEBT_OUT', l: 'Beri Pinjaman' },
  { v: 'DEBT_IN', l: 'Terima Lunasan' },
  { v: 'ADJUSTMENT', l: 'Koreksi' }
];

const PF_GROUP_LABEL_ = { BANK: 'Bank', CASH: 'Tunai', EWALLET: 'E-Wallet', RDN: 'RDN', INVESTMENT: 'Investasi' };

const PF_BOOL_KEYS_ = ['is_active', 'auto_rollover'];

/**
 * Definisi form master data.
 * pk       : nama kolom ID di backend
 * apiEntity: nilai "entity" untuk upsert_master
 * required : kolom wajib saat tambah baru
 * defaults : nilai awal saat tambah baru
 * fields   : kolom yang tampil. options = pilihan dropdown, type = 'number' | 'month' | 'text'
 *            Kolom ID (category_id, account_id) diisi teks biasa, ambil ID dari tab Master.
 */
const PF_MASTER_SPEC_ = {
  accounts: {
    title: 'Akun / Bank', pk: 'account_id', apiEntity: 'accounts',
    required: ['account_name'],
    defaults: { account_group: 'BANK', status: 'ACTIVE', currency: 'IDR' },
    fields: [
      { key: 'account_name', label: 'Nama akun' },
      { key: 'institution', label: 'Bank / platform' },
      { key: 'account_group', label: 'Jenis', options: ['BANK', 'CASH', 'EWALLET', 'RDN', 'INVESTMENT'] },
      { key: 'initial_balance', label: 'Saldo awal (Rp)', type: 'number' },
      { key: 'status', label: 'Status', options: ['ACTIVE', 'ARCHIVED'] },
      { key: 'notes', label: 'Catatan' }
    ]
  },
  categories: {
    title: 'Kategori', pk: 'category_id', apiEntity: 'categories',
    required: ['category_name'],
    defaults: { type: 'EXPENSE', status: 'ACTIVE' },
    fields: [
      { key: 'category_name', label: 'Nama kategori' },
      { key: 'type', label: 'Tipe', options: ['EXPENSE', 'INCOME'] },
      { key: 'parent_id', label: 'ID induk (kosong = kategori utama)' },
      { key: 'aliases', label: 'Kata kunci (pisahkan koma)' },
      { key: 'icon', label: 'Ikon (satu emoji)' },
      { key: 'status', label: 'Status', options: ['ACTIVE', 'ARCHIVED'] }
    ]
  },
  parties: {
    title: 'Kontak Piutang', pk: 'party_id', apiEntity: 'parties',
    required: ['party_name'],
    defaults: { status: 'ACTIVE' },
    fields: [
      { key: 'party_name', label: 'Nama kontak' },
      { key: 'initial_receivable', label: 'Piutang awal (Rp)', type: 'number' },
      { key: 'initial_payable', label: 'Utang awal (Rp)', type: 'number' },
      { key: 'status', label: 'Status', options: ['ACTIVE', 'ARCHIVED'] }
    ]
  },
  goals: {
    title: 'Target / Cicilan', pk: 'item_id', apiEntity: 'goals',
    required: ['name'],
    defaults: { item_type: 'GOAL', status: 'ACTIVE' },
    fields: [
      { key: 'item_type', label: 'Jenis', options: ['GOAL', 'LIABILITY'] },
      { key: 'name', label: 'Nama' },
      { key: 'target_amount', label: 'Target / total pokok (Rp)', type: 'number' },
      { key: 'monthly_amount', label: 'Per bulan (Rp)', type: 'number' },
      { key: 'remaining_months', label: 'Sisa bulan (cicilan)', type: 'number' },
      { key: 'linked_account_ids', label: 'ID akun penghitung (pisahkan koma)' },
      { key: 'status', label: 'Status', options: ['ACTIVE', 'COMPLETED', 'ARCHIVED'] }
    ]
  },
  budgets: {
    title: 'Anggaran', pk: 'budget_id', apiEntity: 'budgets',
    required: ['period', 'category_id', 'budget_amount'],
    defaults: {},
    fields: [
      { key: 'period', label: 'Bulan', type: 'month' },
      { key: 'category_id', label: 'ID kategori (contoh CAT_008)' },
      { key: 'budget_amount', label: 'Nominal anggaran (Rp)', type: 'number' }
    ]
  },
  rules: {
    title: 'Aturan Berulang', pk: 'rule_id', apiEntity: 'rules',
    required: ['rule_name', 'tx_type', 'category_id', 'amount', 'day_of_month'],
    defaults: { tx_type: 'EXPENSE', is_active: 'TRUE' },
    fields: [
      { key: 'rule_name', label: 'Nama aturan' },
      { key: 'tx_type', label: 'Tipe', options: ['EXPENSE', 'INCOME', 'TRANSFER'] },
      { key: 'category_id', label: 'ID kategori' },
      { key: 'amount', label: 'Nominal (Rp)', type: 'number' },
      { key: 'day_of_month', label: 'Tanggal eksekusi (1-31)', type: 'number' },
      { key: 'from_account_id', label: 'ID akun sumber (kosongkan jika tidak ada)' },
      { key: 'to_account_id', label: 'ID akun tujuan (kosongkan jika tidak ada)' },
      { key: 'is_active', label: 'Aktif', options: ['TRUE', 'FALSE'] }
    ]
  }
};

/** Mengubah input angka menjadi number. Input type="number" memakai titik sebagai desimal. */
function toNumber_(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  return Number(String(v).replace(/\s/g, '').replace(',', '.'));
}

function freshTx_() {
  return {
    request_id: pfUuid(),
    tx_type: 'EXPENSE',
    amount: '',
    tx_date: todayYmd(),
    tx_time: nowHms(),
    category_id: '',
    from_account_id: '',
    to_account_id: '',
    notes: ''
  };
}

function freshAsset_() {
  return {
    asset_class: 'DEPOSITO',
    asset_name: '',
    institution: '',
    source_account_id: '',
    linked_account_id: '',
    payout_account_id: '',
    principal_amount: '',
    yield_pct: '',
    tax_pct: '',
    start_date: todayYmd(),
    maturity_date: '',
    payout_day: '',
    auto_rollover: false
  };
}

function app() {
  return {
    view: 'dashboard',
    loading: false,
    syncedAt: '-',
    data: null,
    showArchived: false,
    toast: { show: false, type: 'ok', text: '' },
    _toastTimer: null,
    modal: null,
    configText: '',
    setupForm: { url: '', key: '' },
    txTypes: PF_TX_TYPES_,
    txForm: freshTx_(),
    valForm: { asset_id: '', asset_name: '', val_date: '', current_value: '', yield_received: '', notes: '' },
    assetForm: freshAsset_(),
    masterType: null,
    masterId: '',
    masterForm: {},
    histFilter: { month: '', q: '' },
    history: { items: null, total: 0, has_more: false, summary: null, page: 0 },

    // ==================== Siklus hidup ====================

    init() {
      const cfg = getConfig();
      this.setupForm = { url: cfg ? cfg.url : '', key: cfg ? cfg.key : '' };
      this.histFilter.month = todayYmd().substring(0, 7);
      this.$watch('view', (v) => { if (v === 'analitik') this.drawCharts(); });
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline tidak wajib */ });
      }
      if (isConfigured()) this.loadBootstrap(true);
    },

    showSetup() {
      return !isConfigured() || this.view === 'setup';
    },

    msg(text, type) {
      this.toast = { show: true, type: type || 'ok', text: text };
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toast.show = false; }, 2800);
    },

    drawCharts() {
      this.$nextTick(() => {
        if (typeof renderCharts === 'function' && this.data) renderCharts(this.data);
      });
    },

    // ==================== Koneksi & sinkronisasi ====================

    async saveSetup() {
      try {
        saveConfig(this.setupForm.url, this.setupForm.key);
      } catch (e) {
        return this.msg(e.message, 'error');
      }
      try {
        await apiPing();
        this.view = 'dashboard';
        this.msg('Koneksi berhasil.');
        await this.loadBootstrap(true);
      } catch (e) {
        clearConfig();
        this.msg(e.message, 'error');
      }
    },

    async loadBootstrap(silent) {
      if (!isConfigured()) return;
      this.loading = true;
      try {
        this.data = await apiBootstrap();
        this.syncedAt = nowHm();
        if (!silent) this.msg('Data disinkronkan.');
        if (this.view === 'analitik') this.drawCharts();
      } catch (e) {
        this.msg(e.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    go(v) {
      this.view = v;
      if (v === 'akun' && this.history.items === null) this.loadHistory(true);
      if (v !== 'setup' && !this.data && isConfigured()) this.loadBootstrap(true);
    },

    async loadHistory(reset) {
      if (!isConfigured()) return;
      if (reset) {
        this.history = { items: null, total: 0, has_more: false, summary: null, page: 0 };
      }
      const halaman = this.history.page + 1;
      this.loading = true;
      try {
        const r = await apiTransactions({
          month: this.histFilter.month,
          q: this.histFilter.q,
          page: halaman,
          page_size: 50
        });
        this.history = {
          items: (this.history.items || []).concat(r.items),
          total: r.total,
          has_more: r.has_more,
          summary: r.summary,
          page: halaman
        };
      } catch (e) {
        this.msg(e.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    toggleTheme() {
      const t = cycleTheme();
      const label = { system: 'ikuti sistem', light: 'terang', dark: 'gelap' };
      this.msg('Tema: ' + label[t]);
    },

    exportConfig() {
      try {
        this.configText = exportConfigJson();
        this.msg('Salin teks di kotak. Teks ini berisi API Key, jangan dibagikan.', 'ok');
      } catch (e) {
        this.msg(e.message, 'error');
      }
    },

    importConfig() {
      try {
        importConfigJson(this.configText);
        const cfg = getConfig();
        this.setupForm = { url: cfg.url, key: cfg.key };
        this.configText = '';
        this.view = 'dashboard';
        this.msg('Konfigurasi diimpor.');
        this.loadBootstrap(true);
      } catch (e) {
        this.msg(e.message, 'error');
      }
    },

    // ==================== Ringkasan & tampilan ====================

    goals() {
      if (!this.data) return [];
      return this.data.goals_liabilities.filter(function (g) {
        return g.item_type === 'GOAL' && g.status === 'ACTIVE';
      });
    },

    accountGroups() {
      if (!this.data) return [];
      const peta = {};
      const urutan = [];
      this.data.accounts.forEach((a) => {
        if (a.status === 'ARCHIVED' && !this.showArchived) return;
        if (!peta[a.account_group]) {
          peta[a.account_group] = [];
          urutan.push(a.account_group);
        }
        peta[a.account_group].push(a);
      });
      return urutan.map(function (k) {
        return { name: PF_GROUP_LABEL_[k] || k, items: peta[k] };
      });
    },

    activeAccounts() {
      if (!this.data) return [];
      return this.data.accounts.filter(function (a) { return a.status === 'ACTIVE'; });
    },

    txLabel(t) {
      const label = {
        EXPENSE: 'Pengeluaran',
        INCOME: 'Pemasukan',
        TRANSFER: 'Pindah akun',
        DEBT_OUT: 'Beri pinjaman',
        DEBT_IN: 'Terima lunasan',
        ADJUSTMENT: 'Koreksi saldo'
      };
      return label[t.tx_type] || t.tx_type;
    },

    txSign(t) {
      if (t.tx_type === 'INCOME') return '+ ';
      if (t.tx_type === 'EXPENSE') return '− ';
      return '';
    },

    txClass(t) {
      if (t.tx_type === 'INCOME') return 'text-emerald-600';
      if (t.tx_type === 'EXPENSE') return 'text-rose-500';
      return 'text-slate-600 dark:text-slate-300';
    },

    // ==================== Form transaksi ====================

    openTx() {
      this.txForm = freshTx_();
      this.modal = 'tx';
    },

    closeModal() {
      this.modal = null;
    },

    setTxType(v) {
      this.txForm.tx_type = v;
      this.txForm.category_id = '';
      this.txForm.from_account_id = '';
      this.txForm.to_account_id = '';
    },

    needsCategory() {
      return ['EXPENSE', 'INCOME', 'DEBT_OUT', 'DEBT_IN'].indexOf(this.txForm.tx_type) >= 0;
    },

    needsFrom() {
      return ['EXPENSE', 'TRANSFER', 'DEBT_OUT', 'ADJUSTMENT'].indexOf(this.txForm.tx_type) >= 0;
    },

    needsTo() {
      return ['INCOME', 'TRANSFER', 'DEBT_IN', 'ADJUSTMENT'].indexOf(this.txForm.tx_type) >= 0;
    },

    /** Pilihan kategori (sesuai tipe) atau kontak untuk transaksi utang/piutang. */
    txCategoryOptions() {
      if (!this.data) return [];
      const t = this.txForm.tx_type;
      if (t === 'DEBT_OUT' || t === 'DEBT_IN') {
        return this.data.parties
          .filter(function (p) { return p.status === 'ACTIVE'; })
          .map(function (p) { return { id: p.party_id, label: p.party_name }; });
      }
      const tipe = t === 'INCOME' ? 'INCOME' : 'EXPENSE';
      const datar = [];
      (this.data.categories || []).forEach(function (c) {
        datar.push(c);
        (c.children || []).forEach(function (s) { datar.push(s); });
      });
      return datar
        .filter(function (c) { return c.status === 'ACTIVE' && c.type === tipe; })
        .map(function (c) {
          const awalan = c.parent_id ? '    ↳ ' : ((c.icon || '') + ' ');
          return { id: c.category_id, label: awalan + c.category_name };
        });
    },

    async submitTx() {
      const f = this.txForm;
      const amount = toNumber_(f.amount);
      if (!(amount > 0)) return this.msg('Nominal harus lebih dari 0.', 'error');
      if (!f.tx_date) return this.msg('Tanggal wajib diisi.', 'error');
      if (this.needsCategory() && !f.category_id) return this.msg('Pilih kategori atau kontak.', 'error');
      if (this.needsFrom() && !f.from_account_id) return this.msg('Pilih akun asal.', 'error');
      if (this.needsTo() && !f.to_account_id) return this.msg('Pilih akun tujuan.', 'error');
      if (f.tx_type === 'TRANSFER' && f.from_account_id === f.to_account_id) {
        return this.msg('Akun asal dan tujuan harus berbeda.', 'error');
      }

      this.loading = true;
      try {
        const r = await apiRecordTx({
          request_id: f.request_id,
          tx_date: f.tx_date,
          tx_time: f.tx_time || nowHms(),
          tx_type: f.tx_type,
          amount: amount,
          category_id: f.category_id,
          from_account_id: f.from_account_id,
          to_account_id: f.to_account_id,
          notes: f.notes,
          source: 'WEB_APP'
        });
        this.msg(r.status === 'duplicate_ignored' ? 'Transaksi ini sudah tercatat sebelumnya.' : 'Transaksi tersimpan.');
        this.closeModal();
        await this.loadBootstrap(true);
      } catch (e) {
        this.msg(e.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    // ==================== Aset & nilai pasar ====================

    openAsset() {
      this.assetForm = freshAsset_();
      this.modal = 'asset';
    },

    /**
     * Membuka deposito/aset baru: mencatat TRANSFER dari akun sumber ke akun penampung
     * sekaligus membuat baris ASSETS_PORTFOLIO (lewat record_tx dengan new_asset).
     */
    async submitAsset() {
      const f = this.assetForm;
      const pokok = toNumber_(f.principal_amount);
      if (!(pokok > 0)) return this.msg('Pokok harus lebih dari 0.', 'error');
      if (!f.asset_name.trim()) return this.msg('Nama aset wajib diisi.', 'error');
      if (!f.source_account_id) return this.msg('Pilih akun sumber dana.', 'error');
      if (!f.linked_account_id || !f.payout_account_id) return this.msg('Pilih akun penampung dan akun pencairan.', 'error');
      if (f.source_account_id === f.linked_account_id) return this.msg('Akun sumber dan akun penampung harus berbeda.', 'error');

      const pajakDefault = f.asset_class === 'DEPOSITO' ? 20 : (f.asset_class === 'SBN' ? 10 : 0);
      const bunga = toNumber_(f.yield_pct);
      const pajak = f.tax_pct === '' ? pajakDefault : toNumber_(f.tax_pct);

      const data = {
        asset_class: f.asset_class,
        asset_name: f.asset_name.trim(),
        institution: f.institution.trim(),
        linked_account_id: f.linked_account_id,
        payout_account_id: f.payout_account_id,
        principal_amount: pokok,
        units: 1,
        yield_rate_pa: (isNaN(bunga) ? 0 : bunga) / 100,
        tax_rate: (isNaN(pajak) ? 0 : pajak) / 100,
        start_date: f.start_date || todayYmd(),
        maturity_date: f.maturity_date || '',
        payout_day: f.payout_day === '' ? '' : toNumber_(f.payout_day),
        auto_rollover: !!f.auto_rollover,
        status: 'ACTIVE'
      };

      this.loading = true;
      try {
        await apiRecordTx({
          request_id: pfUuid(),
          tx_date: data.start_date,
          tx_time: nowHms(),
          tx_type: 'TRANSFER',
          amount: pokok,
          category_id: '',
          from_account_id: f.source_account_id,
          to_account_id: f.linked_account_id,
          notes: 'Buka ' + data.asset_name,
          source: 'WEB_APP',
          new_asset: data
        });
        this.msg('Aset dibuka dan dana sudah dipindahkan.');
        this.closeModal();
        await this.loadBootstrap(true);
      } catch (e) {
        this.msg(e.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    openValuation(a) {
      this.valForm = {
        asset_id: a.asset_id,
        asset_name: a.asset_name,
        val_date: todayYmd(),
        current_value: a.latest_valuation ? a.latest_valuation.current_value : '',
        yield_received: '',
        notes: ''
      };
      this.modal = 'valuation';
    },

    async submitValuation() {
      const f = this.valForm;
      const nilai = toNumber_(f.current_value);
      if (!(nilai >= 0)) return this.msg('Nilai pasar harus berupa angka.', 'error');
      const bunga = toNumber_(f.yield_received);
      this.loading = true;
      try {
        await apiUpsertMaster('valuations', '', {
          asset_id: f.asset_id,
          val_date: f.val_date || todayYmd(),
          current_value: nilai,
          yield_received: isNaN(bunga) ? 0 : bunga,
          notes: f.notes
        });
        this.msg('Nilai pasar tersimpan.');
        this.closeModal();
        await this.loadBootstrap(true);
      } catch (e) {
        this.msg(e.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    // ==================== Master data ====================

    openMaster(type, rec) {
      const spec = PF_MASTER_SPEC_[type];
      if (!spec) return;
      const form = {};
      spec.fields.forEach(function (f) {
        let nilai = '';
        if (rec && rec[f.key] !== undefined && rec[f.key] !== null) nilai = String(rec[f.key]);
        else if (!rec && spec.defaults[f.key] !== undefined) nilai = String(spec.defaults[f.key]);
        form[f.key] = nilai;
      });
      this.masterType = type;
      this.masterId = rec ? rec[spec.pk] : '';
      this.masterForm = form;
      this.modal = 'master';
    },

    masterTitle() {
      const spec = PF_MASTER_SPEC_[this.masterType];
      if (!spec) return '';
      return spec.title + (this.masterId ? ' — ubah ' + this.masterId : ' — baru');
    },

    masterFields() {
      const spec = PF_MASTER_SPEC_[this.masterType];
      return spec ? spec.fields : [];
    },

    async submitMaster() {
      const spec = PF_MASTER_SPEC_[this.masterType];
      if (!spec) return;
      const isBaru = !this.masterId;

      // Kolom yang dikosongkan saat ubah tidak ikut dikirim, sehingga nilai lama tidak tertimpa
      const data = {};
      for (let i = 0; i < spec.fields.length; i++) {
        const f = spec.fields[i];
        const raw = this.masterForm[f.key];
        if (raw === undefined || raw === null || String(raw).trim() === '') continue;
        if (f.type === 'number') {
          const n = toNumber_(raw);
          if (isNaN(n)) return this.msg('Isi "' + f.label + '" dengan angka.', 'error');
          data[f.key] = n;
        } else if (PF_BOOL_KEYS_.indexOf(f.key) >= 0) {
          data[f.key] = String(raw).toUpperCase() === 'TRUE';
        } else {
          data[f.key] = String(raw).trim();
        }
      }

      let kirim = data;
      if (isBaru) {
        kirim = Object.assign({}, spec.defaults, data);
        if (this.masterType === 'rules') kirim.is_active = kirim.is_active === true || kirim.is_active === 'TRUE';
        for (let i = 0; i < spec.required.length; i++) {
          const k = spec.required[i];
          if (kirim[k] === undefined || String(kirim[k]).trim() === '') {
            return this.msg('Kolom "' + k + '" wajib diisi.', 'error');
          }
        }
      }

      this.loading = true;
      try {
        await apiUpsertMaster(spec.apiEntity, this.masterId, kirim);
        this.msg(isBaru ? 'Data baru tersimpan.' : 'Perubahan tersimpan.');
        this.closeModal();
        await this.loadBootstrap(true);
      } catch (e) {
        this.msg(e.message, 'error');
      } finally {
        this.loading = false;
      }
    }
  };
}
