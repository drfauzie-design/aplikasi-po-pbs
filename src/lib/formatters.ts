import type { PurchaseOrderWithDetails } from '../types/database';

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatTanggalWaktu(iso: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTanggal(iso: string): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export const NAMA_BULAN = [
  { value: '1', label: 'Januari' },
  { value: '2', label: 'Februari' },
  { value: '3', label: 'Maret' },
  { value: '4', label: 'April' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Juni' },
  { value: '7', label: 'Juli' },
  { value: '8', label: 'Agustus' },
  { value: '9', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

export interface DateFilterCriteria {
  tanggal: string; // YYYY-MM-DD
  bulan: string; // '1'..'12' or ''
  tahun: string; // '2026' or ''
}

export function matchesDateFilter(iso: string, filter: DateFilterCriteria): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;

  if (filter.tanggal) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    if (`${y}-${m}-${d}` !== filter.tanggal) return false;
  }

  if (filter.bulan) {
    if (String(date.getMonth() + 1) !== filter.bulan) return false;
  }

  if (filter.tahun) {
    if (String(date.getFullYear()) !== filter.tahun) return false;
  }

  return true;
}

export function calculatePoTotal(po: PurchaseOrderWithDetails): number {
  return (po.po_items ?? []).reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.harga_satuan) || 0),
    0
  );
}

export function calculatePoTotalQty(po: PurchaseOrderWithDetails): number {
  return (po.po_items ?? []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}
