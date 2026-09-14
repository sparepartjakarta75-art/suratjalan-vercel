/**
 * ============================================================
 * PDF.TS — Cetak Surat Jalan & Penerimaan Eksternal ke PDF
 * ============================================================
 * Port dari CetakPDF.gs:
 * - Menggunakan PDFKit, bukan HtmlService
 * - Cocok untuk runtime Node.js / Vercel
 * - Mempertahankan template Surat Jalan:
 *   meta info, kop perusahaan, POLYTRON + QR code,
 *   blok Kepada Yth, detail surat jalan,
 *   tabel barang, Total, dan 4 tanda tangan.
 * ============================================================
 */

import PDFDocument from 'pdfkit';

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
 * KONSTANTA
 * ============================================================
 */

const PAGE_W = 595.28; // A4 portrait — points
const PAGE_H = 841.89;


/* ============================================================
 * PDF DOCUMENT
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
  });
}


/* ============================================================
 * COLLECT PDF BUFFER
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
 * HELPER CABANG
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
    ? found['Nama Cabang']
    : kode;
}


/* ============================================================
 * HELPER TEXT
 * ============================================================
 */

function safeText(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}


/* ============================================================
 * HELPER DRAW TABLE BORDER
 * ============================================================
 */

function drawTableRow(
  doc: PDFDocument,
  x: number,
  y: number,
  widths: number[],
  height: number
) {
  let currentX = x;

  for (const width of widths) {
    doc.rect(
      currentX,
      y,
      width,
      height
    ).stroke();

    currentX += width;
  }
}


/* ============================================================
 * CETAK SURAT JALAN
 * ============================================================
 */

export async function buatPdfSuratJalan(
  idSuratJalan: string,
  namaPencetak: string
): Promise<any> {

  try {

    /* --------------------------------------------------------
     * AMBIL DATA
     * --------------------------------------------------------
     */

    const header =
      await ambilHeaderById_(idSuratJalan);

    if (!header) {
      return {
        success: false,
        message: 'Data surat jalan tidak ditemukan.',
      };
    }


    const details =
      await getDetailSuratJalan(idSuratJalan);


    const cabangList =
      await getCabangList();


    const alamatData =
      await getAlamatRef();


    /* --------------------------------------------------------
     * ALAMAT TUJUAN
     * --------------------------------------------------------
     */

    let alamatTujuan: any = null;

    if (header['Tujuan Akhir']) {

      alamatTujuan =
        alamatData.find(
          (a) =>
            a['SITE'] === header['Tujuan Akhir']
        ) || null;
    }


    if (
      !alamatTujuan &&
      header['Cabang Tujuan']
    ) {

      alamatTujuan =
        alamatData.find(
          (a) =>
            a['SITE'] === header['Cabang Tujuan']
        ) || null;
    }


    /* --------------------------------------------------------
     * ALAMAT CABANG ASAL
     * --------------------------------------------------------
     */

    let alamatCabangAsal: any = null;

    if (header['Cabang Asal']) {

      alamatCabangAsal =
        alamatData.find(
          (a) =>
            a['SITE'] === header['Cabang Asal']
        ) || null;
    }


    const picMengetahui =
      alamatCabangAsal
        ? alamatCabangAsal['PIC'] || '-'
        : '-';


    const pengirim =
      alamatCabangAsal
        ? alamatCabangAsal['PENGIRIM'] || '-'
        : '-';


    const pengirimDept =
      alamatCabangAsal
        ? alamatCabangAsal['DEPT'] || '-'
        : '-';


    const pengirimTlp =
      alamatCabangAsal
        ? alamatCabangAsal['TLP'] || '-'
        : '-';


    /* --------------------------------------------------------
     * TANGGAL
     * --------------------------------------------------------
     */

    const now = new Date();

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


    /* --------------------------------------------------------
     * DOCUMENT
     * --------------------------------------------------------
     */

    const doc = newDoc();


    const name =
      String(
        header['No Surat Jalan'] ||
        idSuratJalan
      ).replace(/\//g, '-');


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
        20,
        22,
        {
          width: PAGE_W - 40,
        }
      );


    /* ========================================================
     * KOP / HEADER
     * ========================================================
     */

    const boxY = 40;

    doc
      .rect(
        14,
        boxY,
        PAGE_W - 28,
        8
      )
      .fill('#f0f0f0');


    doc
      .fillColor('#000')
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(
        'PT. SARANA KENCANA MULYA',
        20,
        boxY + 4,
        {
          width: PAGE_W - 160,
        }
      );


    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(
        namaCabangFn(
          cabangList,
          header['Cabang Asal']
        ),
        20,
        boxY + 22,
        {
          width: PAGE_W - 160,
        }
      );


    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(
        'POLYTRON',
        0,
        boxY + 4,
        {
          align: 'right',
          width: PAGE_W - 40,
        }
      );


    /* ========================================================
     * QR CODE
     * ========================================================
     *
     * PDFKit tidak melakukan download gambar QR secara
     * otomatis seperti HTML <img>.
     *
     * Jika URL QR tersedia sebagai data/image buffer dari
     * runtime Anda, bagian ini dapat diaktifkan.
     *
     * Untuk saat ini nomor surat jalan tetap ditampilkan
     * sebagai informasi QR.
     * ========================================================
     */

    const qrText =
      safeText(header['No Surat Jalan']);


    doc
      .font('Helvetica')
      .fontSize(7)
      .text(
        'QR: ' + qrText,
        PAGE_W - 150,
        boxY + 24,
        {
          width: 125,
          align: 'right',
        }
      );


    /* ========================================================
     * KEPADA YTH
     * ========================================================
     */

    let kepada = 'Kepada Yth.\n';


    if (alamatTujuan) {

      kepada +=
        safeText(alamatTujuan['PIC'] || '-') +
        '\n';

      kepada +=
        safeText(alamatTujuan['DEPT'] || '') +
        '\n';

      kepada +=
        safeText(alamatTujuan['ALAMAT'] || '') +
        '\n';

      kepada +=
        safeText(alamatTujuan['KELURAHAN'] || '') +
        '\n';

      kepada +=
        safeText(alamatTujuan['KECAMATAN'] || '') +
        '\n';

      kepada +=
        safeText(alamatTujuan['KOTA'] || '') +
        '\n';

      kepada +=
        safeText(alamatTujuan['TLP'] || '');

    } else {

      kepada +=
        namaCabangFn(
          cabangList,
          header['Cabang Tujuan']
        );
    }


    const yKepada = 90;


    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#000')
      .text(
        kepada,
        20,
        yKepada,
        {
          width: 260,
          lineGap: 1,
        }
      );


    /* ========================================================
     * INFORMASI SURAT JALAN
     * ========================================================
     */

    const infoRows: Array<[string, string]> = [

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
        '\nTelp: ' +
        pengirimTlp,
      ],

    ];


    const xInfo = 300;

    let yInfo = 90;


    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#000');


    for (
      const [label, value]
      of infoRows
    ) {

      doc
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
            width: 150,
          }
        );


      const valHeight =
        doc.heightOfString(
          value,
          {
            width: 150,
          }
        );


      yInfo +=
        Math.max(
          labelHeight,
          valHeight
        ) + 4;
    }


    /* ========================================================
     * REMARKS
     * ========================================================
     */

    const remarksY =
      Math.max(
        yInfo + 8,
        180
      );


    doc
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        'Remarks : ' +
        safeText(
          header['Dikirim Via'] || '-'
        ),
        20,
        remarksY,
        {
          width: PAGE_W - 40,
        }
      );


    /* ========================================================
     * TABEL BARANG
     * ========================================================
     */

    const tableTop =
      remarksY + 22;


    const tableX = 20;

    const tableWidth =
      PAGE_W - 40;


    /*
     * Lebar kolom:
     *
     * No
     * Part
     * Deskripsi
     * Qty
     * UM
     * Keterangan
     * Status
     */

    const widths = [
      30,
      78,
      160,
      30,
      40,
      80,
      tableWidth - (
        30 +
        78 +
        160 +
        30 +
        40 +
        80
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


    const rowH = 18;


    /* --------------------------------------------------------
     * HEADER TABEL
     * --------------------------------------------------------
     */

    let currentX = tableX;


    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor('#000');


    headersRow.forEach(
      (headerText, i) => {

        doc
          .rect(
            currentX,
            tableTop,
            widths[i],
            rowH
          )
          .fillAndStroke(
            '#f0f0f0',
            '#000'
          );


        doc
          .fillColor('#000')
          .text(
            headerText,
            currentX + 2,
            tableTop + 5,
            {
              width: widths[i] - 4,
              align:
                i === 0 ||
                i === 3 ||
                i === 4
                  ? 'center'
                  : 'left',
            }
          );


        currentX += widths[i];
      }
    );


    /* --------------------------------------------------------
     * ISI TABEL
     * --------------------------------------------------------
     */

    let yRow =
      tableTop + rowH;


    let totalQty = 0;


    doc
      .font('Helvetica')
      .fontSize(7.5);


    details.forEach(
      (d: any, idx: number) => {

        const qtyNum =
          Number(d.qty) || 0;


        totalQty += qtyNum;


        const values = [

          String(idx + 1),

          String(
            d.noBukti || '-'
          ),

          String(
            d.deskripsi || ''
          ),

          String(
            d.qty ?? ''
          ),

          String(
            d.satuan || '-'
          ),

          String(
            d.keterangan || '-'
          ),

          String(
            d.statusFisik ||
            'Belum Diterima'
          ),

        ];


        currentX = tableX;


        values.forEach(
          (value, i) => {

            doc
              .rect(
                currentX,
                yRow,
                widths[i],
                rowH
              )
              .stroke();


            doc
              .fillColor('#000')
              .text(
                value,
                currentX + 2,
                yRow + 4,
                {
                  width:
                    widths[i] - 4,
                  height:
                    rowH - 4,
                  align:
                    i === 0 ||
                    i === 3 ||
                    i === 4
                      ? 'center'
                      : 'left',
                  ellipsis: true,
                }
              );


            currentX +=
              widths[i];
          }
        );


        yRow += rowH;
      }
    );


    /* ========================================================
     * TOTAL
     * ========================================================
     */

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5);


    doc
      .text(
        'Total',
        tableX,
        yRow + 5,
        {
          width:
            widths[0] +
            widths[1] +
            widths[2],
          align: 'right',
        }
      );


    doc
      .text(
        String(totalQty),
        tableX +
          widths[0] +
          widths[1] +
          widths[2],
        yRow + 5,
        {
          width: widths[3],
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


    const sigY =
      yRow + 40;


    const boxW =
      (PAGE_W - 40) / 4;


    const sigs: Array<
      [string, string, string]
    > = [

      [
        'PENGIRIM',
        pengirim,
        'ADM SPAREPART',
      ],

      [
        'MENGETAHUI',
        picMengetahui,
        'HoDS',
      ],

      [
        'SOPIR/EKSPEDISI',
        namaSopir,
        noTruk,
      ],

      [
        'PENERIMA',
        namaPenerima,
        '',
      ],

    ];


    sigs.forEach(
      (
        signature,
        i
      ) => {

        const x =
          20 +
          i * boxW;


        /* Judul */

        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(
            signature[0],
            x,
            sigY,
            {
              width: boxW,
              align: 'center',
            }
          );


        /* Area tanda tangan */

        doc
          .font('Helvetica')
          .fontSize(8)
          .text(
            signature[1] || '-',
            x,
            sigY + 65,
            {
              width: boxW,
              align: 'center',
            }
          );


        /* Keterangan */

        doc
          .font('Helvetica-Oblique')
          .fontSize(7)
          .text(
            signature[2],
            x,
            sigY + 78,
            {
              width: boxW,
              align: 'center',
            }
          );


        /* Garis tanda tangan */

        doc
          .moveTo(
            x +
              boxW / 2 -
              40,
            sigY + 88
          )
          .lineTo(
            x +
              boxW / 2 +
              40,
            sigY + 88
          )
          .stroke();

      }
    );


    /* ========================================================
     * SELESAI PDF
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
        e.message,

    };

  }

}


/* ============================================================
 * CETAK PENERIMAAN EKSTERNAL
 * ============================================================
 */

export async function buatPdfPenerimaanEksternal(
  id: string
): Promise<any> {

  try {

    const result =
      await getPenerimaanEksternalDetail(id);


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


    const doc =
      newDoc();


    /* --------------------------------------------------------
     * JUDUL
     * --------------------------------------------------------
     */

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
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


    /* --------------------------------------------------------
     * INFORMASI
     * --------------------------------------------------------
     */

    const rows: Array<
      [string, string]
    > = [

      [
        'Sumber',
        safeText(h.rms || ''),
      ],

      [
        'Tanggal',
        tanggalFormatted,
      ],

      [
        'No. Truk',
        safeText(h.noTruk || '-'),
      ],

      [
        'Kurir / Sopir',
        safeText(h.kurir || '-'),
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
            label + ' : ' + value,
            30,
            doc.y,
            {
              width: 400,
            }
          )
          .moveDown(0.3);

      }
    );


    /* --------------------------------------------------------
     * TABEL
     * --------------------------------------------------------
     */

    doc.moveDown(0.5);


    const tableTop =
      doc.y;


    const tableX = 30;


    const tableWidth =
      PAGE_W - 60;


    const colWidths = [

      60,
      60,
      150,
      40,
      50,
      80,
      tableWidth -
        (
          60 +
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


    const rowH = 16;


    /* --------------------------------------------------------
     * HEADER TABEL
     * --------------------------------------------------------
     */

    let currentX =
      tableX;


    doc
      .font('Helvetica-Bold')
      .fontSize(7.5);


    headersRow.forEach(
      (headerText, i) => {

        doc
          .rect(
            currentX,
            tableTop,
            colWidths[i],
            rowH
          )
          .fillAndStroke(
            '#f0f0f0',
            '#000'
          );


        doc
          .fillColor('#000')
          .text(
            headerText,
            currentX + 2,
            tableTop + 4,
            {
              width:
                colWidths[i] - 4,
              align:
                i === 0 ||
                i === 3
                  ? 'center'
                  : 'left',
            }
          );


        currentX +=
          colWidths[i];
      }
    );


    /* --------------------------------------------------------
     * DATA
     * --------------------------------------------------------
     */

    let yRow =
      tableTop + rowH;


    doc
      .font('Helvetica')
      .fontSize(7.5);


    items.forEach(
      (it: any) => {

        const values = [

          safeText(
            it.no || ''
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


        currentX =
          tableX;


        values.forEach(
          (value, i) => {

            doc
              .rect(
                currentX,
                yRow,
                colWidths[i],
                rowH
              )
              .stroke();


            doc
              .fillColor('#000')
              .text(
                value,
                currentX + 2,
                yRow + 4,
                {
                  width:
                    colWidths[i] - 4,
                  height:
                    rowH - 4,
                  align:
                    i === 0 ||
                    i === 3
                      ? 'center'
                      : 'left',
                  ellipsis: true,
                }
              );


            currentX +=
              colWidths[i];
          }
        );


        yRow += rowH;

      }
    );


    /* ========================================================
     * TANDA TANGAN
     * ========================================================
     */

    const sigY =
      yRow + 60;


    const boxW =
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
          i * boxW;


        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(
            title,
            x,
            sigY,
            {
              width: boxW,
              align: 'center',
            }
          );


        doc
          .moveTo(
            x +
              boxW / 2 -
              45,
            sigY + 50
          )
          .lineTo(
            x +
              boxW / 2 +
              45,
            sigY + 50
          )
          .stroke();

      }
    );


    /* --------------------------------------------------------
     * SELESAI
     * --------------------------------------------------------
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
        e.message,

    };

  }

}
