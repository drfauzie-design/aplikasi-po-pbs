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
import type { Customer, StaffUser } from '../types/database';
import {
  bulkInsertCustomers,
  createCustomer,
  deleteCustomer,
  deleteCustomersByIds,
  updateCustomer,
} from '../lib/supabase';
import { downloadCustomerTemplate, parseCustomerExcel } from '../lib/excel';
import { useToast } from './Toast';
import { ConfirmDeleteSelectedModal } from './ConfirmDeleteSelectedModal';

interface AdminCustomerManagerProps {
  customers: Customer[];
  salesUsers: StaffUser[];
  onRefresh: () => Promise<void>;
}

export function AdminCustomerManager({
  customers,
  salesUsers,
  onRefresh,
}: AdminCustomerManagerProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formState, setFormState] = useState({
    kode_pelanggan: '',
    nama_toko: '',
    telepon: '',
    alamat: '',
    sales_pic: '',
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // Multi-row checkbox selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      `${c.kode_pelanggan} ${c.nama_toko} ${c.telepon} ${c.alamat} ${c.sales_pic}`
        .toLowerCase()
        .includes(q)
    );
  }, [customers, search]);

  // Prune selected IDs that no longer exist in customers
  useEffect(() => {
    const existingIds = new Set(customers.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => existingIds.has(id)));
  }, [customers]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allVisibleSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIdSet.has(c.id));

  const someVisibleSelected =
    filteredCustomers.some((c) => selectedIdSet.has(c.id)) && !allVisibleSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredCustomers.map((c) => c.id);
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
    setEditingCustomer(null);
    setFormState({
      kode_pelanggan: '',
      nama_toko: '',
      telepon: '',
      alamat: '',
      sales_pic: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormState({
      kode_pelanggan: c.kode_pelanggan ?? '',
      nama_toko: c.nama_toko,
      telepon: c.telepon ?? '',
      alamat: c.alamat,
      sales_pic: c.sales_pic ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.nama_toko.trim() || !formState.alamat.trim()) {
      showToast('error', 'Data Belum Lengkap', 'Nama Toko dan Alamat wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, formState);
        showToast('success', 'Toko Diperbarui', `${formState.nama_toko} berhasil diperbarui.`);
      } else {
        await createCustomer(formState);
        showToast('success', 'Toko Ditambahkan', `${formState.nama_toko} berhasil ditambahkan.`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menyimpan Toko',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    setSaving(true);
    try {
      await deleteCustomer(c.id);
      setSelectedIds((prev) => prev.filter((id) => id !== c.id));
      showToast('success', 'Toko Dihapus', `${c.nama_toko} telah dihapus.`);
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menghapus Toko',
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
      const parsed = await parseCustomerExcel(file);
      const count = await bulkInsertCustomers(parsed);
      showToast(
        'success',
        'Import Excel Berhasil',
        `${count} data toko berhasil diimpor ke database.`
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
      await deleteCustomersByIds(selectedIds);
      setSelectedIds([]);
      setConfirmDeleteOpen(false);
      await onRefresh();
      showToast(
        'success',
        'Data Customer Dihapus',
        `${countToDelete} data customer terpilih berhasil dihapus.`
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
            Customer (Toko)
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Kelola daftar toko terdaftar untuk login Customer dan pemesanan PO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={downloadCustomerTemplate}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Download Template Excel Customer</span>
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
            <span>Tambah Toko</span>
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
            placeholder="Cari kode pelanggan, nama toko, telepon, atau alamat..."
            className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-400" />
          <span>
            Kolom template:{' '}
            <span className="font-mono text-slate-700">
              No, Nama Pelanggan, Telepon, Alamat 1
            </span>{' '}
            (Opsional: <span className="font-mono text-slate-700">Sales PIC</span>)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="w-px whitespace-nowrap px-3 py-3">
                <div className="flex items-center justify-center">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={filteredCustomers.length === 0}
                    onChange={toggleSelectAllVisible}
                    aria-label="Centang semua customer yang tampil"
                    title="Centang Semua"
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </th>
              <th className="w-px whitespace-nowrap px-3 py-3">No / Kode</th>
              <th className="min-w-[190px] px-4 py-3">Nama Pelanggan</th>
              <th className="w-px whitespace-nowrap px-3 py-3">Telepon</th>
              <th className="min-w-[280px] px-4 py-3">Alamat 1</th>
              <th className="w-px whitespace-nowrap px-3 py-3">Sales PIC</th>
              <th className="w-px whitespace-nowrap px-3 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  Belum ada data toko yang sesuai.
                </td>
              </tr>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedIdSet.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`transition-colors hover:bg-slate-50/70 ${
                      isSelected ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className="w-px whitespace-nowrap px-3 py-3">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(c.id)}
                          aria-label={`Pilih ${c.nama_toko}`}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                        />
                      </div>
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      {c.kode_pelanggan || '-'}
                    </td>
                    <td className="min-w-[190px] px-4 py-3 font-semibold text-slate-900">
                      {c.nama_toko}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-700 tabular-nums">
                      {c.telepon || '-'}
                    </td>
                    <td className="min-w-[280px] px-4 py-3 text-slate-600 leading-relaxed">
                      {c.alamat}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-slate-700">
                      {c.sales_pic || '-'}
                    </td>
                    <td className="w-px whitespace-nowrap px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDelete(c)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap"
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
                {editingCustomer ? 'Edit Data Toko' : 'Tambah Toko Baru'}
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
                    No / Kode Pelanggan
                  </label>
                  <input
                    type="text"
                    value={formState.kode_pelanggan}
                    onChange={(e) =>
                      setFormState({ ...formState, kode_pelanggan: e.target.value })
                    }
                    placeholder="Contoh: C-001"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Telepon (Opsional)
                  </label>
                  <input
                    type="tel"
                    value={formState.telepon}
                    onChange={(e) =>
                      setFormState({ ...formState, telepon: e.target.value })
                    }
                    placeholder="Contoh: 081234567890"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nama Pelanggan / Nama Toko
                </label>
                <input
                  type="text"
                  required
                  value={formState.nama_toko}
                  onChange={(e) =>
                    setFormState({ ...formState, nama_toko: e.target.value })
                  }
                  placeholder="Contoh: Toko Makmur Sentosa"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Alamat 1 / Alamat Lengkap
                </label>
                <textarea
                  required
                  rows={3}
                  value={formState.alamat}
                  onChange={(e) =>
                    setFormState({ ...formState, alamat: e.target.value })
                  }
                  placeholder="Jl. Raya No. 12, Kota..."
                  className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Sales PIC (Opsional)
                </label>
                <select
                  value={formState.sales_pic}
                  onChange={(e) =>
                    setFormState({ ...formState, sales_pic: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="">-- Belum Ditentukan --</option>
                  {salesUsers.map((sales) => (
                    <option key={sales.id} value={sales.nama}>
                      {sales.nama} ({sales.no_hp})
                    </option>
                  ))}
                  {formState.sales_pic &&
                    !salesUsers.some(
                      (s) =>
                        s.nama.trim().toLowerCase() ===
                        formState.sales_pic.trim().toLowerCase()
                    ) && (
                      <option value={formState.sales_pic}>
                        {formState.sales_pic} (Data tersimpan)
                      </option>
                    )}
                </select>
                {salesUsers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Belum ada pengguna ber-role sales. Tambahkan di menu Kelola Staff / Sales.
                  </p>
                )}
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
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteSelectedModal
        open={confirmDeleteOpen}
        entityLabel="customer"
        selectedCount={selectedIds.length}
        loading={deletingSelected}
        onConfirm={handleDeleteSelected}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
