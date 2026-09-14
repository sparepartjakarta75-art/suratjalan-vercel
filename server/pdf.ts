/**
 * ============================================================
 * server/pdf.ts
 * ============================================================
 *
 * PDF Surat Jalan menggunakan PDFKit + QRCode
 *
 * Layout mengikuti PDF contoh:
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ Dicetak tanggal ...                         │
 * ├─────────────────────────────────────────────────────────┤
 * │ PT. SARANA KENCANA MULYA                  POLYTRON      │
 * │ JAKARTA                                   [ QR ]        │
 * │                                                         │
 * │ Kepada Yth.                    Nomor Surat Jalan : ...  │
 * │ BP. SUJARWO                    Tanggal Bukti    : ...  │
 * │ Polytron - TGR                  Cabang Asal      : ...  │
 * │ ...                             Cabang Tujuan    : ...  │
 * │                                 Pengirim         : ...  │
 * │                                                         │
 * │ Remarks : ...                                           │
 * │                                                         │
 * │ No | Part | Deskripsi | Qty | UM | Keterangan | Status │
 * │ ...                                                     │
 * │ Total                                      77          │
 * │                                                         │
 * │ PENGIRIM   MENGETAHUI   SOPIR/EKSPEDISI    PENERIMA    │
 * │                                                         │
 * │ nama          nama           -             nama        │
 * │ jabatan       jabatan                                    │
 * └─────────────────────────────────────────────────────────┘
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

import {
  Utilities,
  Session,
} from './sheets.js';


/* ============================================================
 * TYPE
 * ============================================================
 *
 * Menggunakan any untuk instance PDFKit supaya tidak terkena
 * error:
 *
 * TS2749:
 * 'PDFDocument' refers to a value, but is being used as a type
 *
 * ============================================================
 */

type PdfDoc = any;


/* ============================================================
 * UKURAN A4
 * ============================================================
 */

const PAGE_W = 595.28;
const PAGE_H = 841.89;


/* ============================================================
 * POSISI KOTAK UTAMA
 * ============================================================
 */

const OUTER_X = 14;
const OUTER_Y = 15;

const OUTER_W = PAGE_W - 28;
const OUTER_H = PAGE_H - 30;


/* ============================================================
 * AREA KONTEN
 * ============================================================
 */

const CONTENT_X = 20;
const CONTENT_W = PAGE_W - 40;


/* ============================================================
 * FONT
 * ============================================================
 */

const FONT_NORMAL = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';


/* ============================================================
 * PDF DOCUMENT
 * ============================================================
 */

function newDoc(): PdfDoc {

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
 * COLLECT BUFFER
 * ============================================================
 */

function collect(
  doc: PdfDoc
): Promise<Buffer> {

  return new Promise(
    (resolve, reject) => {

      const chunks: Buffer[] = [];

      doc.on(
        'data',
        (chunk: Buffer) => {
          chunks.push(chunk);
        }
      );

      doc.on(
        'end',
        () => {
          resolve(
            Buffer.concat(chunks)
          );
        }
      );

      doc.on(
        'error',
        reject
      );

    }
  );

}


/* ============================================================
 * SAFE TEXT
 * ============================================================
 */

function safeText(
  value: any
): string {

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
  kode: any
): string {

  const key =
    safeText(kode);

  const found =
    cabangList.find(
      (c: any) =>
        safeText(c['Kode']) === key
    );

  if (found) {

    return safeText(
      found['Nama Cabang']
    ) || key;

  }

  return key;

}


/* ============================================================
 * HEIGHT TEXT
 * ============================================================
 */

function getTextHeight(
  doc: PdfDoc,
  text: string,
  width: number,
  fontSize: number
): number {

  doc
    .font(FONT_NORMAL)
    .fontSize(fontSize);

  return doc.heightOfString(
    text || '',
    {
      width,
      lineGap: 0,
    }
  );

}


/* ============================================================
 * DRAW CELL
 * ============================================================
 */

function drawCell(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  align: 'left' | 'center' | 'right' = 'left',
  bold = false
) {

  /* Border */

  doc
    .lineWidth(0.75)
    .rect(
      x,
      y,
      width,
      height
    )
    .stroke();


  /* Font */

  doc
    .font(
      bold
        ? FONT_BOLD
        : FONT_NORMAL
    )
    .fontSize(7.5)
    .fillColor('#000');


  /*
   * FIX: teks sebelumnya selalu ditempel di posisi tetap
   * (y + 5) dari atas sel, jadi kalau tingginya baris
   * ditentukan oleh sel lain yang isinya lebih panjang
   * (mis. kolom "Keterangan" 3 baris), sel-sel lain yang
   * isinya cuma 1 baris jadi terlihat menempel ke atas
   * dengan banyak ruang kosong di bawahnya. Sekarang tinggi
   * teks dihitung dulu, lalu teks diposisikan rata tengah
   * secara vertikal di dalam sel (rata atas-bawah).
   */

  const innerWidth =
    width - 8;

  const textHeight =
    doc.heightOfString(
      text || '',
      {
        width: innerWidth,
        lineGap: 0,
      }
    );

  const verticalOffset =
    Math.max(
      4,
      (
        height -
        textHeight
      ) / 2
    );


  /* Text */

  doc.text(
    text || '',
    x + 4,
    y + verticalOffset,
    {
      width: innerWidth,

      align,

      lineGap: 0,

      continued: false,
    }
  );

}


/* ============================================================
 * DRAW TABLE HEADER
 * ============================================================
 */

function drawTableHeader(
  doc: PdfDoc,
  x: number,
  y: number,
  widths: number[]
): number {

  const height = 20;

  const titles = [
    'No',
    'Part',
    'Deskripsi',
    'Qty',
    'UM',
    'Keterangan',
    'Status',
  ];


  let currentX = x;


  titles.forEach(
    (
      title,
      index
    ) => {

      /*
       * Background header.
       */

      doc
        .lineWidth(0.75)
        .rect(
          currentX,
          y,
          widths[index],
          height
        )
        .fillAndStroke(
          '#eeeeee',
          '#000000'
        );


      /*
       * Text header.
       */

      doc
        .font(FONT_NORMAL)
        .fontSize(7.5)
        .fillColor('#000');


      const align =
        (
          index === 0 ||
          index === 3 ||
          index === 4
        )
          ? 'center'
          : 'center';


      doc.text(
        title,
        currentX + 2,
        y + 6,
        {
          width:
            widths[index] - 4,

          align,

          lineGap: 0,
        }
      );


      currentX +=
        widths[index];

    }
  );


  return height;

}


/* ============================================================
 * DRAW OUTER BOX
 * ============================================================
 */

function drawOuterBox(
  doc: PdfDoc
) {

  doc
    .lineWidth(0.75)
    .rect(
      OUTER_X,
      OUTER_Y,
      OUTER_W,
      OUTER_H
    )
    .stroke();

}


/* ============================================================
 * GENERATE QR
 * ============================================================
 */

async function generateQr(
  value: string
): Promise<Buffer> {

  return await QRCode.toBuffer(
    value,
    {
      type: 'png',

      width: 180,

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
  doc: PdfDoc,
  title: string,
  name: string,
  description: string,
  x: number,
  y: number,
  width: number
) {

  /*
   * FIX: jarak antara judul (PENGIRIM/MENGETAHUI/...) dan
   * nama di bawahnya sebelumnya 76pt (ruang tanda tangan
   * terlalu longgar). Sekarang dipersempit jadi 45pt, tetap
   * menyisakan ruang untuk tanda tangan asli tapi tidak
   * sebesar sebelumnya.
   */

  const nameOffset = 45;
  const descOffset = 58;
  const lineOffset = 70;


  /*
   * TITLE
   */

  doc
    .font(FONT_BOLD)
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


  /*
   * NAME
   */

  if (name) {

    doc
      .font(FONT_BOLD)
      .fontSize(8)
      .text(
        name,
        x,
        y + nameOffset,
        {
          width,
          align: 'center',
        }
      );

  }


  /*
   * DESCRIPTION
   */

  if (description) {

    doc
      .font(FONT_ITALIC)
      .fontSize(7)
      .text(
        description,
        x,
        y + descOffset,
        {
          width,
          align: 'center',
        }
      );

  }


  /*
   * SIGNATURE LINE
   */

  doc
    .lineWidth(0.75)
    .moveTo(
      x + width / 2 - 43,
      y + lineOffset
    )
    .lineTo(
      x + width / 2 + 43,
      y + lineOffset
    )
    .stroke();

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
     * AMBIL HEADER
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
     * DATA CABANG
     * ========================================================
     */

    const cabangList =
      await getCabangList();


    /* ========================================================
     * DATA ALAMAT
     * ========================================================
     */

    const alamatData =
      await getAlamatRef();


    /* ========================================================
     * ALAMAT TUJUAN
     * ========================================================
     */

    let alamatTujuan: any = null;


    if (
      header['Tujuan Akhir']
    ) {

      alamatTujuan =
        alamatData.find(
          (a: any) =>
            safeText(a['SITE']) ===
            safeText(
              header['Tujuan Akhir']
            )
        ) || null;

    }


    if (
      !alamatTujuan &&
      header['Cabang Tujuan']
    ) {

      alamatTujuan =
        alamatData.find(
          (a: any) =>
            safeText(a['SITE']) ===
            safeText(
              header['Cabang Tujuan']
            )
        ) || null;

    }


    /* ========================================================
     * ALAMAT ASAL
     * ========================================================
     */

    let alamatCabangAsal: any = null;


    if (
      header['Cabang Asal']
    ) {

      alamatCabangAsal =
        alamatData.find(
          (a: any) =>
            safeText(a['SITE']) ===
            safeText(
              header['Cabang Asal']
            )
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


    /*
     * FIX: nilai yang tampil pada baris "Pengirim" di blok
     * info kanan sekarang diambil dari field PIC cabang asal
     * (sama seperti yang dipakai untuk "MENGETAHUI"), bukan
     * dari field PENGIRIM lagi.
     */

    const pengirim =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['PIC'] || '-'
          )
        : '-';


    const pengirimDept =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['DEPT'] || ''
          )
        : '';


    const pengirimTlp =
      alamatCabangAsal
        ? safeText(
            alamatCabangAsal['TLP'] || ''
          )
        : '';


    /* ========================================================
     * TANGGAL
     * ========================================================
     */

    const now =
      new Date();


    const timezone =
      Session.getScriptTimeZone();


    const tanggalCetak =
      Utilities.formatDate(
        now,
        timezone,
        'dd/MM/yyyy'
      );


    /*
     * FIX: "Jam" tercetak literal "HH.mm.ss" (bukan jam
     * sebenarnya) karena shim Utilities.formatDate yang
     * dipakai di sini rupanya tidak menerjemahkan pola jam
     * dengan benar. Untuk menghindari ketergantungan pada
     * shim tersebut, jam dihitung manual dari objek Date
     * sesuai timezone, lalu di-pad ke 2 digit sendiri.
     */

    const jamFormatter =
      new Intl.DateTimeFormat(
        'en-GB',
        {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }
      );

    const jamParts =
      jamFormatter.formatToParts(now);

    const getJamPart =
      (type: string) =>
        jamParts.find(
          (p) => p.type === type
        )?.value || '00';

    const jamCetak =
      getJamPart('hour') +
      '.' +
      getJamPart('minute') +
      '.' +
      getJamPart('second');


    const tanggalBukti =
      safeFormatDate(
        header['Tanggal'],
        'dd/MM/yyyy'
      );


    /* ========================================================
     * NO SURAT JALAN
     * ========================================================
     */

    const noSuratJalan =
      safeText(
        header['No Surat Jalan'] ||
        header['No SuratJalan'] ||
        header['No Bukti'] ||
        idSuratJalan
      );


    /* ========================================================
     * QR CODE
     * ========================================================
     *
     * QR menggunakan nomor surat jalan.
     */

    const qrBuffer =
      await generateQr(
        noSuratJalan
      );


    /* ========================================================
     * DOCUMENT
     * ========================================================
     */

    const doc =
      newDoc();


    /* ========================================================
     * OUTER BOX
     * ========================================================
     *
     * FIX: border luar TIDAK digambar di sini lagi. Sebelumnya
     * border langsung digambar penuh setinggi halaman A4 di
     * awal, sehingga surat jalan yang isinya pendek (mis. 1-2
     * baris part) menyisakan kotak kosong yang besar di bawah
     * blok tanda tangan. Sekarang border halaman terakhir baru
     * digambar di akhir, setelah tinggi konten sebenarnya
     * diketahui (lihat bagian "BORDER HALAMAN TERAKHIR" dekat
     * doc.end()). Border penuh tetap dipakai untuk
     * halaman-halaman sebelumnya kalau tabel meluber ke
     * halaman baru (lihat pengecekan overflow di bawah).
     */


    /* ========================================================
     * META BAR
     * ========================================================
     */

    doc
      .font(FONT_ITALIC)
      .fontSize(7.5)
      .fillColor('#000')
      .text(
        'Dicetak tanggal : ' +
        tanggalCetak +
        ' - Jam : ' +
        jamCetak +
        ' - Oleh : ' +
        (
          namaPencetak ||
          '-'
        ),
        20,
        20,
        {
          width:
            CONTENT_W,
        }
      );


    /*
     * Garis bawah meta.
     */

    doc
      .moveTo(
        OUTER_X,
        38
      )
      .lineTo(
        OUTER_X + OUTER_W,
        38
      )
      .stroke();


    /* ========================================================
     * KOP
     * ========================================================
     */

    const kopY = 42;


    /*
     * Nama perusahaan.
     */

    doc
      .font(FONT_BOLD)
      .fontSize(13)
      .fillColor('#000')
      .text(
        'PT. SARANA KENCANA MULYA',
        CONTENT_X,
        kopY,
        {
          width: 350,
        }
      );


    /*
     * Cabang.
     *
     * FIX: font & ukuran disamakan dengan nama perusahaan
     * (FONT_BOLD, 13pt) — sebelumnya lebih kecil (10pt).
     */

    doc
      .font(FONT_BOLD)
      .fontSize(13)
      .text(
        namaCabangFn(
          cabangList,
          header['Cabang Asal']
        ),
        CONTENT_X,
        kopY + 17,
        {
          width: 350,
        }
      );


    /*
     * POLYTRON.
     */

    doc
      .font(FONT_BOLD)
      .fontSize(13)
      .text(
        'POLYTRON',
        PAGE_W - 165,
        kopY,
        {
          width: 145,
          align: 'right',
        }
      );


    /*
     * QR CODE.
     *
     * Ukuran dibuat kecil agar sama dengan contoh.
     */

    doc.image(
      qrBuffer,
      PAGE_W - 82,
      kopY + 18,
      {
        width: 54,
        height: 54,
      }
    );


    /* ========================================================
     * BLOK KEPADA
     * ========================================================
     *
     * FIX: nama PIC sebelumnya digambar 2x (sekali sebagai
     * bagian dari kepadaText biasa, sekali lagi di-bold-kan
     * menimpa posisi yang sama) sehingga terlihat dobel /
     * seperti coretan (strikethrough) pada PDF. Sekarang PIC
     * name hanya digambar SEKALI, langsung dengan font bold,
     * lalu sisa baris (dept, alamat, dst) menyusul di
     * bawahnya berdasarkan tinggi teks aktual — bukan offset
     * angka tetap (+13) yang rawan meleset.
     */

    const picName =
      alamatTujuan
        ? safeText(
            alamatTujuan['PIC'] || ''
          )
        : '';


    let kepadaRestLines: string[] = [];


    if (alamatTujuan) {

      const dept =
        safeText(
          alamatTujuan['DEPT'] || ''
        );

      const alamat =
        safeText(
          alamatTujuan['ALAMAT'] || ''
        );

      const kelurahan =
        safeText(
          alamatTujuan['KELURAHAN'] || ''
        );

      const kecamatan =
        safeText(
          alamatTujuan['KECAMATAN'] || ''
        );

      const kota =
        safeText(
          alamatTujuan['KOTA'] || ''
        );

      const tlp =
        safeText(
          alamatTujuan['TLP'] || ''
        );


      if (dept) {
        kepadaRestLines.push(dept);
      }

      if (alamat) {
        kepadaRestLines.push(alamat);
      }

      if (kelurahan) {
        kepadaRestLines.push(
          'KEL. ' + kelurahan
        );
      }

      if (kecamatan) {
        kepadaRestLines.push(
          'KEC. ' + kecamatan
        );
      }

      if (kota) {
        kepadaRestLines.push(kota);
      }

      if (tlp) {
        kepadaRestLines.push(tlp);
      }

    } else {

      kepadaRestLines.push(
        namaCabangFn(
          cabangList,
          header['Cabang Tujuan']
        )
      );

    }


    /*
     * Lebar blok "Kepada" dipersempit supaya tidak
     * bertabrakan dengan blok info di kanan yang sekarang
     * digeser lebih ke kiri (lihat INFO_X di bawah).
     */

    const kepadaWidth = 210;

    const kepadaY = 116;


    /*
     * Baris 1 : "Kepada Yth."
     */

    doc
      .font(FONT_NORMAL)
      .fontSize(8.5)
      .fillColor('#000')
      .text(
        'Kepada Yth.',
        CONTENT_X,
        kepadaY,
        {
          width: kepadaWidth,
          lineGap: 1,
        }
      );


    let kepadaCursorY =
      kepadaY + 12;


    /*
     * Baris 2 : nama PIC, bold, digambar SATU KALI saja.
     */

    if (picName) {

      doc
        .font(FONT_BOLD)
        .fontSize(8.5)
        .text(
          picName,
          CONTENT_X,
          kepadaCursorY,
          {
            width: kepadaWidth,
            lineGap: 1,
          }
        );


      kepadaCursorY +=
        doc.heightOfString(
          picName,
          {
            width: kepadaWidth,
            lineGap: 1,
          }
        ) + 1;

    }


    /*
     * Baris berikutnya : dept, alamat, kel, kec, kota, tlp.
     */

    if (kepadaRestLines.length > 0) {

      const restText =
        kepadaRestLines.join('\n');


      doc
        .font(FONT_NORMAL)
        .fontSize(8.5)
        .text(
          restText,
          CONTENT_X,
          kepadaCursorY,
          {
            width: kepadaWidth,
            lineGap: 1,
          }
        );

    }


    /* ========================================================
     * INFORMASI KANAN
     * ========================================================
     *
     * FIX: blok informasi (Nomor Surat Jalan, Tanggal Bukti,
     * Cabang Asal, Cabang Tujuan, Pengirim) digeser lebih ke
     * kiri dan lebar kolom nilai diperlebar, supaya nomor
     * surat jalan yang panjang (mis. "002/SVRMB-JKT/CGN/IX/26")
     * tidak terpotong / lari mepet ke tepi kertas.
     */

    const infoX =
      290;


    /*
     * Baris informasi.
     */

    const infoRows = [

      [
        'Nomor Surat Jalan',
        noSuratJalan,
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

    ];


    /*
     * FIX: jarak label -> ":" dirapatkan.
     *
     * Sebelumnya infoLabelWidth memakai angka tetap (130)
     * yang jauh lebih lebar daripada label terpanjang
     * ("Nomor Surat Jalan"), sehingga tanda ":" terasa jauh
     * dari teks label. Sekarang lebar kolom label dihitung
     * otomatis dari label terpanjang (termasuk "Pengirim"),
     * ditambah sedikit padding saja.
     */

    doc
      .font(FONT_NORMAL)
      .fontSize(8.5)
      .fillColor('#000');


    const infoLabelPadding =
      4;

    const infoLabelWidth =
      Math.max(
        ...infoRows.map(
          ([label]) =>
            doc.widthOfString(label)
        ),
        doc.widthOfString('Pengirim')
      ) + infoLabelPadding;

    const infoColonOffset =
      infoLabelWidth;

    const infoValueOffset =
      infoLabelWidth + 12;

    const infoValueWidth =
      CONTENT_X +
      CONTENT_W -
      (infoX + infoValueOffset);


    let infoY =
      138;


    for (
      const row of infoRows
    ) {

      const label =
        row[0];


      const value =
        row[1];


      doc
        .font(FONT_NORMAL)
        .fontSize(8.5)
        .text(
          label,
          infoX,
          infoY,
          {
            width: infoLabelWidth,
          }
        );


      doc.text(
        ':',
        infoX + infoColonOffset,
        infoY,
        {
          width: 8,
        }
      );


      doc.text(
        value,
        infoX + infoValueOffset,
        infoY,
        {
          width: infoValueWidth,
        }
      );


      infoY += 13;

    }


    /* ========================================================
     * PENGIRIM
     * ========================================================
     */

    const pengirimY =
      infoY + 2;


    doc
      .font(FONT_NORMAL)
      .fontSize(8.5)
      .text(
        'Pengirim',
        infoX,
        pengirimY,
        {
          width: infoLabelWidth,
        }
      );


    doc.text(
      ':',
      infoX + infoColonOffset,
      pengirimY,
      {
        width: 8,
      }
    );


    /*
     * Nama pengirim dibuat bold.
     */

    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .text(
        pengirim,
        infoX + infoValueOffset,
        pengirimY,
        {
          width: infoValueWidth,
        }
      );


    doc
      .font(FONT_NORMAL)
      .fontSize(8.5)
      .text(
        'Polytron - ' +
        safeText(
          header['Cabang Asal']
        ),
        infoX + infoValueOffset,
        pengirimY + 12,
        {
          width: infoValueWidth,
        }
      );


    if (pengirimTlp) {

      doc.text(
        pengirimTlp,
        infoX + infoValueOffset,
        pengirimY + 23,
        {
          width: infoValueWidth,
        }
      );

    }


    /* ========================================================
     * REMARKS
     * ========================================================
     */

    const remarks =
      safeText(
        header['Dikirim Via'] ||
        header['Remarks'] ||
        header['Remark'] ||
        '-'
      );


    const remarksY =
      236;


    doc
      .font(FONT_NORMAL)
      .fontSize(8.5)
      .fillColor('#000')
      .text(
        'Remarks :',
        CONTENT_X,
        remarksY,
        {
          width: 55,
        }
      );


    doc
      .font(FONT_NORMAL)
      .fontSize(8.5)
      .text(
        remarks,
        CONTENT_X + 58,
        remarksY,
        {
          width:
            CONTENT_W - 58,
        }
      );


    /* ========================================================
     * TABEL
     * ========================================================
     */

    const tableX =
      CONTENT_X;


    let tableY =
      258;


    const tableWidth =
      CONTENT_W;


    /*
     * Proporsi mengikuti PDF contoh.
     *
     * No          38
     * Part        82
     * Deskripsi   166
     * Qty         34
     * UM          40
     * Keterangan  122
     * Status      161
     *
     * Total harus = 555.
     */

    const colWidths = [
      38,
      82,
      166,
      34,
      40,
      122,
      73,
    ];


    /*
     * Pastikan total lebar tepat.
     */

    const widthTotal =
      colWidths.reduce(
        (
          total,
          width
        ) =>
          total + width,
        0
      );


    if (
      Math.abs(
        widthTotal -
        tableWidth
      ) > 0.1
    ) {

      colWidths[6] +=
        tableWidth -
        widthTotal;

    }


    /* ========================================================
     * HEADER TABEL
     * ========================================================
     */

    tableY +=
      drawTableHeader(
        doc,
        tableX,
        tableY,
        colWidths
      );


    /* ========================================================
     * DATA TABLE
     * ========================================================
     */

    let totalQty = 0;


    for (
      let i = 0;
      i < details.length;
      i++
    ) {

      const d =
        details[i];


      /*
       * Quantity.
       */

      const qty =
        Number(
          d.qty
        ) || 0;


      totalQty += qty;


      /*
       * Ambil part.
       *
       * Disiapkan beberapa fallback supaya tidak
       * kehilangan data apabila nama field berbeda
       * di core.ts.
       */

      const part =
        safeText(
          d.part ||
          d.noPart ||
          d.kodePart ||
          d.noBukti ||
          ''
        );


      /*
       * Deskripsi.
       */

      const deskripsi =
        safeText(
          d.deskripsi ||
          d.description ||
          d.namaBarang ||
          d.itemName ||
          ''
        );


      /*
       * Satuan.
       */

      const satuan =
        safeText(
          d.satuan ||
          d.um ||
          d.unit ||
          '-'
        );


      /*
       * Keterangan.
       */

      const keterangan =
        safeText(
          d.keterangan ||
          d.remarks ||
          d.reservasi ||
          '-'
        );


      /*
       * Status.
       */

      const status =
        safeText(
          d.statusFisik ||
          d.status ||
          'Belum Diterima'
        );


      const values = [

        String(i + 1),

        part,

        deskripsi,

        String(
          d.qty ?? ''
        ),

        satuan,

        keterangan,

        status,

      ];


      /* ======================================================
       * HITUNG TINGGI ROW
       * ======================================================
       */

      const heights =
        values.map(
          (
            value,
            index
          ) => {

            return getTextHeight(
              doc,
              value,
              colWidths[index] - 8,
              7.5
            );

          }
        );


      /*
       * Minimum 29 point.
       *
       * Pada PDF contoh, baris yang memiliki 3 baris
       * keterangan menjadi lebih tinggi daripada baris biasa.
       */

      let rowHeight =
        Math.max(
          29,
          ...heights.map(
            (h) => h + 10
          )
        );


      /*
       * Jangan biarkan row terlalu tinggi.
       */

      rowHeight =
        Math.min(
          rowHeight,
          80
        );


      /* ======================================================
       * CEK HALAMAN
       * ======================================================
       */

      if (
        tableY +
        rowHeight >
        PAGE_H - 135
      ) {

        /*
         * Halaman yang akan ditinggalkan ini sudah terisi
         * tabel sampai mendekati batas bawah, jadi border
         * penuh masih sesuai di sini.
         */

        drawOuterBox(doc);

        doc.addPage();

        tableY = 35;


        /*
         * Header tabel diulang.
         */

        tableY +=
          drawTableHeader(
            doc,
            tableX,
            tableY,
            colWidths
          );

      }


      /* ======================================================
       * DRAW ROW
       * ======================================================
       */

      let cellX =
        tableX;


      values.forEach(
        (
          value,
          index
        ) => {

          let align:
            | 'left'
            | 'center'
            | 'right';


          if (
            index === 0 ||
            index === 3 ||
            index === 4
          ) {

            align = 'center';

          } else {

            align = 'left';

          }


          drawCell(
            doc,
            value,
            cellX,
            tableY,
            colWidths[index],
            rowHeight,
            align
          );


          cellX +=
            colWidths[index];

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
     * Total dibuat tanpa border.
     * Posisi mengikuti contoh.
     */

    const totalY =
      tableY + 5;


    doc
      .font(FONT_BOLD)
      .fontSize(7.5)
      .fillColor('#000');


    /*
     * FIX: sebelumnya kotak teks "Total" dan kotak angka
     * total quantity saling tumpang tindih (areanya
     * beririsan), sehingga tercetak seperti "Tbtal" karena
     * huruf & angka saling menimpa. Sekarang "Total"
     * diletakkan rata kanan di dalam kolom Deskripsi
     * (berhenti tepat di batas kolom Qty), dan angka total
     * diletakkan rata tengah tepat di dalam kolom Qty —
     * tidak ada lagi irisan area.
     */

    const totalBoundaryX =
      tableX +
      colWidths[0] +
      colWidths[1] +
      colWidths[2];


    /*
     * Total text — rata kanan, berhenti di batas kolom Qty.
     */

    doc.text(
      'Total',
      totalBoundaryX -
        colWidths[2] +
        8,
      totalY,
      {
        width:
          colWidths[2] - 12,
        align: 'right',
      }
    );


    /*
     * Total quantity — rata tengah, di dalam kolom Qty.
     */

    doc.text(
      String(totalQty),
      totalBoundaryX,
      totalY,
      {
        width: colWidths[3],
        align: 'center',
      }
    );


    /* ========================================================
     * TANDA TANGAN
     * ========================================================
     */

    let signatureY =
      tableY + 52;


    /*
     * Kalau tabel terlalu panjang.
     */

    if (
      signatureY + 85 >
      PAGE_H - 25
    ) {

      /*
       * Halaman lama ditutup dengan border penuh (sudah
       * terisi tabel sampai hampir bawah), lalu tanda
       * tangan dipindah ke halaman baru yang border-nya
       * akan digambar dinamis di akhir.
       */

      drawOuterBox(doc);

      doc.addPage();

      signatureY = 80;

    }


    const signatureWidth =
      CONTENT_W / 4;


    /* ========================================================
     * DIBUAT OLEH (sebelumnya berjudul "PENGIRIM")
     * ========================================================
     */

    drawSignature(
      doc,

      'Dibuat Oleh',

      /*
       * Untuk Surat Jalan contoh:
       * nama tanda tangan = nama pencetak
       */

      safeText(
        namaPencetak ||
        pengirim
      ),

      'ADM SPAREPART',

      CONTENT_X,
      signatureY,
      signatureWidth
    );


    /* ========================================================
     * MENGETAHUI
     * ========================================================
     */

    drawSignature(
      doc,

      'MENGETAHUI',

      picMengetahui,

      'HoDS',

      CONTENT_X +
        signatureWidth,
      signatureY,
      signatureWidth
    );


    /* ========================================================
     * SOPIR / EKSPEDISI
     * ========================================================
     */

    const namaSopir =
      safeText(
        header['Sopir'] ||
        header['Nama Sopir'] ||
        ''
      );


    const noTruk =
      safeText(
        header['No Truk'] ||
        header['NoTruk'] ||
        ''
      );


    drawSignature(
      doc,

      'SOPIR/EKSPEDISI',

      namaSopir || '-',

      noTruk,

      CONTENT_X +
        signatureWidth * 2,

      signatureY,

      signatureWidth
    );


    /* ========================================================
     * PENERIMA
     * ========================================================
     */

    const namaPenerima =
      alamatTujuan
        ? safeText(
            alamatTujuan['PIC'] ||
            ''
          )
        : '';


    drawSignature(
      doc,

      'PENERIMA',

      namaPenerima,

      '',

      CONTENT_X +
        signatureWidth * 3,

      signatureY,

      signatureWidth
    );


    /* ========================================================
     * BORDER HALAMAN TERAKHIR (dinamis)
     * ========================================================
     *
     * Border halaman terakhir digambar SEKARANG, setelah
     * blok tanda tangan selesai, supaya tingginya mengikuti
     * konten yang sebenarnya (tidak memanjang kosong sampai
     * ke bawah halaman A4 seperti sebelumnya).
     */

    const finalBoxBottom =
      Math.min(
        signatureY + 88,
        PAGE_H - OUTER_Y
      );

    doc
      .lineWidth(0.75)
      .rect(
        OUTER_X,
        OUTER_Y,
        OUTER_W,
        finalBoxBottom - OUTER_Y
      )
      .stroke();


    /* ========================================================
     * END
     * ========================================================
     */

    doc.end();


    const buffer =
      await collect(doc);


    /* ========================================================
     * FILENAME
     * ========================================================
     */

    const filename =
      'SuratJalan_' +
      noSuratJalan
        .replace(
          /[\/\\]/g,
          '-'
        ) +
      '.pdf';


    /* ========================================================
     * RETURN
     * ========================================================
     */

    return {

      success: true,

      base64:
        buffer.toString(
          'base64'
        ),

      filename,

    };


  } catch (
    error: any
  ) {

    console.error(
      'buatPdfSuratJalan ERROR:',
      error
    );


    return {

      success: false,

      message:
        'Gagal membuat PDF: ' +
        (
          error?.message ||
          String(error)
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


    if (
      !result ||
      !result.success
    ) {

      return result || {
        success: false,
        message:
          'Data penerimaan eksternal tidak ditemukan.',
      };

    }


    const h: any =
  result.header || {};


    const items: any[] =
  result.items || [];


    /* ========================================================
     * TANGGAL
     * ========================================================
     */

    const tanggal =
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


    drawOuterBox(doc);


    /* ========================================================
     * JUDUL
     * ========================================================
     */

    doc
      .font(FONT_BOLD)
      .fontSize(14)
      .fillColor('#000')
      .text(
        'PENERIMAAN EKSTERNAL',
        CONTENT_X,
        40,
        {
          width: CONTENT_W,
          align: 'center',
        }
      );


    doc
      .font(FONT_NORMAL)
      .fontSize(9)
      .text(
        'No. Surat Jalan : ' +
        safeText(
          h.noSuratJalan || ''
        ),
        CONTENT_X,
        65,
        {
          width: CONTENT_W,
          align: 'center',
        }
      );


    /* ========================================================
     * INFO
     * ========================================================
     */

    let y =
      100;


    const externalInfo = [

      [
        'Sumber',
        safeText(
          h.rms || ''
        ),
      ],

      [
        'Tanggal',
        tanggal,
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


    externalInfo.forEach(
      ([label, value]) => {

        doc
          .font(FONT_NORMAL)
          .fontSize(9)
          .text(
            label,
            30,
            y,
            {
              width: 110,
            }
          );


        doc.text(
          ': ' + value,
          145,
          y,
          {
            width: 350,
          }
        );


        y += 17;

      }
    );


    /* ========================================================
     * TABLE
     * ========================================================
     */

    y += 10;


    const tableX =
      30;


    const tableWidth =
      PAGE_W - 60;


    const colWidths = [
      35,
      70,
      180,
      40,
      55,
      95,
      tableWidth -
        (
          35 +
          70 +
          180 +
          40 +
          55 +
          95
        ),
    ];


    y +=
      drawTableHeader(
        doc,
        tableX,
        y,
        colWidths
      );


    for (
      let i = 0;
      i < items.length;
      i++
    ) {

      const item =
        items[i];


      const values = [

        safeText(
          item.no ||
          i + 1
        ),

        safeText(
          item.noBukti ||
          '-'
        ),

        safeText(
          item.deskripsi ||
          ''
        ),

        safeText(
          item.qty ??
          ''
        ),

        safeText(
          item.satuan ||
          '-'
        ),

        safeText(
          item.keterangan ||
          '-'
        ),

        safeText(
          item.statusFisik ||
          '-'
        ),

      ];


      const heights =
        values.map(
          (
            value,
            index
          ) =>
            getTextHeight(
              doc,
              value,
              colWidths[index] - 8,
              7.5
            )
        );


      const rowHeight =
        Math.max(
          29,
          ...heights.map(
            h => h + 10
          )
        );


      if (
        y + rowHeight >
        PAGE_H - 100
      ) {

        doc.addPage();

        drawOuterBox(doc);

        y = 35;

        y +=
          drawTableHeader(
            doc,
            tableX,
            y,
            colWidths
          );

      }


      let cellX =
        tableX;


      values.forEach(
        (
          value,
          index
        ) => {

          drawCell(
            doc,
            value,
            cellX,
            y,
            colWidths[index],
            rowHeight,
            (
              index === 0 ||
              index === 3 ||
              index === 4
            )
              ? 'center'
              : 'left'
          );


          cellX +=
            colWidths[index];

        }
      );


      y +=
        rowHeight;

    }


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
        buffer.toString(
          'base64'
        ),

      filename,

    };


  } catch (
    error: any
  ) {

    console.error(
      'buatPdfPenerimaanEksternal ERROR:',
      error
    );


    return {

      success: false,

      message:
        'Gagal membuat PDF: ' +
        (
          error?.message ||
          String(error)
        ),

    };

  }

}
