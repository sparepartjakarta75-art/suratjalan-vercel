-- ============================================================
-- Surat Jalan Vercel — Migration 002: Tabel relasional performa
-- ============================================================
-- Rasionalisasi: tabel transaksi utama dipindah dari `sheet_rows`
-- (jsonb) ke tabel Postgres normal + index. Data referensi kecil
-- (USERS, ALAMAT, REF_CABANG, REF_JENIS_BARANG) tetap di
-- `sheet_rows` karena jarang berubah dan jumlahnya kecil.
-- ============================================================

-- ---------- SURAT_JALAN (header) ----------
create table if not exists surat_jalan (
  id                  text primary key,
  no_surat_jalan      text not null,
  tanggal             timestamptz not null default now(),
  cabang_asal         text not null default '',
  cabang_tujuan       text not null default '',
  kode_jenis_barang   text not null default '',
  dikirim_via         text not null default '',
  total_barang        integer not null default 0,
  status_kirim_cikupa text not null default '',
  dibuat_oleh         text not null default '',
  waktu_input         timestamptz not null default now(),
  perlu_diteruskan    text not null default 'Tidak',
  tujuan_akhir        text not null default '',
  tanggal_kirim_lanjutan timestamptz,
  no_truk             text not null default '',
  sopir               text not null default '',
  status_kirim_pusat  text not null default '',
  diupdate_oleh       text not null default '',
  waktu_update        timestamptz
);

-- ---------- DETAIL_SURAT_JALAN (item barang) ----------
create table if not exists detail_surat_jalan (
  id_detail      text primary key,
  id_surat_jalan text not null references surat_jalan (id) on delete cascade,
  no             integer not null default 0,
  no_bukti       text not null default '',
  deskripsi      text not null default '',
  qty            numeric not null default 0,
  satuan         text not null default '',
  keterangan     text not null default '',
  status_fisik   text not null default 'Belum Diterima',
  diterima_oleh  text not null default '',
  waktu_diterima timestamptz
);

-- ---------- PENERIMAAN_SURAT_JALAN (eksternal header) ----------
create table if not exists penerimaan_surat_jalan (
  id             text primary key,
  no_surat_jalan text not null default '',
  tanggal        timestamptz,
  rms            text not null default '',
  no_truk        text not null default '',
  kurir          text not null default '',
  no_bukti       text not null default '',
  deskripsi      text not null default '',
  qty            text not null default '',
  satuan         text not null default '',
  keterangan     text not null default '',
  status_fisik   text not null default '',
  diterima_oleh  text not null default '',
  waktu_input    timestamptz not null default now()
);

-- ---------- DETAIL_PENERIMAAN_SURAT_JALAN (eksternal item) ----------
create table if not exists detail_penerimaan_surat_jalan (
  id_detail      text primary key,
  id_surat_jalan text not null references penerimaan_surat_jalan (id) on delete cascade,
  no             integer not null default 0,
  no_bukti       text not null default '',
  deskripsi      text not null default '',
  qty            numeric not null default 0,
  satuan         text not null default '',
  keterangan     text not null default '',
  status_fisik   text not null default '',
  diterima_oleh  text not null default '',
  waktu_diterima timestamptz,
  tujuan_site    text not null default '',
  status_kirim   text not null default 'Open',
  id_sj_kirim    text not null default '',
  no_sj_kirim    text not null default ''
);

-- ============================================================
-- INDEX
-- ============================================================
-- Nomor urut SJ per cabang per bulan (buatNomorSuratJalan_).
create index if not exists idx_sj_asal_tanggal
  on surat_jalan (cabang_asal, tanggal);
-- Filter daftar per cabang tujuan.
create index if not exists idx_sj_cabang_tujuan
  on surat_jalan (cabang_tujuan);
-- Filter status + diteruskan + tujuan akhir (list tujuan/cabang).
create index if not exists idx_sj_status
  on surat_jalan (status_kirim_cikupa, perlu_diteruskan, tujuan_akhir);
-- Fetch detail per header (join).
create index if not exists idx_dsj_id_surat_jalan
  on detail_surat_jalan (id_surat_jalan);
create index if not exists idx_dpsj_id_surat_jalan
  on detail_penerimaan_surat_jalan (id_surat_jalan);
-- Kiriman pending / open eksternal per tujuan.
create index if not exists idx_dpsj_status_tujuan
  on detail_penerimaan_surat_jalan (status_kirim, tujuan_site);

-- ============================================================
-- MIGRASI DATA dari sheet_rows (jsonb) -> tabel relasional
-- ============================================================
-- Header sesuai seed lama (ord 0 tidak ikut; ord > 0 = data).
-- Tambahkan predikat guard agar aman dijalankan ulang.

-- SURAT_JALAN
insert into surat_jalan (
  id, no_surat_jalan, tanggal, cabang_asal, cabang_tujuan,
  kode_jenis_barang, dikirim_via, total_barang, status_kirim_cikupa,
  dibuat_oleh, waktu_input, perlu_diteruskan, tujuan_akhir,
  tanggal_kirim_lanjutan, no_truk, sopir, status_kirim_pusat,
  diupdate_oleh, waktu_update
)
select
  s.row->>0,
  s.row->>1,
  case when s.row->>2 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>2)::timestamptz end,
  s.row->>3, s.row->>4, s.row->>5, s.row->>6,
  case when s.row->>7 ~ '^[0-9]+$' then (s.row->>7)::integer end,
  s.row->>8, s.row->>9,
  case when s.row->>10 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>10)::timestamptz end,
  coalesce(nullif(s.row->>11,''), 'Tidak'), s.row->>12,
  case when s.row->>13 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>13)::timestamptz end,
  s.row->>14, s.row->>15, s.row->>16, s.row->>17,
  case when s.row->>18 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>18)::timestamptz end
from sheet_rows s
where s.name = 'SURAT_JALAN'
  and s.ord > 0
  and s.row->>0 is not null
  and s.row->>0 <> ''
on conflict (id) do nothing;

-- DETAIL_SURAT_JALAN
insert into detail_surat_jalan (
  id_detail, id_surat_jalan, no, no_bukti, deskripsi, qty,
  satuan, keterangan, status_fisik, diterima_oleh, waktu_diterima
)
select
  s.row->>0, s.row->>1,
  case when s.row->>2 ~ '^[0-9]+$' then (s.row->>2)::integer end,
  s.row->>3, s.row->>4,
  case when s.row->>5 ~ '^-?[0-9]*\.?[0-9]+$' then (s.row->>5)::numeric end,
  s.row->>6, s.row->>7, coalesce(nullif(s.row->>8,''), 'Belum Diterima'),
  s.row->>9,
  case when s.row->>10 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>10)::timestamptz end
from sheet_rows s
where s.name = 'DETAIL_SURAT_JALAN'
  and s.ord > 0
  and s.row->>0 is not null
  and s.row->>0 <> ''
  and exists (select 1 from surat_jalan h where h.id = s.row->>1)
on conflict (id_detail) do nothing;

-- PENERIMAAN_SURAT_JALAN
insert into penerimaan_surat_jalan (
  id, no_surat_jalan, tanggal, rms, no_truk, kurir, no_bukti,
  deskripsi, qty, satuan, keterangan, status_fisik,
  diterima_oleh, waktu_input
)
select
  s.row->>0, s.row->>1,
  case when s.row->>2 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>2)::timestamptz end,
  s.row->>3, s.row->>4, s.row->>5, s.row->>6,
  s.row->>7, s.row->>8, s.row->>9, s.row->>10, s.row->>11,
  s.row->>12,
  case when s.row->>13 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>13)::timestamptz end
from sheet_rows s
where s.name = 'PENERIMAAN_SURAT_JALAN'
  and s.ord > 0
  and s.row->>0 is not null
  and s.row->>0 <> ''
on conflict (id) do nothing;

-- DETAIL_PENERIMAAN_SURAT_JALAN
insert into detail_penerimaan_surat_jalan (
  id_detail, id_surat_jalan, no, no_bukti, deskripsi, qty,
  satuan, keterangan, status_fisik, diterima_oleh, waktu_diterima,
  tujuan_site, status_kirim, id_sj_kirim, no_sj_kirim
)
select
  s.row->>0, s.row->>1,
  case when s.row->>2 ~ '^[0-9]+$' then (s.row->>2)::integer end,
  s.row->>3, s.row->>4,
  case when s.row->>5 ~ '^-?[0-9]*\.?[0-9]+$' then (s.row->>5)::numeric end,
  s.row->>6, s.row->>7, s.row->>8, s.row->>9,
  case when s.row->>10 ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then (s.row->>10)::timestamptz end,
  s.row->>11, coalesce(nullif(s.row->>12,''), 'Open'),
  s.row->>13, s.row->>14
from sheet_rows s
where s.name = 'DETAIL_PENERIMAAN_SURAT_JALAN'
  and s.ord > 0
  and s.row->>0 is not null
  and s.row->>0 <> ''
  and exists (select 1 from penerimaan_surat_jalan h where h.id = s.row->>1)
on conflict (id_detail) do nothing;