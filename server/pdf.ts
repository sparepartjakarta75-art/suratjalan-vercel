/**
 * ============================================================
 * PDF.TS — Cetak Surat Jalan & Penerimaan Eksternal ke PDF
 * ============================================================
 *
 * Menggunakan:
 *   - PDFKit
 *   - QRCode
 *
 * Template mengikuti CetakPDF.gs:
 *   - Meta info cetak
 *   - PT. SARANA KENCANA MULYA
 *   - Nama cabang
 *   - POLYTRON
 *   - QR Code
 *   - Kepada Yth
 *   - Nomor Bukti
 *   - Tanggal Bukti
 *   - Cabang Asal
 *   - Cabang Tujuan
 *   - Pengirim
 *   - Remarks
 *   - Tabel barang
 *   - Total
 *   - 4 tanda tangan
 *
 * ============================================================
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import {
  ambilHeaderById_,
  getDetailSuratJalan,
  safeFormatDate,
  getCabangList,
  getAlamatRef,
  getPenerimaanEksternalDetail,
} from './core.js';

import { Utilities, Session } from './sheets.js';


/* ============================================================
 * KONSTANTA A4
 * ============================================================
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;

const PAGE_MARGIN_LEFT = 14;
const PAGE_MARGIN_RIGHT = 14;

const CONTENT_X = 20;
const CONTENT_W = PAGE_W - 40;


/* ============================================================
 * DOCUMENT
 * ============================================================
 */

function newDoc(): PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margins: {
      top: 20,
      bottom: 20,
      left: 14,
      right: 14,
    },
    autoFirstPage: true,
  });
}


/* ============================================================
 * COLLECT PDF
 * ============================================================
 */

function collect(doc: PDFDocument): Promise<Buffer> {

  return new Promise((resolve, reject) => {

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

  });
}


/* ============================================================
 * SAFE TEXT
 * ============================================================
 */

function safeText(value: any): string {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value);

}


/* ============================================================
 * NAMA CABANG
 * ============================================================
 */

function namaCabangFn(
  cabangList: any[],
  kode: string
): string {

  const found = cabangList.find(
    (c) => c['Kode'] === kode
  );

  return found
    ? String(found['Nama Cabang'] || kode)
    : safeText(kode);

}


/* ============================================================
 * WRAP TEXT
 * ============================================================
 *
 * Membantu menghitung tinggi teks sebelum membuat row tabel.
 * ============================================================
 */

function textHeight(
  doc: PDFDocument,
  text: string,
  width: number,
  fontSize: number
): number {

  doc.fontSize(fontSize);

  return doc.heightOfString(
    text || '',
    {
      width,
      lineGap: 0,
    }
  );

}


/* ============================================================
 * DRAW TABLE CELL
 * ============================================================
 */

function drawCell(
  doc: PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
  } = {}
) {

  const paddingX = 4;
  const paddingY = 3;

  doc
    .rect(
      x,
      y,
      width,
      height
    )
    .stroke();


  if (options.bold) {
    doc.font('Helvetica-Bold');
  } else {
    doc.font('Helvetica');
  }


  doc
    .fontSize(7.5)
    .fillColor('#000')
    .text(
      text || '',
      x + paddingX,
      y + paddingY,
      {
        width: width - paddingX * 2,
        height: height - paddingY * 2,
        align: options.align || 'left',
        lineGap: 0,
      }
    );

}


/* ============================================================
 * QR CODE
 * ============================================================
 */

async function generateQrCode(
  value: string
): Promise<Buffer> {

  return await QRCode.toBuffer(
    value,
    {
      type: 'png',
      width: 120,
      margin: 1,
      errorCorrectionLevel: 'M',
    }
  );

}


/* ============================================================
 * DRAW SIGNATURE
 * ============================================================
 */

function drawSignature(
  doc: PDFDocument,
  title: string,
  name: string,
  description: string,
  x: number,
  y: number,
  width: number
) {

  /* Judul */

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#000')
    .text(
      title,
      x,
      y,
      {
        width,
        align: 'center',
      }
    );


  /* Area tanda tangan */

  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      name || '-',
      x,
      y + 76,
      {
        width,
        align: 'center',
      }
    );


  /* Keterangan */

  doc
    .font('Helvetica-Oblique')
    .fontSize(7)
    .text(
      description || '',
      x,
      y + 89,
      {
        width,
        align: 'center',
      }
    );


  /* Garis */

  doc
    .moveTo(
      x + width / 2 - 40,
      y + 100
    )
    .lineTo(
      x + width / 2 + 40,
      y + 100
    )
    .stroke();

}


/* ============================================================
 * CEK SPACE HALAMAN
 * ============================================================
 */

function ensureSpace(
  doc: PDFDocument,
  y: number,
  requiredHeight: number
): number {

  const bottomLimit =
    PAGE_H - 40;


  if (
    y + requiredHeight >
    bottomLimit
  ) {

    doc.addPage();

    return 30;
  }


  return y;

}


/* ============================================================
 * BUAT PDF SURAT JALAN
 * ============================================================
 */

export async function buatPdfSuratJalan(
  idSuratJalan: string,
  namaPencetak: string
): Promise<any> {

  try {

    /* ========================================================
     * DATA HEADER
     * ========================================================
     */

    const header =
      await ambilHeaderById_(
        idSuratJalan
      );


    if (!header) {

      return {
        success: false,
        message:
          'Data surat jalan tidak ditemukan.',
      };

    }


    /* ========================================================
     * DETAIL
     * ========================================================
     */

    const details =
      await getDetailSuratJalan(
        idSuratJalan
      );


    /* ========================================================
     * CABANG
     * ========================================================
     */

    const cabangList =
      await getCabangList();


    /* ========================================================
     * ALAMAT
     * ========================================================
     */

    const alamatData =
      await getAlamatRef();


    /* ========================================================
     * ALAMAT TUJUAN
     * ========================================================
     */

    let alamatTujuan: any = null;


    if (header['Tujuan Akhir']) {

      alamatTujuan =
        alamatData.find(
          (a) =>
            a['SITE'] ===
            header['Tujuan Akhir']
        ) || null;

    }


    if (
      !alamatTujuan &&
      header['Cabang Tujuan']
    ) {

      alamatTujuan =
        alamatData.find(
          (a) =>
            a['SITE'] ===
            header['Cabang Tujuan']
        ) || null;

    }


    /* ========================================================
     * ALAMAT CABANG ASAL
     * ========================================================
     */

    let alamatCabangAsal: any = null;


    if (header['Cabang Asal']) {

      alamatCabangAsal =
        alamatData.find(
          (a) =>
            a['SITE'] ===
            header['Cabang Asal']
        ) || null;

    }


    /* ========================================================
     * DATA PENGIRIM
     * ========================================================
     */

    const picMengetahui =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['PIC'] || '-'
          )
        : '-';


    const pengirim =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['PENGIRIM'] || '-'
          )
        : '-';


    const pengirimDept =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['DEPT'] || '-'
          )
        : '-';


    const pengirimTlp =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['TLP'] || '-'
          )
        : '-';


    /* ========================================================
     * TANGGAL
     * ========================================================
     */

    const now =
      new Date();


    const tanggalCetak =
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy'
      );


    const jamCetak =
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'HH.mm.ss'
      );


    const tanggalBukti =
      safeFormatDate(
        header['Tanggal'],
        'dd/MM/yyyy'
      );


    /* ========================================================
     * NAMA FILE
     * ========================================================
     */

    const name =
      safeText(
        header['No Surat Jalan'] ||
        idSuratJalan
      )
      .replace(/[\/\\]/g, '-');


    /* ========================================================
     * DOCUMENT
     * ========================================================
     */

    const doc =
      newDoc();


    /* ========================================================
     * QR CODE
     * ========================================================
     */

    const qrValue =
      safeText(
        header['No Surat Jalan'] ||
        idSuratJalan
      );


    const qrBuffer =
      await generateQrCode(
        qrValue
      );


    /* ========================================================
     * META INFO
     * ========================================================
     */

    doc
      .font('Helvetica-Oblique')
      .fontSize(7.5)
      .fillColor('#000')
      .text(
        'Dicetak tanggal : ' +
        tanggalCetak +
        ' - Jam : ' +
        jamCetak +
        ' - Oleh : ' +
        (namaPencetak || '-'),
        CONTENT_X,
        20,
        {
          width: CONTENT_W,
        }
      );


    /* ========================================================
     * KOP
     * ========================================================
     */

    const headerY = 42;


    /* Garis abu-abu */

    doc
      .rect(
        CONTENT_X - 6,
        headerY,
        CONTENT_W + 12,
        8
      )
      .fill('#f0f0f0');


    /* Nama perusahaan */

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('#000')
      .text(
        'PT. SARANA KENCANA MULYA',
        CONTENT_X,
        headerY + 4,
        {
          width: 350,
        }
      );


    /* Nama cabang */

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        namaCabangFn(
          cabangList,
          header['Cabang Asal']
        ),
        CONTENT_X,
        headerY + 20,
        {
          width: 350,
        }
      );


    /* POLYTRON */

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(
        'POLYTRON',
        PAGE_W - 150,
        headerY + 4,
        {
          width: 130,
          align: 'right',
        }
      );


    /* QR */

    doc.image(
      qrBuffer,
      PAGE_W - 92,
      headerY + 20,
      {
        width: 60,
        height: 60,
      }
    );


    /* ========================================================
     * BLOK KEPADA
     * ========================================================
     */

    let kepadaLines: string[] = [
      'Kepada Yth.',
    ];


    if (alamatTujuan) {

      kepadaLines.push(
        safeText(
          alamatTujuan['PIC'] || '-'
        )
      );

      kepadaLines.push(
        safeText(
          alamatTujuan['DEPT'] || ''
        )
      );

      kepadaLines.push(
        safeText(
          alamatTujuan['ALAMAT'] || ''
        )
      );

      kepadaLines.push(
        safeText(
          alamatTujuan['KELURAHAN'] || ''
        )
      );

      kepadaLines.push(
        safeText(
          alamatTujuan['KECAMATAN'] || ''
        )
      );

      kepadaLines.push(
        safeText(
          alamatTujuan['KOTA'] || ''
        )
      );

      kepadaLines.push(
        safeText(
          alamatTujuan['TLP'] || ''
        )
      );

    } else {

      kepadaLines.push(
        namaCabangFn(
          cabangList,
          header['Cabang Tujuan']
        )
      );

    }


    const kepadaText =
      kepadaLines.join('\n');


    const yKepada =
      headerY + 72;


    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#000')
      .text(
        kepadaText,
        CONTENT_X,
        yKepada,
        {
          width: 270,
          lineGap: 1,
        }
      );


    /* ========================================================
     * INFORMASI KANAN
     * ========================================================
     */

    const xInfo = 300;

    let yInfo =
      yKepada;


    const infoRows: Array<
      [string, string]
    > = [

      [
        'Nomor Bukti',
        safeText(
          header['No Surat Jalan']
        ),
      ],

      [
        'Tanggal Bukti',
        tanggalBukti,
      ],

      [
        'Cabang Asal',
        safeText(
          header['Cabang Asal']
        ),
      ],

      [
        'Cabang Tujuan',
        safeText(
          header['Cabang Tujuan']
        ),
      ],

      [
        'Pengirim',
        picMengetahui +
        '\n' +
        pengirimDept +
        '\n' +
        'Telp: ' +
        pengirimTlp,
      ],

    ];


    doc
      .font('Helvetica')
      .fontSize(8.5);


    for (
      const [label, value]
      of infoRows
    ) {

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          label + ' :',
          xInfo,
          yInfo,
          {
            width: 90,
          }
        );


      const labelHeight =
        doc.heightOfString(
          label + ' :',
          {
            width: 90,
          }
        );


      doc
        .text(
          value,
          xInfo + 95,
          yInfo,
          {
            width: 170,
            lineGap: 1,
          }
        );


      const valueHeight =
        doc.heightOfString(
          value,
          {
            width: 170,
            lineGap: 1,
          }
        );


      yInfo +=
        Math.max(
          labelHeight,
          valueHeight
        ) + 4;

    }


    /* ========================================================
     * REMARKS
     * ========================================================
     */

    const remarksY =
      Math.max(
        yKepada +
        doc.heightOfString(
          kepadaText,
          {
            width: 270,
            lineGap: 1,
          }
        ) +
        8,
        yInfo + 4
      );


    doc
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        'Remarks : ' +
        safeText(
          header['Dikirim Via'] || '-'
        ),
        CONTENT_X,
        remarksY,
        {
          width: CONTENT_W,
        }
      );


    /* ========================================================
     * TABEL
     * ========================================================
     */

    const tableX =
      CONTENT_X;


    let tableY =
      remarksY + 22;


    const tableWidth =
      CONTENT_W;


    /*
     * Lebar kolom:
     *
     * No          30
     * Part        80
     * Deskripsi   160
     * Qty         30
     * UM          40
     * Keterangan  90
     * Status      sisa
     */

    const colWidths = [

      30,

      80,

      160,

      30,

      40,

      90,

      tableWidth -
        (
          30 +
          80 +
          160 +
          30 +
          40 +
          90
        ),

    ];


    const headersRow = [

      'No',

      'Part',

      'Deskripsi',

      'Qty',

      'UM',

      'Keterangan',

      'Status',

    ];


    const headerHeight = 20;


    /* ========================================================
     * HEADER TABEL
     * ========================================================
     */

    let x =
      tableX;


    headersRow.forEach(
      (title, i) => {

        doc
          .rect(
            x,
            tableY,
            colWidths[i],
            headerHeight
          )
          .fillAndStroke(
            '#f0f0f0',
            '#000'
          );


        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#000')
          .text(
            title,
            x + 2,
            tableY + 6,
            {
              width:
                colWidths[i] - 4,
              align:
                (
                  i === 0 ||
                  i === 3 ||
                  i === 4
                )
                  ? 'center'
                  : 'left',
            }
          );


        x +=
          colWidths[i];

      }
    );


    tableY +=
      headerHeight;


    /* ========================================================
     * DETAIL TABEL
     * ========================================================
     */

    let totalQty = 0;


    for (
      let idx = 0;
      idx < details.length;
      idx++
    ) {

      const d =
        details[idx];


      totalQty +=
        Number(d.qty) || 0;


      const values = [

        safeText(
          idx + 1
        ),

        safeText(
          d.noBukti || '-'
        ),

        safeText(
          d.deskripsi || ''
        ),

        safeText(
          d.qty ?? ''
        ),

        safeText(
          d.satuan || '-'
        ),

        safeText(
          d.keterangan || '-'
        ),

        safeText(
          d.statusFisik ||
          'Belum Diterima'
        ),

      ];


      /* ------------------------------------------------------
       * HITUNG TINGGI ROW BERDASARKAN ISI
       * ------------------------------------------------------
       */

      const textWidths =
        colWidths.map(
          (w) => w - 8
        );


      const heights =
        values.map(
          (value, i) =>
            textHeight(
              doc,
              value,
              textWidths[i],
              7.5
            )
        );


      /*
       * Minimum 20 pt.
       * Kalau teks panjang maka row akan membesar.
       */

      const rowHeight =
        Math.max(
          20,
          ...heights.map(
            (h) => h + 7
          )
        );


      /* ------------------------------------------------------
       * Jika tidak cukup ruang, buat halaman baru.
       * ------------------------------------------------------
       */

      if (
        tableY + rowHeight >
        PAGE_H - 50
      ) {

        doc.addPage();

        tableY = 30;


        /*
         * Header tabel diulang pada
         * halaman berikutnya.
         */

        x = tableX;


        headersRow.forEach(
          (title, i) => {

            doc
              .rect(
                x,
                tableY,
                colWidths[i],
                headerHeight
              )
              .fillAndStroke(
                '#f0f0f0',
                '#000'
              );


            doc
              .font('Helvetica-Bold')
              .fontSize(7.5)
              .fillColor('#000')
              .text(
                title,
                x + 2,
                tableY + 6,
                {
                  width:
                    colWidths[i] - 4,
                  align:
                    (
                      i === 0 ||
                      i === 3 ||
                      i === 4
                    )
                      ? 'center'
                      : 'left',
                }
              );


            x +=
              colWidths[i];

          }
        );


        tableY +=
          headerHeight;

      }


      /* ------------------------------------------------------
       * GAMBAR ROW
       * ------------------------------------------------------
       */

      x =
        tableX;


      values.forEach(
        (value, i) => {

          const align =
            (
              i === 0 ||
              i === 3 ||
              i === 4
            )
              ? 'center'
              : 'left';


          drawCell(
            doc,
            value,
            x,
            tableY,
            colWidths[i],
            rowHeight,
            {
              align,
            }
          );


          x +=
            colWidths[i];

        }
      );


      tableY +=
        rowHeight;

    }


    /* ========================================================
     * TOTAL
     * ========================================================
     */

    /*
     * Pastikan total tidak menabrak batas halaman.
     */

    if (
      tableY + 25 >
      PAGE_H - 40
    ) {

      doc.addPage();

      tableY = 30;

    }


    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('#000')
      .text(
        'Total',
        tableX,
        tableY + 5,
        {
          width:
            colWidths[0] +
            colWidths[1] +
            colWidths[2],
          align: 'right',
        }
      );


    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(
        String(totalQty),
        tableX +
          colWidths[0] +
          colWidths[1] +
          colWidths[2],
        tableY + 5,
        {
          width: colWidths[3],
          align: 'center',
        }
      );


    /* ========================================================
     * TANDA TANGAN
     * ========================================================
     */

    const namaSopir =
      safeText(
        header['Sopir'] || ''
      );


    const noTruk =
      safeText(
        header['No Truk'] || ''
      );


    const namaPenerima =
      alamatTujuan
        ? safeText(
            alamatTujuan['PIC'] || ''
          )
        : '';


    let sigY =
      tableY + 45;


    /*
     * Jika tanda tangan tidak cukup
     * di halaman sekarang, pindah halaman.
     */

    if (
      sigY + 110 >
      PAGE_H - 20
    ) {

      doc.addPage();

      sigY = 40;

    }


    const sigBoxW =
      (PAGE_W - 40) / 4;


    drawSignature(
      doc,
      'PENGIRIM',
      pengirim,
      'ADM SPAREPART',
      20,
      sigY,
      sigBoxW
    );


    drawSignature(
      doc,
      'MENGETAHUI',
      picMengetahui,
      'HoDS',
      20 + sigBoxW,
      sigY,
      sigBoxW
    );


    drawSignature(
      doc,
      'SOPIR/EKSPEDISI',
      namaSopir,
      noTruk,
      20 + sigBoxW * 2,
      sigY,
      sigBoxW
    );


    drawSignature(
      doc,
      'PENERIMA',
      namaPenerima,
      '',
      20 + sigBoxW * 3,
      sigY,
      sigBoxW
    );


    /* ========================================================
     * END PDF
     * ========================================================
     */

    doc.end();


    const buffer =
      await collect(doc);


    return {

      success: true,

      base64:
        buffer.toString('base64'),

      filename:
        'SuratJalan_' +
        name +
        '.pdf',

    };


  } catch (e: any) {

    return {

      success: false,

      message:
        'Gagal membuat PDF: ' +
        (
          e?.message ||
          String(e)
        ),

    };

  }

}


/* ============================================================
 * BUAT PDF PENERIMAAN EKSTERNAL
 * ============================================================
 */

export async function buatPdfPenerimaanEksternal(
  id: string
): Promise<any> {

  try {

    /* ========================================================
     * DATA
     * ========================================================
     */

    const result =
      await getPenerimaanEksternalDetail(
        id
      );


    if (!result.success) {

      return result;

    }


    const h =
      result.header;


    const items =
      result.items;


    const tanggalFormatted =
      safeFormatDate(
        h.tanggal,
        'dd/MM/yyyy'
      );


    /* ========================================================
     * DOCUMENT
     * ========================================================
     */

    const doc =
      newDoc();


    /* ========================================================
     * JUDUL
     * ========================================================
     */

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#000')
      .text(
        'PENERIMAAN EKSTERNAL',
        {
          align: 'center',
        }
      );


    doc
      .font('Helvetica')
      .fontSize(10)
      .text(
        'No. Surat Jalan: ' +
        safeText(
          h.noSuratJalan || ''
        ),
        {
          align: 'center',
        }
      )
      .moveDown(1);


    /* ========================================================
     * INFORMASI
     * ========================================================
     */

    const rows: Array<
      [string, string]
    > = [

      [
        'Sumber',
        safeText(
          h.rms || ''
        ),
      ],

      [
        'Tanggal',
        tanggalFormatted,
      ],

      [
        'No. Truk',
        safeText(
          h.noTruk || '-'
        ),
      ],

      [
        'Kurir / Sopir',
        safeText(
          h.kurir || '-'
        ),
      ],

      [
        'Diterima Oleh',
        safeText(
          h.diterimaOleh || ''
        ),
      ],

    ];


    rows.forEach(
      ([label, value]) => {

        doc
          .font('Helvetica')
          .fontSize(9)
          .text(
            label +
            ' : ' +
            value,
            30,
            doc.y,
            {
              width: 400,
            }
          )
          .moveDown(0.3);

      }
    );


    /* ========================================================
     * TABEL
     * ========================================================
     */

    doc.moveDown(0.5);


    let tableY =
      doc.y;


    const tableX =
      30;


    const tableWidth =
      PAGE_W - 60;


    const colWidths = [

      50,

      60,

      150,

      40,

      50,

      80,

      tableWidth -
        (
          50 +
          60 +
          150 +
          40 +
          50 +
          80
        ),

    ];


    const headersRow = [

      'No',

      'No Bukti',

      'Deskripsi',

      'Qty',

      'Satuan',

      'Keterangan',

      'Status',

    ];


    const headerHeight = 20;


    /* ========================================================
     * HEADER TABEL
     * ========================================================
     */

    let x =
      tableX;


    headersRow.forEach(
      (title, i) => {

        doc
          .rect(
            x,
            tableY,
            colWidths[i],
            headerHeight
          )
          .fillAndStroke(
            '#f0f0f0',
            '#000'
          );


        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#000')
          .text(
            title,
            x + 2,
            tableY + 6,
            {
              width:
                colWidths[i] - 4,
              align:
                (
                  i === 0 ||
                  i === 3
                )
                  ? 'center'
                  : 'left',
            }
          );


        x +=
          colWidths[i];

      }
    );


    tableY +=
      headerHeight;


    /* ========================================================
     * ITEM
     * ========================================================
     */

    for (
      let idx = 0;
      idx < items.length;
      idx++
    ) {

      const it =
        items[idx];


      const values = [

        safeText(
          it.no ||
          idx + 1
        ),

        safeText(
          it.noBukti || '-'
        ),

        safeText(
          it.deskripsi || ''
        ),

        safeText(
          it.qty ?? ''
        ),

        safeText(
          it.satuan || ''
        ),

        safeText(
          it.keterangan || '-'
        ),

        safeText(
          it.statusFisik || '-'
        ),

      ];


      /* Hitung tinggi */

      const heights =
        values.map(
          (value, i) =>
            textHeight(
              doc,
              value,
              colWidths[i] - 8,
              7.5
            )
        );


      const rowHeight =
        Math.max(
          20,
          ...heights.map(
            (h) => h + 7
          )
        );


      /* Halaman baru */

      if (
        tableY + rowHeight >
        PAGE_H - 50
      ) {

        doc.addPage();

        tableY = 30;


        /* Header ulang */

        x = tableX;


        headersRow.forEach(
          (title, i) => {

            doc
              .rect(
                x,
                tableY,
                colWidths[i],
                headerHeight
              )
              .fillAndStroke(
                '#f0f0f0',
                '#000'
              );


            doc
              .font('Helvetica-Bold')
              .fontSize(7.5)
              .fillColor('#000')
              .text(
                title,
                x + 2,
                tableY + 6,
                {
                  width:
                    colWidths[i] - 4,
                  align:
                    (
                      i === 0 ||
                      i === 3
                    )
                      ? 'center'
                      : 'left',
                }
              );


            x +=
              colWidths[i];

          }
        );


        tableY +=
          headerHeight;

      }


      /* Gambar row */

      x =
        tableX;


      values.forEach(
        (value, i) => {

          drawCell(
            doc,
            value,
            x,
            tableY,
            colWidths[i],
            rowHeight,
            {
              align:
                (
                  i === 0 ||
                  i === 3
                )
                  ? 'center'
                  : 'left',
            }
          );


          x +=
            colWidths[i];

        }
      );


      tableY +=
        rowHeight;

    }


    /* ========================================================
     * TANDA TANGAN
     * ========================================================
     */

    let sigY =
      tableY + 60;


    if (
      sigY + 80 >
      PAGE_H - 20
    ) {

      doc.addPage();

      sigY = 40;

    }


    const sigBoxW =
      (PAGE_W - 40) / 3;


    const titles = [

      'Dikirim Oleh',

      'Diterima Oleh',

      'Mengetahui',

    ];


    titles.forEach(
      (title, i) => {

        const x =
          20 +
          i * sigBoxW;


        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#000')
          .text(
            title,
            x,
            sigY,
            {
              width: sigBoxW,
              align: 'center',
            }
          );


        doc
          .moveTo(
            x +
              sigBoxW / 2 -
              45,
            sigY + 50
          )
          .lineTo(
            x +
              sigBoxW / 2 +
              45,
            sigY + 50
          )
          .stroke();

      }
    );


    /* ========================================================
     * END
     * ========================================================
     */

    doc.end();


    const buffer =
      await collect(doc);


    const filename =
      'PenerimaanEksternal_' +
      safeText(
        h.noSuratJalan ||
        id
      ).replace(
        /[\/\\]/g,
        '-'
      ) +
      '.pdf';


    return {

      success: true,

      base64:
        buffer.toString('base64'),

      filename,

    };


  } catch (e: any) {

    return {

      success: false,

      message:
        'Gagal membuat PDF: ' +
        (
          e?.message ||
          String(e)
        ),

    };

  }

}
