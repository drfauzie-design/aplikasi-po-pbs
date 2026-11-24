import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Product } from '../types/database';
import {
  bulkInsertProducts,
  createProduct,
  deleteProduct,
  deleteProductsByIds,
  updateProduct,
} from '../lib/supabase';
import { downloadProductTemplate, parseProductExcel } from '../lib/excel';
import { formatRupiah } from '../lib/formatters';
import { useToast } from './Toast';
import { ConfirmDeleteSelectedModal } from './ConfirmDeleteSelectedModal';

interface AdminProductManagerProps {
  products: Product[];
  onRefresh: () => Promise<void>;
}

export function AdminProductManager({
  products,
  onRefresh,
}: AdminProductManagerProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formState, setFormState] = useState({
    kode_barang: '',
    nama_barang: '',
    harga_pack: '',
    harga_dus: '',
    stok: '',
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Multi-row checkbox selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.kode_barang} ${p.nama_barang}`.toLowerCase().includes(q)
    );
  }, [products, search]);

  // Prune selected IDs that no longer exist in products
  useEffect(() => {
    const existingIds = new Set(products.map((p) => p.id));
    setSelectedIds((prev) => prev.filter((id) => existingIds.has(id)));
  }, [products]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allVisibleSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedIdSet.has(p.id));

  const someVisibleSelected =
    filteredProducts.some((p) => selectedIdSet.has(p.id)) && !allVisibleSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map((p) => p.id);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormState({
      kode_barang: '',
      nama_barang: '',
      harga_pack: '',
      harga_dus: '',
      stok: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormState({
      kode_barang: p.kode_barang,
      nama_barang: p.nama_barang,
      harga_pack: String(p.harga_pack ?? 0),
      harga_dus: String(p.harga_dus ?? 0),
      stok: String(p.stok ?? 0),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.kode_barang.trim() || !formState.nama_barang.trim()) {
      showToast(
        'error',
        'Data Belum Lengkap',
        'No SKU dan Nama Barang wajib diisi.'
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        kode_barang: formState.kode_barang,
        nama_barang: formState.nama_barang,
        harga_pack: Number(formState.harga_pack) || 0,
        harga_dus: Number(formState.harga_dus) || 0,
        stok: Math.max(0, Math.floor(Number(formState.stok) || 0)),
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
        showToast(
          'success',
          'Barang Diperbarui',
          `${formState.nama_barang} berhasil diperbarui.`
        );
      } else {
        await createProduct(payload);
        showToast(
          'success',
          'Barang Ditambahkan',
          `${formState.nama_barang} berhasil ditambahkan.`
        );
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menyimpan Barang',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Product) => {
    setSaving(true);
    try {
      await deleteProduct(p.id);
      setSelectedIds((prev) => prev.filter((id) => id !== p.id));
      showToast('success', 'Barang Dihapus', `${p.nama_barang} telah dihapus.`);
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menghapus Barang',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const parsed = await parseProductExcel(file);
      const count = await bulkInsertProducts(parsed);
      showToast(
        'success',
        'Import Excel Berhasil',
        `${count} data produk berhasil diimpor ke database.`
      );
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Import Excel',
        err instanceof Error ? err.message : 'Format file tidak sesuai.'
      );
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const countToDelete = selectedIds.length;
    setDeletingSelected(true);
    try {
      await deleteProductsByIds(selectedIds);
      setSelectedIds([]);
      setConfirmDeleteOpen(false);
      await onRefresh();
      showToast(
        'success',
        'Data Barang Dihapus',
        `${countToDelete} data barang terpilih berhasil dihapus.`
      );
    } catch (err) {
      showToast(
        'error',
        'Gagal Menghapus Data Terpilih',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus data.'
      );
    } finally {
      setDeletingSelected(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Barang (Produk)
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Kelola katalog barang, No SKU, harga Pack/Dus, dan stok untuk seluruh pesanan PO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={downloadProductTemplate}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Download Template Excel Barang</span>
          </button>

          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 whitespace-nowrap shrink-0">
            <Upload className="h-4 w-4" />
            <span>{importing ? 'Mengimpor...' : 'Import Excel (.xlsx / .csv)'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={importing}
              onChange={handleFileImport}
              className="hidden"
            />
          </label>

          {selectedIds.length > 0 && (
            <button
              type="button"
              disabled={deletingSelected}
              onClick={() => setConfirmDeleteOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              <span className="tabular-nums">Hapus Terpilih ({selectedIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Barang</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari No SKU atau nama barang..."
            className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Kolom template:{' '}
            <span className="font-mono text-slate-700">
              No SKU, Nama Barang, Harga Pack, Harga Dus, Stock Awal
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="w-12 px-4 py-3">
                <div className="flex items-center justify-center">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={filteredProducts.length === 0}
                    onChange={toggleSelectAllVisible}
                    aria-label="Centang semua barang yang tampil"
                    title="Centang Semua"
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </th>
              <th className="px-4 py-3">No SKU</th>
              <th className="px-4 py-3">Nama Barang</th>
              <th className="px-4 py-3 text-right">Harga Pack</th>
              <th className="px-4 py-3 text-right">Harga Dus</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  Belum ada data barang yang sesuai.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const isSelected = selectedIdSet.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      isSelected ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(p.id)}
                          aria-label={`Pilih ${p.nama_barang}`}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {p.kode_barang}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {p.nama_barang}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(p.harga_pack)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatRupiah(p.harga_dus)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700 tabular-nums whitespace-nowrap">
                      {p.stok}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDelete(p)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? 'Edit Data Barang' : 'Tambah Barang Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    No SKU / Kode Barang
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.kode_barang}
                    onChange={(e) =>
                      setFormState({ ...formState, kode_barang: e.target.value })
                    }
                    placeholder="SKU-001"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Stock Awal / Stok
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={formState.stok}
                    onChange={(e) =>
                      setFormState({ ...formState, stok: e.target.value })
                    }
                    placeholder="100"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nama Barang
                </label>
                <input
                  type="text"
                  required
                  value={formState.nama_barang}
                  onChange={(e) =>
                    setFormState({ ...formState, nama_barang: e.target.value })
                  }
                  placeholder="Contoh: Minyak Goreng Kemasan 1L"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Harga Pack (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    required
                    value={formState.harga_pack}
                    onChange={(e) =>
                      setFormState({ ...formState, harga_pack: e.target.value })
                    }
                    placeholder="13300"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Harga Dus (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    required
                    value={formState.harga_dus}
                    onChange={(e) =>
                      setFormState({ ...formState, harga_dus: e.target.value })
                    }
                    placeholder="155000"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm font-semibold text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[44px] rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteSelectedModal
        open={confirmDeleteOpen}
        entityLabel="barang"
        selectedCount={selectedIds.length}
        loading={deletingSelected}
        onConfirm={handleDeleteSelected}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
