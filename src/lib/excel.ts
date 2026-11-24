import * as XLSX from 'xlsx';
import type { Customer, Product, PurchaseOrderWithDetails } from '../types/database';
import { calculatePoTotal, formatTanggalWaktu } from './formatters';

export function downloadCustomerTemplate(): void {
  const sampleRows = [
    {
      No: 'C-001',
      'Nama Pelanggan': 'Toko Sumber Rejeki',
      Telepon: '081234567890',
      'Alamat 1': 'Jl. Merdeka No. 45, Bandung',
    },
    {
      No: 'C-002',
      'Nama Pelanggan': 'Minimarket Harapan Jaya',
      Telepon: '',
      'Alamat 1': 'Jl. Sudirman No. 12, Jakarta Selatan',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, {
    header: ['No', 'Nama Pelanggan', 'Telepon', 'Alamat 1'],
  });
  worksheet['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 42 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Customer');
  XLSX.writeFile(workbook, 'template_customer_po.xlsx');
}

export function downloadProductTemplate(): void {
  const sampleRows = [
    {
      'No SKU': 'SKU-001',
      'Nama Barang': 'Minyak Goreng Kemasan 1L',
      'Harga Pack': 13300,
      'Harga Dus': 155000,
      'Stock Awal': 120,
    },
    {
      'No SKU': 'SKU-002',
      'Nama Barang': 'Beras Premium 5kg',
      'Harga Pack': 74000,
      'Harga Dus': 290000,
      'Stock Awal': 45,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, {
    header: ['No SKU', 'Nama Barang', 'Harga Pack', 'Harga Dus', 'Stock Awal'],
  });
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 32 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Barang');
  XLSX.writeFile(workbook, 'template_barang_po.xlsx');
}

export function parseRupiahNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  const str = String(raw ?? '').trim();
  if (!str) return 0;

  // Strip "Rp", currency symbols, spaces, and trailing Indonesian decimal (",00")
  const withoutCurrency = str.replace(/rp\.?/gi, '').replace(/\s+/g, '');
  const withoutDecimalComma = withoutCurrency.replace(/,\d{1,2}$/, '');
  // Remove dot/comma thousand separators and any non-digit characters
  const digitsOnly = withoutDecimalComma.replace(/[^\d]/g, '');
  const parsed = parseInt(digitsOnly, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getNormalizedEntry(
  row: Record<string, unknown>,
  possibleKeys: string[]
): unknown {
  const entries = Object.entries(row);
  for (const key of possibleKeys) {
    const found = entries.find(
      ([k]) => k.trim().toLowerCase().replace(/\s+/g, '_') === key
    );
    if (found && found[1] !== undefined && found[1] !== null) {
      return found[1];
    }
  }
  return '';
}

function getNormalizedValue(
  row: Record<string, unknown>,
  possibleKeys: string[]
): string {
  const val = getNormalizedEntry(row, possibleKeys);
  return val === undefined || val === null ? '' : String(val).trim();
}

export async function parseCustomerExcel(
  file: File
): Promise<Omit<Customer, 'id'>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
  });

  if (matrix.length === 0) {
    throw new Error('File tidak berisi baris data.');
  }

  // Detect header row automatically (skip top title rows like "DATA CUSTOMER")
  let headerRowIndex = matrix.findIndex((row) =>
    row.some((cell) => {
      const text = String(cell ?? '').trim().toLowerCase();
      return (
        text.includes('nama pelanggan') ||
        text.includes('alamat 1') ||
        text === 'nama_toko' ||
        text === 'nama toko'
      );
    })
  );

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  const headerCells = matrix[headerRowIndex].map((cell, colIdx) => {
    const label = String(cell ?? '').trim();
    return label || `col_${colIdx}`;
  });

  const rawRows: Record<string, unknown>[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const rowArr = matrix[i];
    if (!rowArr || rowArr.every((c) => String(c ?? '').trim() === '')) {
      continue;
    }
    const rowObj: Record<string, unknown> = {};
    headerCells.forEach((headerName, colIdx) => {
      rowObj[headerName] = rowArr[colIdx] ?? '';
    });
    rawRows.push(rowObj);
  }

  if (rawRows.length === 0) {
    throw new Error('File tidak berisi baris data customer setelah baris header.');
  }

  const parsed: Omit<Customer, 'id'>[] = [];
  rawRows.forEach((row) => {
    const kode_pelanggan = getNormalizedValue(row, [
      'no',
      'kode_pelanggan',
      'kode',
      'no_pelanggan',
    ]);
    const nama_toko = getNormalizedValue(row, [
      'nama_pelanggan',
      'nama_toko',
      'toko',
      'nama',
    ]);
    const telepon = getNormalizedValue(row, [
      'telepon',
      'no_telepon',
      'telp',
      'no_hp',
      'hp',
      'phone',
    ]);
    const alamat = getNormalizedValue(row, [
      'alamat_1',
      'alamat',
      'alamat_lengkap',
    ]);
    const sales_pic = getNormalizedValue(row, ['sales_pic', 'sales', 'pic']);

    if (nama_toko) {
      parsed.push({
        kode_pelanggan: kode_pelanggan || '',
        nama_toko,
        telepon: telepon || '',
        alamat: alamat || '-',
        sales_pic: sales_pic || '',
      });
    }
  });

  if (parsed.length === 0) {
    throw new Error(
      'Tidak ada data valid ditemukan. Pastikan terdapat kolom No, Nama Pelanggan, Telepon, dan Alamat 1.'
    );
  }

  return parsed;
}

export async function parseProductExcel(
  file: File
): Promise<Omit<Product, 'id'>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('File Excel tidak memiliki lembar kerja (sheet).');
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (rawRows.length === 0) {
    throw new Error('File tidak berisi baris data.');
  }

  const parsed: Omit<Product, 'id'>[] = [];
  rawRows.forEach((row) => {
    const kode_barang = getNormalizedValue(row, [
      'no_sku',
      'kode_barang',
      'sku',
      'kode',
    ]);
    const nama_barang = getNormalizedValue(row, [
      'nama_barang',
      'nama',
      'produk',
    ]);
    const hargaPackRaw = getNormalizedEntry(row, ['harga_pack', 'pack']);
    const hargaDusRaw = getNormalizedEntry(row, ['harga_dus', 'dus']);
    const stokRaw = getNormalizedEntry(row, [
      'stock_awal',
      'stok',
      'stok_awal',
      'stock',
    ]);

    const harga_pack = parseRupiahNumber(hargaPackRaw);
    const harga_dus = parseRupiahNumber(hargaDusRaw);
    const stok = parseRupiahNumber(stokRaw);

    if (nama_barang) {
      parsed.push({
        kode_barang: kode_barang || '-',
        nama_barang,
        harga_pack,
        harga_dus,
        stok,
      });
    }
  });

  if (parsed.length === 0) {
    throw new Error(
      'Tidak ada data valid ditemukan. Pastikan terdapat kolom No SKU, Nama Barang, Harga Pack, Harga Dus, dan Stock Awal.'
    );
  }

  return parsed;
}

export function exportPurchaseOrdersReport(orders: PurchaseOrderWithDetails[]): void {
  const summaryRows = orders.map((po) => ({
    'No. PO': po.no_po,
    'Tanggal PO': formatTanggalWaktu(po.created_at),
    'Nama Toko': po.customer?.nama_toko ?? '-',
    'Alamat Toko': po.customer?.alamat ?? '-',
    'Sales PIC': po.customer?.sales_pic ?? '-',
    'Dibuat Oleh': po.dibuat_oleh,
    Status: po.status,
    'Catatan Revisi': po.catatan_revisi ?? '-',
    'Jumlah Jenis Barang': po.po_items.length,
    'Total Nilai (Rp)': calculatePoTotal(po),
  }));

  const detailRows: Record<string, unknown>[] = [];
  orders.forEach((po) => {
    po.po_items.forEach((item) => {
      detailRows.push({
        'No. PO': po.no_po,
        'Tanggal PO': formatTanggalWaktu(po.created_at),
        'Nama Toko': po.customer?.nama_toko ?? '-',
        Status: po.status,
        'Nama Barang': item.nama_barang,
        Qty: item.qty,
        Satuan: item.satuan,
        'Harga Satuan (Rp)': item.harga_satuan,
        'Subtotal (Rp)': item.qty * item.harga_satuan,
      });
    });
  });

  const workbook = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 26 },
    { wch: 36 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 26 },
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan PO');
  XLSX.utils.book_append_sheet(workbook, wsDetails, 'Rincian Item PO');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `laporan_riwayat_po_${today}.xlsx`);
}
