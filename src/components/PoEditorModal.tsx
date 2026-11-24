import { useState } from 'react';
import { AlertTriangle, Save, X } from 'lucide-react';
import type {
  PoDraftItem,
  PoStatus,
  Product,
  PurchaseOrderWithDetails,
} from '../types/database';
import { updatePurchaseOrderItems } from '../lib/supabase';
import { PoItemsEditor, createEmptyDraftItem } from './PoItemsEditor';
import { StatusLabel } from './StatusLabel';

interface PoEditorModalProps {
  po: PurchaseOrderWithDetails;
  products: Product[];
  hidePrices: boolean;
  onClose: () => void;
  onSaved: (newStatus: PoStatus) => void;
  onError: (msg: string) => void;
}

export function PoEditorModal({
  po,
  products,
  hidePrices,
  onClose,
  onSaved,
  onError,
}: PoEditorModalProps) {
  const [items, setItems] = useState<PoDraftItem[]>(() => {
    if (po.po_items && po.po_items.length > 0) {
      return po.po_items.map((item) => ({
        localId: item.id || `${Date.now()}-${Math.random()}`,
        product_id: item.product_id,
        nama_barang: item.nama_barang,
        qty: Number(item.qty) || 1,
        satuan: item.satuan,
        harga_satuan: Number(item.harga_satuan) || 0,
      }));
    }
    return [createEmptyDraftItem()];
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const validCount = items.filter((i) => i.product_id && i.qty > 0).length;
    if (validCount === 0) {
      onError('Pilih minimal 1 produk dengan jumlah minimal 1 sebelum menyimpan.');
      return;
    }

    setSaving(true);
    try {
      const { newStatus } = await updatePurchaseOrderItems({
        poId: po.id,
        currentStatus: po.status,
        items,
      });
      onSaved(newStatus);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memperbarui PO.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-po-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="edit-po-title"
                className="font-mono text-base font-bold text-slate-900 sm:text-lg"
              >
                Edit {po.no_po}
              </h2>
              <StatusLabel status={po.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {po.customer?.nama_toko ?? 'Toko'}
              {po.customer?.alamat ? ` · ${po.customer.alamat}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Tutup modal edit"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {po.status === 'Approved' && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Status Akan Kembali ke Pending Approval</p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                  PO ini saat ini berstatus Approved. Jika Anda menyimpan perubahan item atau
                  jumlah, status PO otomatis dikembalikan menjadi Pending Approval untuk ditinjau
                  ulang.
                </p>
              </div>
            </div>
          )}

          {po.status === 'Revisi' && po.catatan_revisi && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900">
              <p className="font-semibold">Catatan Revisi dari Sales:</p>
              <p className="mt-0.5 text-xs leading-relaxed text-red-800">
                {po.catatan_revisi}
              </p>
            </div>
          )}

          <PoItemsEditor
            items={items}
            products={products}
            onChange={setItems}
            hidePrices={hidePrices}
          />
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan PO'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
