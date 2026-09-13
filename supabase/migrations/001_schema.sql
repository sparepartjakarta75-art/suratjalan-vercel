-- ============================================================
-- Surat Jalan Vercel — Schema + Seed
-- Rasionalisasi: versi Vercel memakai satu tabel NOSQL-ish
-- `sheet_rows` yang meniru Google Sheets (setiap "sheet" asli
-- disimpan sebagai baris jsonb bernomor urut). Tabel `sessions`
-- untuk autentikasi token sederhana (auth penuh: pikirkan nanti).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Penyimpanan mirip-spreadsheet ----------
create table if not exists sheet_rows (
  name text not null,
  ord  bigint not null,
  row  jsonb not null default '[]'::jsonb,
  primary key (name, ord)
);

-- ---------- Sesi login token ----------
create table if not exists sessions (
  token      text primary key,
  username   text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_sessions_username on sessions (username);

-- ---------- SEED: REF_CABANG ----------
insert into sheet_rows (name, ord, row) values
('REF_CABANG', 0, '["Kode","Nama Cabang"]'),
('REF_CABANG', 1, '["JKT","Jakarta (Pusat)"]'),
('REF_CABANG', 2, '["BDG","Bandung"]'),
('REF_CABANG', 3, '["SLY","Semarang"]'),
('REF_CABANG', 4, '["MLG","Malang"]'),
('REF_CABANG', 5, '["YOG","Yogyakarta"]'),
('REF_CABANG', 6, '["SUB","Surabaya"]')
on conflict (name, ord) do nothing;

-- ---------- SEED: REF_JENIS_BARANG ----------
insert into sheet_rows (name, ord, row) values
('REF_JENIS_BARANG', 0, '["Kode","Nama Jenis"]'),
('REF_JENIS_BARANG', 1, '["SVRMB","Sparepart Robot Main Board"]'),
('REF_JENIS_BARANG', 2, '["SVRMI","Sparepart Robot Mechatronics"]'),
('REF_JENIS_BARANG', 3, '["ELKTR","Elektronik"]'),
('REF_JENIS_BARANG', 4, '["MESIN","Mesin & Komponen"]')
on conflict (name, ord) do nothing;

-- ---------- SEED: USERS ----------
-- Password disimpan plaintext (paritas dengan versi Apps Script;
--   perbaikan auth dicatat sebagai "pikirkan nanti").
insert into sheet_rows (name, ord, row) values
('USERS', 0, '["Username","Password","Cabang","Role","Nama"]'),
('USERS', 1, '["admin","admin123","JKT","admin","Administrator Pusat"]'),
('USERS', 2, '["cabang","cabang123","BDG","cabang","Staff Cabang Bandung"]')
on conflict (name, ord) do nothing;

-- ---------- SEED: ALAMAT ----------
insert into sheet_rows (name, ord, row) values
('ALAMAT', 0, '["SITE","WILAYAH","PENGIRIM","PIC","DEPT","ALAMAT","KELURAHAN","KECAMATAN","KOTA","TLP"]'),
('ALAMAT', 1, '["JKT","DKI Jakarta","Bp. Admin Pusat","Bp. Admin Pusat","Gudang Pusat","Jl. Raya Jakarta No. 1","Kel. Menteng","Kec. Menteng","Jakarta Pusat 10310","021-1234567"]'),
('ALAMAT', 2, '["BDG","Jawa Barat","Bp. Staff Bandung","Ibu Dewi","Purchasing","Jl. Raya Bandung No. 100","","Kec. Cimahi","Bandung 40513","022-888999"]'),
('ALAMAT', 3, '["MLG","Jawa Timur","Bp. Sujarwo","Bp. Maryono","Gudang","Jl. Magelang Raya No. 1","RT 01 RW 02","Kec. Tidar","Magelang 56125","0271-123456"]'),
('ALAMAT', 4, '["SLY","Jawa Tengah","Bp. Sujarwo","Ibu Ratna","Quality","Jl. Solo-Purwodadi No. 22","","Kec. Grogol","Sukoharjo 57552","0271-987654"]'),
('ALAMAT', 5, '["YOG","DI Yogyakarta","Bp. Sujarwo","Bp. Hadi","Produksi","Jl. Kusumanegara No. 10","","Kec. Gondokusuman","Yogyakarta 55222","0274-654321"]')
on conflict (name, ord) do nothing;

-- ---------- SEED: PENERIMAAN_SURAT_JALAN (header eksternal) ----------
insert into sheet_rows (name, ord, row) values
('PENERIMAAN_SURAT_JALAN', 0, '["ID","No Surat Jalan","Tanggal","Rms","No Truk","Kurir","No Bukti","Deskripsi","Qty","Satuan","Keterangan","Status Fisik","Diterima Oleh","Waktu Input"]')
on conflict (name, ord) do nothing;

-- ---------- SEED: DETAIL_PENERIMAAN_SURAT_JALAN ----------
insert into sheet_rows (name, ord, row) values
('DETAIL_PENERIMAAN_SURAT_JALAN', 0, '["ID Detail","ID Surat Jalan","No","No Bukti","Deskripsi","Qty","Satuan","Keterangan","Status Fisik","Diterima Oleh","Waktu Diterima","Tujuan Site","Status Kirim","ID SJ Kirim","No SJ Kirim"]')
on conflict (name, ord) do nothing;

-- ---------- SEED: SURAT_JALAN + DETAIL_SURAT_JALAN (header kosong, siap pakai) ----------
insert into sheet_rows (name, ord, row) values
('SURAT_JALAN', 0, '["ID","No Surat Jalan","Tanggal","Cabang Asal","Cabang Tujuan","Kode Jenis Barang","Dikirim Via","Total Barang","Status Kirim Cikupa","Dibuat Oleh","Waktu Input","Perlu Diteruskan","Tujuan Akhir","Tanggal Kirim Lanjutan","No Truk","Sopir","Status Kirim Pusat","Diupdate Oleh","Waktu Update"]'),
('DETAIL_SURAT_JALAN', 0, '["ID Detail","ID Surat Jalan","No","No Bukti","Deskripsi","Qty","Satuan","Keterangan","Status Fisik","Diterima Oleh","Waktu Diterima"]')
on conflict (name, ord) do nothing;