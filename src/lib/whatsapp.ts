import type { PurchaseOrderWithDetails } from '../types/database';
import {
  calculatePoTotal,
  calculatePoTotalQty,
  formatRupiah,
  formatTanggalWaktu,
} from './formatters';

export function buildPurchaseOrderWhatsAppText(
  po: PurchaseOrderWithDetails,
  includePrices: boolean
): string {
  const lines: string[] = [
    '*PURCHASE ORDER - CV. PANGAN BERKAH SENTOSA*',
    '----------------------------------------',
    `No. PO : *${po.no_po}*`,
    `Tanggal : ${formatTanggalWaktu(po.created_at)}`,
    `Status : ${po.status}`,
    `Toko : *${po.customer?.nama_toko ?? '-'}*`,
    `Alamat : ${po.customer?.alamat ?? '-'}`,
  ];

  if (po.customer?.telepon) {
    lines.push(`Telepon : ${po.customer.telepon}`);
  }
  if (po.customer?.sales_pic) {
    lines.push(`Sales PIC : ${po.customer.sales_pic}`);
  }
  lines.push(`Dibuat Oleh : ${po.dibuat_oleh}`);

  if (po.status === 'Revisi' && po.catatan_revisi) {
    lines.push(`Catatan Revisi : ${po.catatan_revisi}`);
  }

  lines.push('');
  lines.push('*Daftar Barang Pesanan:*');

  const items = po.po_items ?? [];
  items.forEach((item, idx) => {
    if (includePrices) {
      const subtotal = (Number(item.qty) || 0) * (Number(item.harga_satuan) || 0);
      lines.push(
        `${idx + 1}. ${item.nama_barang} — *${item.qty} ${item.satuan}* (${formatRupiah(
          item.harga_satuan
        )} = ${formatRupiah(subtotal)})`
      );
    } else {
      lines.push(`${idx + 1}. ${item.nama_barang} — *${item.qty} ${item.satuan}*`);
    }
  });

  const totalQty = calculatePoTotalQty(po);
  lines.push('');
  lines.push(`Total Item : *${items.length} jenis (${totalQty} unit)*`);

  if (includePrices) {
    lines.push(`*Total Tagihan : ${formatRupiah(calculatePoTotal(po))}*`);
  }

  return lines.join('\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback to execCommand below if Clipboard API is restricted
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!ok) {
    throw new Error('Browser menolak akses clipboard.');
  }
}
