/**
 * SELF TEST — verifikasi alur RPC end-to-end tanpa Supabase asli.
 * Menyuntikkan mock PostgREST (tabel sheet_rows + sessions) lalu
 * menjalankan skenario: login -> buat SJ -> daftar -> penerimaan
 * eksternal -> kiriman pending -> open eksternal -> cetak PDF.
 *
 * Jalankan: npx tsx server/dev/selftest.ts
 */
import { setSupabaseClientForTests } from '../sheets';
import { handleRpc, RpcError } from '../index';

/* ================= MOCK PostgREST ================= */

type Row = any;

class MockDB {
  tables: Record<string, Row[]> = { sheet_rows: [], sessions: [] };

  from(table: string) {
    return new Query(this, table);
  }

  _run(q: Query): { data: any; error: any } {
    const table = this.tables[q.table];
    let rows = [...(table || [])];

    if (q.method === 'insert') {
      const toAdd = Array.isArray(q.rows) ? q.rows : [q.rows];
      // imitasi auto-increment/pk; cukup push
      for (const r of toAdd) {
        // sessions.pk = token, sheet_rows.pk = (name, ord) — tidak divalidasi ketat di mock
        (table as Row[]).push({ ...r });
      }
      return { data: toAdd, error: null };
    }

    if (q.method === 'delete') {
      const before = table.length;
      const f = q.filters[0];
      const filtered = (table as Row[]).filter((r) => r[f?.field] !== f?.value);
      this.tables[q.table] = filtered;
      return { data: before - filtered.length, error: null };
    }

    // select
    if (q.orderField === 'ord') {
      rows = [...rows].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
    }
    for (const f of q.filters) {
      rows = rows.filter((r) => r[f.field] === f.value);
    }
    if (q.single) {
      return { data: rows[0] || null, error: null };
    }
    return { data: rows, error: null };
  }
}

class Query {
  method = 'select';
  cols = '*';
  orderField = '';
  orderAsc = true;
  filters: Array<{ field: string; value: any }> = [];
  single = false;
  rows: Row[] = [];

  constructor(private db: MockDB, public table: string) {}

  // thenable
  then(onOk?: any, onErr?: any) {
    const result = this.db._run(this);
    return Promise.resolve(result).then(onOk, onErr);
  }
  catch(onErr?: any) {
    return this.then(undefined, onErr);
  }
  finally(onFinally?: any) {
    return this.then(undefined, undefined).finally(onFinally);
  }

  select(cols: string) {
    this.cols = cols;
    return this;
  }
  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }
  eq(field: string, value: any) {
    this.filters.push({ field, value });
    return this;
  }
  insert(rows: Row | Row[]) {
    this.method = 'insert';
    this.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete() {
    this.method = 'delete';
    return this;
  }
  maybeSingle() {
    this.single = true;
    return this;
  }
}

/* ================= SEED ================= */

const seed: Array<[string, number, any[]]> = [
  ['USERS', 0, ['Username', 'Password', 'Cabang', 'Role', 'Nama']],
  ['USERS', 1, ['admin', 'admin123', 'JKT', 'admin', 'Administrator Pusat']],
  ['USERS', 2, ['cabang', 'cabang123', 'BDG', 'cabang', 'Staff Cabang Bandung']],
  ['USERS', 3, ['sly', 'sly123', 'SLY', 'cabang', 'Staff Cabang Sly']],
  ['USERS', 4, ['mlg', 'mlg123', 'MLG', 'cabang', 'Staff Cabang Malang']],
  ['REF_CABANG', 0, ['Kode', 'Nama Cabang']],
  ['REF_CABANG', 1, ['JKT', 'Jakarta (Pusat)']],
  ['REF_CABANG', 2, ['MLG', 'Malang']],
  ['REF_CABANG', 3, ['SUB', 'Surabaya']],
  ['REF_JENIS_BARANG', 0, ['Kode', 'Nama Jenis']],
  ['REF_JENIS_BARANG', 1, ['SVRMB', 'Sparepart Robot Main Board']],
  ['ALAMAT', 0, ['SITE', 'WILAYAH', 'PENGIRIM', 'PIC', 'DEPT', 'ALAMAT', 'KELURAHAN', 'KECAMATAN', 'KOTA', 'TLP']],
  ['ALAMAT', 1, ['JKT', 'DKI Jakarta', 'Bp. Admin Pusat', 'Bp. Admin Pusat', 'Gudang Pusat', 'Jl. Raya Jakarta No. 1', 'Kel. Menteng', 'Kec. Menteng', 'Jakarta Pusat 10310', '021-1234567']],
  ['ALAMAT', 2, ['MLG', 'Jawa Timur', 'Bp. Sujarwo', 'Bp. Maryono', 'Gudang', 'Jl. Magelang Raya No. 1', '', 'Kec. Tidar', 'Magelang 56125', '0271-123456']],
  ['SURAT_JALAN', 0, ['ID', 'No Surat Jalan', 'Tanggal', 'Cabang Asal', 'Cabang Tujuan', 'Kode Jenis Barang', 'Dikirim Via', 'Total Barang', 'Status Kirim Cikupa', 'Dibuat Oleh', 'Waktu Input', 'Perlu Diteruskan', 'Tujuan Akhir', 'Tanggal Kirim Lanjutan', 'No Truk', 'Sopir', 'Status Kirim Pusat', 'Diupdate Oleh', 'Waktu Update']],
  ['DETAIL_SURAT_JALAN', 0, ['ID Detail', 'ID Surat Jalan', 'No', 'No Bukti', 'Deskripsi', 'Qty', 'Satuan', 'Keterangan', 'Status Fisik', 'Diterima Oleh', 'Waktu Diterima']],
  ['PENERIMAAN_SURAT_JALAN', 0, ['ID', 'No Surat Jalan', 'Tanggal', 'Rms', 'No Truk', 'Kurir', 'No Bukti', 'Deskripsi', 'Qty', 'Satuan', 'Keterangan', 'Status Fisik', 'Diterima Oleh', 'Waktu Input']],
  ['DETAIL_PENERIMAAN_SURAT_JALAN', 0, ['ID Detail', 'ID Surat Jalan', 'No', 'No Bukti', 'Deskripsi', 'Qty', 'Satuan', 'Keterangan', 'Status Fisik', 'Diterima Oleh', 'Waktu Diterima', 'Tujuan Site', 'Status Kirim', 'ID SJ Kirim', 'No SJ Kirim']],
];

const db = new MockDB();
for (const [name, ord, row] of seed) {
  db.tables.sheet_rows.push({ name, ord, row });
}

setSupabaseClientForTests(db);

/* ================= ASSERT ================= */

let pass = 0;
let fail = 0;

function assert(cond: boolean, label: string, extra?: any) {
  if (cond) {
    pass++;
    console.log('  PASS  ' + label);
  } else {
    fail++;
    console.log('  FAIL  ' + label, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

async function call(fn: string, args: any[], token: string) {
  return await handleRpc(fn, args, token);
}

/* ================= SKENARIO ================= */

async function main() {
  console.log('\n[SELF TEST] Surat Jalan Vercel — alur dasar\n');

  console.log('1) Login tanpa token (publish)');
  const loginMissing = await call('login', ['admin', 'salah'], '');
  assert(!loginMissing.success, 'password salah ditolak');

  const login = await call('login', ['admin', 'admin123'], '');
  assert(login.success && login.token, 'login admin sukses + token ', login);
  const token = login.token;

  console.log('2) Otorisasi');
  let authErr = '';
  try {
    await call('getDaftarSuratJalan', ['admin', 'JKT'], '');
  } catch (e: any) {
    authErr = e.message;
  }
  assert(/sesi/i.test(authErr), 'tanpa token ditolak', authErr);

  try {
    await call('getDaftarSuratJalan', ['admin', 'JKT'], 'invalid-token');
  } catch (e: any) {
    authErr = e.message;
  }
  assert(/sesi/i.test(authErr), 'token palsu ditolak', authErr);

  console.log('3) Buat Surat Jalan');
  const create = await call(
    'simpanSuratJalan',
    [
      {
        cabangAsal: 'JKT',
        cabangTujuan: 'MLG',
        kodeJenis: 'SVRMB',
        dikirimVia: 'Bp. Sujarwo',
        username: 'admin',
        perluDiteruskan: 'Tidak',
        tujuanAkhir: '',
        details: [
          { noBukti: 'B001', deskripsi: 'ROBOT ARM JOINT MOTOR', qty: 2, satuan: 'EA', keterangan: '' },
          { noBukti: 'B002', deskripsi: 'SENSOR PROXIMITY M12', qty: 10, satuan: 'EA', keterangan: 'produksi' },
        ],
      },
    ],
    token,
  );
  assert(create.success && /SVRMB-MLG\/JKT/.test(create.noSuratJalan || ''), 'simpan sukses: ' + (create.noSuratJalan || ''), create);

  console.log('4) Daftar SJ (admin melihat semua)');
  const list = await call('getDaftarSuratJalan', ['admin', 'JKT'], token);
  assert(Array.isArray(list) && list.length === 1, 'jumlah SJ = 1', list);
  assert(list[0] && list[0].items && list[0].items.length === 2, 'detail 2 item terbawa', list[0]?.items);
  assert(list[0] && list[0].status === 'Menunggu Penerimaan', 'status awal non-transit', list[0]?.status);

  console.log('5) Penerimaan eksternal (RMS KUDUS)');
  const ext = await call(
    'simpanPenerimaanEksternal',
    [
      {
        sumber: 'KUDUS',
        noSurat: 'RMS/KUDUS/2026/08/001',
        noTruk: 'H 1234 XYZ',
        kurir: 'Bp. Budi',
        username: 'admin',
        details: [
          { noBukti: 'K-100', deskripsi: 'MOTOR DC 12V', qty: 4, satuan: 'PCS', tujuanSite: 'MLG' },
        ],
      },
    ],
    token,
  );
  assert(ext.success && ext.id, 'penerimaan eksternal tersimpan', ext);

  console.log('6) Kiriman Pending');
  const pending = await call('getDaftarKirimanPending', ['admin', ''], token);
  assert(Array.isArray(pending) && pending.length === 1, 'ada 1 item pending', pending);
  assert(pending[0] && pending[0].statusKirim === 'Open', 'status Open', pending[0]);
  assert(pending[0] && pending[0].tujuanSite === 'MLG', 'tujuan MLG', pending[0]?.tujuanSite);

  const pendingSlyToken = (await call('login', ['sly', 'sly123'], '')).token;
  const pendingSly = await call('getDaftarKirimanPending', ['cabang', 'SLY'], pendingSlyToken);
  assert(Array.isArray(pendingSly) && pendingSly.length === 0, 'cabang SLY tidak melihat item MLG');

  console.log('7) Open eksternal utk Tujuan (form create)');
  const open = await call('getOpenPenerimaanEksternalUntukTujuan', ['MLG'], token);
  assert(Array.isArray(open) && open.length === 1, '1 item Open utk MLG', open);

  console.log('8) Terima barang tujuan (cabang MLG)');
  const sjId = list[0].id;
  const realDetails = await call('getDetailSuratJalan', [sjId], token);
  const detailId = realDetails[0].idDetail;
  const terima = await call(
    'terimaBarangTujuan',
    [sjId, [{ idDetail: detailId, diterima: true }], 'cabang', 'user', 'BDG'],
    token,
  );
  assert(terima.success === false, 'cabang BDG ditolak utk SJ tujuan MLG', terima);

  // login cabang MLG — user 'cabang' di seed ber-cabang BDG; gunakan cabang BDG sesuai tujuan? SJ ditujukan ke MLG.
  // Untuk simulasi, buat pengguna cabang MLG on the fly.
  db.tables.sheet_rows.push({ name: 'USERS', ord: 3, row: ['mlg', 'mlg123', 'MLG', 'cabang', 'Staff Malang'] });
  db.tables.sheet_rows.push({ name: 'USERS', ord: 4, row: ['sly', 'sly123', 'SLY', 'cabang', 'Staff Sly'] });
  const loginMlg = await call('login', ['mlg', 'mlg123'], '');
  const tokenMlg = loginMlg.token;

  const terimaMlg = await call(
    'terimaBarangTujuan',
    [sjId, [{ idDetail: detailId, diterima: true }], 'cabang', 'staff-mlg', 'MLG'],
    tokenMlg,
  );
  assert(terimaMlg.success === true, 'cabang MLG bisa terima sebagian', terimaMlg);
  assert(terimaMlg.statusHeader === 'Diterima Sebagian', 'status jadi Diterima Sebagian', terimaMlg?.statusHeader);

  // terima sisanya
  const detailId2 = realDetails[1].idDetail;
  const terimaMlg2 = await call(
    'terimaBarangTujuan',
    [sjId, [{ idDetail: detailId2, diterima: true }], 'cabang', 'staff-mlg', 'MLG'],
    tokenMlg,
  );
  assert(terimaMlg2.statusHeader === 'Diterima Tujuan', 'semua diterima -> Diterima Tujuan', terimaMlg2?.statusHeader);

  console.log('9) Kiriman pending setelah diterima');
  const pending2 = await call('getDaftarKirimanPending', ['admin', ''], token);
  assert(pending2.length === 1, 'item eksternal tetap ada (belum dibuat SJ kirim)', pending2);

  // Buat SJ yang menautkan item eksternal Open -> Pending
  console.log('10) Buat SJ dari item eksternal (Open -> Pending)');
  const openItems = await call('getOpenPenerimaanEksternalUntukTujuan', ['MLG'], token);
  const extDetailId = openItems[0].idDetail;
  const create2 = await call(
    'simpanSuratJalan',
    [
      {
        cabangAsal: 'JKT',
        cabangTujuan: 'MLG',
        kodeJenis: 'SVRMB',
        dikirimVia: 'Ekspedisi',
        username: 'admin',
        perluDiteruskan: 'Tidak',
        tujuanAkhir: '',
        details: [{ noBukti: 'K-100', deskripsi: 'MOTOR DC 12V', qty: 4, satuan: 'PCS', keterangan: '' }],
        externalItems: [{ idDetail: extDetailId }],
      },
    ],
    token,
  );
  assert(create2.success, 'SJ bertaut item eksternal', create2);

  const pending3 = await call('getDaftarKirimanPending', ['admin', ''], token);
  assert(pending3.length === 1, 'item eksternal masih terhitung', pending3);
  assert(pending3[0].statusKirim === 'Pending', 'status jadi Pending (ter-taut SJ)', pending3[0]);
  assert(pending3[0].noSJKirim === create2.noSuratJalan, 'no SJ kirim terpasang', pending3[0]?.noSJKirim);

  const open2 = await call('getOpenPenerimaanEksternalUntukTujuan', ['MLG'], token);
  assert(open2.length === 0, 'tidak lagi Open utk MLG', open2);

  console.log('11) Cetak PDF');
  const pdf1 = await call('buatPdfSuratJalan', [sjId, 'Admin'], token);
  assert(pdf1.success && pdf1.base64 && pdf1.base64.length > 200, 'PDF SJ dibuat', pdf1.filename);
  const pdf2 = await call('cetakPenerimaanEksternal', [ext.id], token);
  assert(pdf2.success && pdf2.base64 && pdf2.base64.length > 200, 'PDF Penerimaan Eksternal dibuat', pdf2.filename);

  console.log('\n12) Ganti password');
  const ganti = await call('gantiPassword', [{ username: 'admin', passwordLama: 'admin123', passwordBaru: 'admin456' }], token);
  assert(ganti.success, 'ganti password ok', ganti);

  console.log('\n============================================');
  console.log('HASIL: ' + pass + ' PASS, ' + fail + ' FAIL');
  console.log('============================================\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('SELF TEST CRASH:', e);
  process.exit(1);
});