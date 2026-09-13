-- ============================================================
-- Surat Jalan Vercel — Migration 004: Referensi -> tabel normal
-- ============================================================
-- Menghapus pemakaian `sheet_rows` total. Data referensi
-- (USERS, REF_CABANG, REF_JENIS_BARANG, ALAMAT) dipindah ke
-- tabel Postgres normal sesuai kolom sheet di Excel
-- (src/SURAT_JALAN_CIKUPA.xlsx), lalu `sheet_rows` di-drop.
-- ============================================================

begin;

-- ---------- USERS ----------
create table if not exists users (
  username text primary key,
  password text not null default '',
  cabang   text not null default '',
  role     text not null default 'cabang',
  nama     text not null default ''
);

insert into users (username, password, cabang, role, nama)
select
  s.row->>0,
  s.row->>1,
  s.row->>2,
  s.row->>3,
  coalesce(s.row->>4, '')
from sheet_rows s
where s.name = 'USERS'
  and s.ord > 0
  and coalesce(s.row->>0, '') <> ''
on conflict (username) do nothing;

-- ---------- REF_CABANG ----------
create table if not exists ref_cabang (
  kode text primary key,
  nama text not null default ''
);

insert into ref_cabang (kode, nama)
select s.row->>0, s.row->>1
from sheet_rows s
where s.name = 'REF_CABANG'
  and s.ord > 0
  and coalesce(s.row->>0, '') <> ''
on conflict (kode) do nothing;

-- ---------- REF_JENIS_BARANG ----------
create table if not exists ref_jenis_barang (
  kode text primary key,
  nama text not null default ''
);

insert into ref_jenis_barang (kode, nama)
select s.row->>0, s.row->>1
from sheet_rows s
where s.name = 'REF_JENIS_BARANG'
  and s.ord > 0
  and coalesce(s.row->>0, '') <> ''
on conflict (kode) do nothing;

-- ---------- ALAMAT (kolom persis header Excel) ----------
create table if not exists alamat (
  sdo       text not null default '',
  site      text primary key,
  wilayah   text not null default '',
  pengirim  text not null default '',
  pic       text not null default '',
  dept      text not null default '',
  alamat    text not null default '',
  kelurahan text not null default '',
  kecamatan text not null default '',
  kota      text not null default '',
  tlp       text not null default ''
);

insert into alamat (sdo, site, wilayah, pengirim, pic, dept, alamat, kelurahan, kecamatan, kota, tlp)
select
  s.row->>0, s.row->>1, s.row->>2, s.row->>3, s.row->>4,
  s.row->>5, s.row->>6, s.row->>7, s.row->>8, s.row->>9, s.row->>10
from sheet_rows s
where s.name = 'ALAMAT'
  and s.ord > 0
  and coalesce(s.row->>1, '') <> ''
on conflict (site) do nothing;

-- ---------- DROP sheet_rows (tidak dipakai lagi) ----------
drop table if exists sheet_rows;

commit;