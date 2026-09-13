# Surat Jalan — Vercel (Supabase/Postgres)

Versi web dari aplikasi Surat Jalan (paritas penuh dengan versi Google Apps Script di repo `SuratJalanCikupa`), di-deploy ke **Vercel** dengan database **Supabase (Postgres)**.

## Arsitektur

- **Client**: SPA vanilla TS + Tailwind/DaisyUI (sama persis dengan versi Apps Script). Semua komponen memanggil `Api` (`src/client/utils/api-client.ts`) yang berbasis `fetch` ke `POST /api/rpc`.
- **Server**: Vercel Serverless Function `api/rpc.ts` + logika bisnis di `server/*.ts` (port hampir verbatim dari `SuratJalan.ts`, `References.ts`, `Auth.ts`, `CetakPDF.ts`).
- **Database**: satu endpoint RPC `{ fn, args }`. Seluruh data di tabel Postgres normal: transaksi (`surat_jalan`, `detail_surat_jalan`, `penerimaan_surat_jalan`, `detail_penerimaan_surat_jalan`) + referensi (`users`, `alamat`, `ref_cabang`, `ref_jenis_barang`) + `sessions`. Server mengakses langsung via query Supabase (tanpa virtual-sheet).
- **PDF**: `pdfkit` (murni Node) menggantikan `HtmlService.getAs('application/pdf')`.

## Setup di Vercel

1. Buat project Supabase, lalu jalankan semua migration `supabase/migrations/*.sql` — urut dari `001` s/d `004` (atau `npx supabase db push`). Hasil akhir: tabel Postgres berisi data produksi dari Excel `src/SURAT_JALAN_CIKUPA.xlsx` (transaksi + referensi; `sheet_rows` sudah di-drop).
   - Login pakai akun dari tabel `users` hasil import (mis. `adminjkt` / `admin123`).
2. Di dashboard Vercel, hubungkan repo `suratjalan-vercel` (framework auto—Vite). Atur environment variables:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` key (jangan bocorkan ke client)
3. Deploy. Aplikasi berjalan di URL Vercel.

## Development lokal

```
npm install
npm run dev        # vercel dev (membutuhkan `npx vercel login` + env lokal SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
```

Atau tanpa kredensial asli — self-test end-to-end dengan mock Supabase:

```
npm run selftest   # login, CRUD SJ, penerimaan eksternal, pending, terima tujuan, PDF, ganti password
```

Hanya rebuild UI: `npm run build` + `npm run preview`.

## Catatan paritas & perbedaan dari versi Apps Script

- `role` / `cabang` / `username` yang dikirim client **dipaksa** dengan identitas sesi di server (`server/index.ts` → `overrideArgs`), tidak dipercaya begitu saja.
- Auth sesi pakai token (tabel `sessions`, TTL 12 jam). Perbaikan skema auth (hash password, role granular) dicatat sebagai pekerjaan lanjutan ("auth pikirkan nanti").
- PDF QR code mirip template asli (tanpa gambar QR; konten/nomor sama).
- Nomor urut surat jalan direset tiap bulan per cabang asal (sama seperti versi GAS).

## Migrasi data dari Apps Script

Data versi Apps Script dimigrasikan lewat migration (bukan `sheet_rows` lagi):

- `002_perf_tables.sql` — transaksi dipindah dari `sheet_rows` ke tabel relasional.
- `003_import_xlsx.sql` — impor penuh data produksi dari `src/SURAT_JALAN_CIKUPA.xlsx`.
- `004_reference_tables.sql` — referensi (`USERS`, `REF_CABANG`, `REF_JENIS_BARANG`, `ALAMAT`) dipindah ke tabel normal (`users`, `ref_cabang`, `ref_jenis_barang`, `alamat`), lalu `sheet_rows` di-drop.