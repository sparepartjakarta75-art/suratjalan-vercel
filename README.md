# Surat Jalan — Vercel (Supabase/Postgres)

Versi web dari aplikasi Surat Jalan (paritas penuh dengan versi Google Apps Script di repo `SuratJalanCikupa`), di-deploy ke **Vercel** dengan database **Supabase (Postgres)**.

## Arsitektur

- **Client**: SPA vanilla TS + Tailwind/DaisyUI (sama persis dengan versi Apps Script). Semua komponen memanggil `GasAPI` (`src/client/utils/gas-wrapper.ts`) yang kini berbasis `fetch` ke `POST /api/rpc`.
- **Server**: Vercel Serverless Function `api/rpc.ts` + logika bisnis di `server/*.ts` (port hampir verbatim dari `SuratJalan.ts`, `References.ts`, `Auth.ts`, `CetakPDF.ts`).
- **Database**: satu endpoint RPC `{ fn, args }`; lapisan `server/sheets.ts` meniru API Google Sheets (virtual sheet) di atas tabel `sheet_rows` Postgres — sehingga logika Apps Script diport tanpa mengubah alur.
- **PDF**: `pdfkit` (murni Node) menggantikan `HtmlService.getAs('application/pdf')`.

## Setup di Vercel

1. Buat project Supabase, lalu jalankan migration `supabase/migrations/001_schema.sql` (SQL Editor). Otomatis membuat tabel & seed data awal:
   - Login admin: `admin` / `admin123` (cabang JKT, role admin)
   - Login cabang: `cabang` / `cabang123` (cabang BDG)
2. Di dashboard Vercel, hubungkan repo `suratjalan-vercel` (framework auto—Vite). Atur environment variables:
   - `SUPABASE_URL` — Project Settings → API → Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` key (jangan bocorkan ke client)
3. Deploy. Aplikasi berjalan di URL Vercel.

## Development lokal

```
npm install
vercel dev        # menjalankan Vite build + api/* secara bersamaan
```

Atau hanya saat rebuild UI: `npm run build` + `npm run preview`.

## Catatan paritas & perbedaan dari versi Apps Script

- `role` / `cabang` / `username` yang dikirim client **dipaksa** dengan identitas sesi di server (`server/index.ts` → `overrideArgs`), tidak dipercaya begitu saja.
- Auth sesi pakai token (tabel `sessions`, TTL 12 jam). Perbaikan skema auth (hash password, role granular) dicatat sebagai pekerjaan lanjutan ("auth pikirkan nanti").
- PDF QR code mirip template asli (tanpa gambar QR; konten/nomor sama).
- Nomor urut surat jalan direset tiap bulan per cabang asal (sama seperti versi GAS).

## Migrasi data dari Apps Script

Data "sheet" versi Apps Script bisa diekspor ke `sheet_rows`:

- Ambil isi tiap sheet sebagai CSV/TSV (baris pertama = header).
- Untuk tiap baris, insert `{"name": "<NAMA_SHEET>", "ord": <indeks>, "row": [<nilai per kolom>]}`.
- Nama sheet yang didukung: `USERS`, `SURAT_JALAN`, `DETAIL_SURAT_JALAN`, `REF_JENIS_BARANG`, `REF_CABANG`, `ALAMAT`, `PENERIMAAN_SURAT_JALAN`, `DETAIL_PENERIMAAN_SURAT_JALAN`.