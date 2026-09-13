/**
 * ============================================================
 * PDF.TS — Cetak Surat Jalan & Penerimaan Eksternal ke PDF
 * ============================================================
 * Mengganti `HtmlService → .getAs('application/pdf')` dari versi
 * Apps Script. Memakai pdfkit (murni Node, tanpa browser) agar
 * cocok dengan runtime Vercel. Konten meniru template asli.
 * ============================================================
 */

import PDFDocument from 'pdfkit';
import {
  ambilHeaderById_,
  getDetailSuratJalan,
  safeFormatDate,
  getCabangList,
  getAlamatRef,
} from './core.js';
import { Utilities, Session } from './sheets.js';
import { getPenerimaanEksternalDetail } from './core.js';

const PAGE_W = 595.28; // A4 portrait points
const PAGE_H = 841.89;

function newDoc() {
  return new PDFDocument({ size: 'A4', margins: { top: 20, bottom: 20, left: 14, right: 14 } });
}

function collect(doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

function namaCabangFn(cabangList: any[], kode: string): string {
  const found = cabangList.find((c) => c['Kode'] === kode);
  return found ? found['Nama Cabang'] : kode;
}

/**
 * Cetak Surat Jalan — port dari CetakPDF.ts (Apps Script).
 */
export async function buatPdfSuratJalan(idSuratJalan: string, namaPencetak: string): Promise<any> {
  try {
    const header = await ambilHeaderById_(idSuratJalan);
    if (!header) return { success: false, message: 'Data surat jalan tidak ditemukan.' };

    const details = await getDetailSuratJalan(idSuratJalan);
    const cabangList = await getCabangList();
    const alamatData = await getAlamatRef();

    let alamatTujuan: any = null;
    if (header['Tujuan Akhir']) {
      alamatTujuan = alamatData.find((a) => a['SITE'] === header['Tujuan Akhir']) || null;
    }
    if (!alamatTujuan && header['Cabang Tujuan']) {
      alamatTujuan = alamatData.find((a) => a['SITE'] === header['Cabang Tujuan']) || null;
    }

    let alamatCabangAsal: any = null;
    if (header['Cabang Asal']) {
      alamatCabangAsal = alamatData.find((a) => a['SITE'] === header['Cabang Asal']) || null;
    }
    const picMengetahui = alamatCabangAsal ? alamatCabangAsal['PIC'] || '-' : '-';
    const pengirim = alamatCabangAsal ? alamatCabangAsal['PENGIRIM'] || '-' : '-';
    const pengirimDept = alamatCabangAsal ? alamatCabangAsal['DEPT'] || '-' : '-';
    const pengirimTlp = alamatCabangAsal ? alamatCabangAsal['TLP'] || '-' : '-';

    const now = new Date();
    const tanggalCetak = Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd/MM/yyyy');
    const jamCetak = Utilities.formatDate(now, Session.getScriptTimeZone(), 'HH mm ss').replace(/ /g, '.');
    const tanggalBukti = safeFormatDate(header['Tanggal'], 'dd/MM/yyyy');

    const doc = newDoc();
    const name = String(header['No Surat Jalan'] || idSuratJalan).replace(/\//g, '-');

    // meta-info
    doc.font('Helvetica-Oblique').fontSize(7.5)
      .text('Dicetak tanggal : ' + tanggalCetak + ' - Jam : ' + jamCetak + ' - Oleh : ' + (namaPencetak || '-'))
      .moveDown(0.2);

    // Kotak utama
    const boxY = doc.y;
    doc.rect(14, boxY, PAGE_W - 28, 8).fill('#f0f0f0');
    doc.fillColor('#000').font('Helvetica-Bold').fontSize(13)
      .text('PT. SARANA KENCANA MULYA', 20, boxY + 4, { width: PAGE_W - 160 })
      .moveDown(0.2)
      .text(namaCabangFn(cabangList, header['Cabang Asal']), 20, doc.y, { width: PAGE_W - 160 })
      .font('Helvetica-Bold').fontSize(13)
      .text('POLYTRON', 0, boxY + 4, { align: 'right', width: PAGE_W - 190 });

    // Blok Kepada Yth (kiri) + rincian (kanan)
    let kepada = 'Kepada Yth.\n';
    if (alamatTujuan) {
      kepada += (alamatTujuan['PIC'] || '-') + '\n';
      kepada += (alamatTujuan['DEPT'] || '') + '\n';
      kepada += (alamatTujuan['ALAMAT'] || '') + '\n';
      kepada += (alamatTujuan['KELURAHAN'] || '') + '\n';
      kepada += (alamatTujuan['KECAMATAN'] || '') + '\n';
      kepada += (alamatTujuan['KOTA'] || '') + '\n';
      kepada += (alamatTujuan['TLP'] || '');
    } else {
      kepada += namaCabangFn(cabangList, header['Cabang Tujuan']);
    }

    const yKepada = doc.y + 16;
    doc.font('Helvetica').fontSize(8.5).text(kepada, 20, yKepada, { width: 260 });

    const infoRows = [
      ['Nomor Bukti', header['No Surat Jalan']],
      ['Tanggal Bukti', tanggalBukti],
      ['Cabang Asal', header['Cabang Asal']],
      ['Cabang Tujuan', header['Cabang Tujuan']],
      ['Pengirim', picMengetahui + '\n' + pengirimDept + '\nTelp: ' + pengirimTlp],
    ];
    let yInfo = doc.y + 4;
    if (yInfo < yKepada) yInfo = yKepada;
    const xInfo = 300;
    doc.font('Helvetica').fontSize(8.5);
    for (const [label, value] of infoRows) {
      doc.text(label + ' :', xInfo, yInfo, { width: 90 });
      const labelHeight = doc.heightOfString(label + ' :', { width: 90 });
      doc.text(value, xInfo + 95, yInfo, { width: 150 });
      const valHeight = doc.heightOfString(value, { width: 150 });
      yInfo += Math.max(labelHeight, valHeight) + 4;
    }

    doc.text('Remarks : ' + (header['Dikirim Via'] || '-'), 20, yInfo + 10, { width: PAGE_W - 40 });

    // Tabel data
    const tableTop = doc.y + 14;
    const colXs = [26, 90, 170, 330, 360, 400, 480];
    const rightX = PAGE_W - 30;
    const headersRow = ['No', 'Part', 'Deskripsi', 'Qty', 'UM', 'Keterangan', 'Status'];

    const rowH = 18;
    doc.font('Helvetica-Bold').fontSize(7.5);
    headersRow.forEach((h, i) => {
      const x = colXs[i];
      const w = (colXs[i + 1] || rightX) - x;
      doc.text(h, x, tableTop + 4, { width: w, align: i === 0 || i === 3 || i === 4 ? 'center' : 'left' });
    });

    let yRow = tableTop + rowH;
    let totalQty = 0;
    doc.font('Helvetica').fontSize(7.5);
    details.forEach((d: any, idx: number) => {
      totalQty += Number(d.qty) || 0;
      doc.text(String(idx + 1), colXs[0], yRow + 3, { width: 60, align: 'center' });
      doc.text(String(d.noBukti || '-'), colXs[1], yRow + 3, { width: 78 });
      doc.text(String(d.deskripsi || ''), colXs[2], yRow + 3, { width: 158 });
      doc.text(String(d.qty ?? ''), colXs[3], yRow + 3, { width: 28, align: 'center' });
      doc.text(String(d.satuan || '-'), colXs[4], yRow + 3, { width: 28, align: 'center' });
      doc.text(String(d.keterangan || '-'), colXs[5], yRow + 3, { width: 78 });
      doc.text(String(d.statusFisik || 'Belum Diterima'), colXs[6], yRow + 3, { width: (rightX - colXs[6]) });
      yRow += rowH;
    });

    doc.font('Helvetica-Bold').text('Total', colXs[0], yRow, { width: 300, align: 'right' });
    doc.text(String(totalQty), colXs[3], yRow, { width: 28, align: 'center' });
    yRow += 20;

    // Tanda tangan (4 kolom)
    const namaSopir = header['Sopir'] || '';
    const noTruk = header['No Truk'] || '';
    const namaPenerima = alamatTujuan ? alamatTujuan['PIC'] || '' : '';
    const sigY = yRow + 30;
    const boxW = (PAGE_W - 40) / 4;
    const sigs: Array<[string, string, string]> = [
      ['PENGIRIM', pengirim, 'ADM SPAREPART'],
      ['MENGETAHUI', picMengetahui, 'HoDS'],
      ['SOPIR/EKSPEDISI', namaSopir, noTruk],
      ['PENERIMA', namaPenerima, ''],
    ];
    sigs.forEach((s, i) => {
      const x = 20 + i * boxW;
      doc.font('Helvetica-Bold').fontSize(8).text(s[0], x, sigY, { width: boxW, align: 'center' });
      doc.font('Helvetica').fontSize(8).text(s[1] || '-', x, sigY + 60, { width: boxW, align: 'center' });
      doc.font('Helvetica-Oblique').fontSize(7).text(s[2], x, sigY + 72, { width: boxW, align: 'center' });
      if (s[2]) {
        doc.moveTo(x + boxW / 2 - 40, sigY + 80).lineTo(x + boxW / 2 + 40, sigY + 80).stroke();
      } else {
        doc.moveTo(x + boxW / 2 - 40, sigY + 60).lineTo(x + boxW / 2 + 40, sigY + 60).stroke();
      }
    });

    doc.end();
    const buffer = await collect(doc);

    return {
      success: true,
      base64: buffer.toString('base64'),
      filename: 'SuratJalan_' + name + '.pdf',
    };
  } catch (e: any) {
    return { success: false, message: 'Gagal membuat PDF: ' + e.message };
  }
}

/**
 * Cetak Penerimaan Eksternal — port dari cetakPenerimaanEksternal (Apps Script).
 */
export async function buatPdfPenerimaanEksternal(id: string): Promise<any> {
  try {
    const result = await getPenerimaanEksternalDetail(id);
    if (!result.success) return result;

    const h = result.header;
    const items = result.items;
    const tanggalFormatted = safeFormatDate(h.tanggal, 'dd/MM/yyyy');

    const doc = newDoc();
    doc.font('Helvetica-Bold').fontSize(14).text('PENERIMAAN EKSTERNAL', { align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text('No. Surat Jalan: ' + (h.noSuratJalan || ''), { align: 'center' })
      .moveDown(1);

    const rows: Array<[string, string]> = [
      ['Sumber', h.rms || ''],
      ['Tanggal', tanggalFormatted],
      ['No. Truk', h.noTruk || '-'],
      ['Kurir / Sopir', h.kurir || '-'],
      ['Diterima Oleh', h.diterimaOleh || ''],
    ];
    rows.forEach(([label, value]) => doc.text(label + ' : ' + value, 30, doc.y, { width: 400 }).moveDown(0.3));

    doc.moveDown(0.5);
    const tableTop = doc.y;
    const colXs = [30, 90, 150, 300, 340, 390, 470];
    const rightX = PAGE_W - 30;
    const headersRow = ['No', 'No Bukti', 'Deskripsi', 'Qty', 'Satuan', 'Keterangan', 'Status'];
    const rowH = 16;

    doc.font('Helvetica-Bold').fontSize(7.5);
    headersRow.forEach((hdr, i) => {
      const x = colXs[i];
      const w = (colXs[i + 1] || rightX) - x;
      doc.text(hdr, x, tableTop + 4, { width: w, align: i === 0 || i === 3 ? 'center' : 'left' });
    });

    let yRow = tableTop + rowH;
    doc.font('Helvetica').fontSize(7.5);
    items.forEach((it: any) => {
      doc.text(String(it.no || ''), colXs[0], yRow + 3, { width: 56, align: 'center' });
      doc.text(String(it.noBukti || '-'), colXs[1], yRow + 3, { width: 56 });
      doc.text(String(it.deskripsi || ''), colXs[2], yRow + 3, { width: 148 });
      doc.text(String(it.qty ?? ''), colXs[3], yRow + 3, { width: 38, align: 'center' });
      doc.text(String(it.satuan || ''), colXs[4], yRow + 3, { width: 48 });
      doc.text(String(it.keterangan || '-'), colXs[5], yRow + 3, { width: 78 });
      doc.text(String(it.statusFisik || '-'), colXs[6], yRow + 3, { width: rightX - colXs[6] });
      yRow += rowH;
    });

    const sigY = yRow + 60;
    const boxW = (PAGE_W - 40) / 3;
    const titles = ['Dikirim Oleh', 'Diterima Oleh', 'Mengetahui'];
    titles.forEach((t, i) => {
      const x = 20 + i * boxW;
      doc.font('Helvetica-Bold').fontSize(8).text(t, x, sigY, { width: boxW, align: 'center' });
      doc.moveTo(x + boxW / 2 - 45, sigY + 50).lineTo(x + boxW / 2 + 45, sigY + 50).stroke();
    });

    doc.end();
    const buffer = await collect(doc);

    const filename = 'PenerimaanEksternal_' + (h.noSuratJalan || id).replace(/[\/\\]/g, '-') + '.pdf';
    return { success: true, base64: buffer.toString('base64'), filename };
  } catch (e: any) {
    return { success: false, message: 'Gagal membuat PDF: ' + e.message };
  }
}