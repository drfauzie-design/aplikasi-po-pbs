import { Printer, X } from 'lucide-react';
import type { PurchaseOrderWithDetails } from '../types/database';
import {
  calculatePoTotal,
  calculatePoTotalQty,
  formatRupiah,
  formatTanggalWaktu,
} from '../lib/formatters';
import { CompanyBrand } from './CompanyBrand';
import { CopyWhatsAppButton } from './CopyWhatsAppButton';

interface PrintPoSheetProps {
  po: PurchaseOrderWithDetails;
  onClose: () => void;
}

export function PrintPoSheet({ po, onClose }: PrintPoSheetProps) {
  const grandTotal = calculatePoTotal(po);
  const totalQty = calculatePoTotalQty(po);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Cetak Nota Purchase Order"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-3.5">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Pratinjau Surat Jalan / Nota PO
            </h2>
            <p className="text-xs text-slate-500">
              Siap dicetak atau disimpan sebagai PDF
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <CopyWhatsAppButton po={po} includePrices={true} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-slate-900 px-3.5 text-xs sm:text-sm font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shrink-0"
              aria-label="Tutup pratinjau cetak"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          <div id="print-po-sheet" className="mx-auto max-w-2xl space-y-6 text-slate-900">
            <div className="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-start">
              <div>
                <div className="mb-2.5">
                  <CompanyBrand variant="print" size="md" />
                </div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Surat Jalan &amp; Nota Purchase Order
                </p>
                <h1 className="mt-1 font-mono text-2xl font-bold text-slate-900">
                  {po.no_po}
                </h1>
              </div>
              <div className="text-left text-xs text-slate-600 sm:text-right">
                <p>
                  <span className="font-semibold text-slate-800">Tanggal PO:</span>{' '}
                  <span className="tabular-nums">{formatTanggalWaktu(po.created_at)}</span>
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-slate-800">Status:</span> {po.status}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-slate-800">Dibuat Oleh:</span>{' '}
                  {po.dibuat_oleh}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-slate-500">Tujuan Pengiriman / Toko</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {po.customer?.nama_toko ?? '-'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {po.customer?.alamat ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Sales Penanggung Jawab</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {po.customer?.sales_pic ?? '-'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Diperbarui: <span className="tabular-nums">{formatTanggalWaktu(po.updated_at)}</span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
                    <th className="px-3 py-2.5 font-semibold">No</th>
                    <th className="px-3 py-2.5 font-semibold">Nama Barang</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2.5 font-semibold">Satuan</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Harga Satuan</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {po.po_items.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="px-3 py-2.5 text-slate-500 tabular-nums">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {item.nama_barang}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {item.qty}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{item.satuan}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700 tabular-nums">
                        {formatRupiah(item.harga_satuan)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                        {formatRupiah(item.qty * item.harga_satuan)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                    <td colSpan={2} className="px-3 py-3">
                      Total Pesanan ({po.po_items.length} jenis)
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{totalQty}</td>
                    <td className="px-3 py-3 text-xs font-normal text-slate-600">Unit</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-slate-600">
                      Grand Total
                    </td>
                    <td className="px-3 py-3 text-right text-sm tabular-nums">
                      {formatRupiah(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs text-slate-600">
              <div>
                <p className="font-semibold text-slate-800">Pemesan / Toko</p>
                <div className="mt-12 border-t border-slate-300 pt-1">
                  {po.customer?.nama_toko ?? 'Tanda Tangan'}
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Disetujui Sales</p>
                <div className="mt-12 border-t border-slate-300 pt-1">
                  {po.customer?.sales_pic ?? 'Sales PIC'}
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-800">Admin Sales / Gudang</p>
                <div className="mt-12 border-t border-slate-300 pt-1">Admin Sales</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
