import { Minus, Plus, Trash2 } from 'lucide-react';
import type { PoDraftItem, Product, UnitType } from '../types/database';
import { SearchableSelect } from './SearchableSelect';
import { formatRupiah } from '../lib/formatters';

interface PoItemsEditorProps {
  items: PoDraftItem[];
  products: Product[];
  onChange: (items: PoDraftItem[]) => void;
  hidePrices: boolean;
}

export function createEmptyDraftItem(): PoDraftItem {
  return {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: '',
    nama_barang: '',
    qty: 1,
    satuan: 'Dus',
    harga_satuan: 0,
  };
}

export function getUnitPrice(product: Product, satuan: UnitType): number {
  return satuan === 'Pack'
    ? Number(product.harga_pack) || 0
    : Number(product.harga_dus) || 0;
}

export function PoItemsEditor({
  items,
  products,
  onChange,
  hidePrices,
}: PoItemsEditorProps) {
  const productOptions = products.map((p) => ({
    value: p.id,
    label: p.nama_barang,
    sublabel: hidePrices
      ? `${p.kode_barang} · Stok: ${p.stok}`
      : `${p.kode_barang} · Pack: ${formatRupiah(p.harga_pack)} · Dus: ${formatRupiah(
          p.harga_dus
        )} · Stok: ${p.stok}`,
    searchText: `${p.kode_barang} ${p.nama_barang}`,
  }));

  const handleSelectProduct = (localId: string, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    onChange(
      items.map((row) =>
        row.localId === localId
          ? {
              ...row,
              product_id: prod ? prod.id : '',
              nama_barang: prod ? prod.nama_barang : '',
              harga_satuan: prod ? getUnitPrice(prod, row.satuan) : 0,
            }
          : row
      )
    );
  };

  const handleQtyChange = (localId: string, qty: number) => {
    const safeQty = Number.isNaN(qty) ? 1 : Math.max(1, Math.floor(qty));
    onChange(
      items.map((row) => (row.localId === localId ? { ...row, qty: safeQty } : row))
    );
  };

  const handleSatuanChange = (localId: string, satuan: UnitType) => {
    onChange(
      items.map((row) => {
        if (row.localId !== localId) return row;
        const prod = products.find((p) => p.id === row.product_id);
        return {
          ...row,
          satuan,
          harga_satuan: prod ? getUnitPrice(prod, satuan) : row.harga_satuan,
        };
      })
    );
  };

  const handleRemoveRow = (localId: string) => {
    if (items.length <= 1) {
      onChange([createEmptyDraftItem()]);
      return;
    }
    onChange(items.filter((row) => row.localId !== localId));
  };

  const handleAddRow = () => {
    onChange([...items, createEmptyDraftItem()]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.localId}
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                Item #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveRow(item.localId)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0"
                aria-label={`Hapus item ${idx + 1}`}
              >
                <Trash2 className="h-4 w-4" />
                <span>Hapus</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-6">
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Pilih Produk
                </label>
                <SearchableSelect
                  options={productOptions}
                  value={item.product_id}
                  onChange={(prodId) => handleSelectProduct(item.localId, prodId)}
                  placeholder="Ketik nama barang atau No SKU untuk mencari..."
                  emptyMessage="Produk tidak ditemukan."
                />
              </div>

              {item.product_id ? (
                <>
                  <div className="lg:col-span-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Jumlah (Qty)
                    </label>
                    <div className="flex min-h-[46px] items-center overflow-hidden rounded-lg border border-slate-300 bg-white">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.localId, item.qty - 1)}
                        className="flex h-[46px] w-11 shrink-0 items-center justify-center border-r border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                        aria-label="Kurangi jumlah"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.qty}
                        onChange={(e) =>
                          handleQtyChange(item.localId, parseInt(e.target.value, 10))
                        }
                        className="h-[46px] w-full min-w-0 bg-transparent text-center text-sm font-semibold text-slate-900 tabular-nums focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.localId, item.qty + 1)}
                        className="flex h-[46px] w-11 shrink-0 items-center justify-center border-l border-slate-200 text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                        aria-label="Tambah jumlah"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-3">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                      Satuan
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-300 bg-white p-1">
                      {(['Dus', 'Pack'] as UnitType[]).map((satuan) => {
                        const active = item.satuan === satuan;
                        return (
                          <button
                            key={satuan}
                            type="button"
                            onClick={() => handleSatuanChange(item.localId, satuan)}
                            className={`min-h-[36px] rounded-md text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              active
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {satuan}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[46px] items-center rounded-lg border border-dashed border-slate-300 bg-white px-3.5 text-xs text-slate-500 lg:col-span-6">
                  Pilih produk terlebih dahulu untuk mengatur Qty dan Satuan (Dus / Pack).
                </div>
              )}
            </div>

            {!hidePrices && item.product_id && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5 text-xs text-slate-600">
                <span>
                  Harga per {item.satuan}:{' '}
                  <strong className="text-slate-900 tabular-nums">
                    {formatRupiah(item.harga_satuan)}
                  </strong>
                </span>
                <span>
                  Subtotal:{' '}
                  <strong className="text-blue-700 tabular-nums">
                    {formatRupiah(item.qty * item.harga_satuan)}
                  </strong>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={handleAddRow}
        className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-blue-400 bg-blue-50/50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 sm:w-auto whitespace-nowrap shrink-0"
      >
        <span>+ Tambah Item</span>
      </button>
    </div>
  );
}
