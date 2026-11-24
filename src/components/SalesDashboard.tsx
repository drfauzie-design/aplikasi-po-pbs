import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FilePlus2,
  History,
  LogOut,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import type {
  Customer,
  PoDraftItem,
  PoStatus,
  Product,
  PurchaseOrderWithDetails,
  StaffUser,
} from '../types/database';
import {
  createPurchaseOrder,
  fetchCustomers,
  fetchProducts,
  fetchPurchaseOrders,
  updatePurchaseOrderStatus,
} from '../lib/supabase';
import {
  calculatePoTotal,
  calculatePoTotalQty,
  formatRupiah,
  formatTanggalWaktu,
  matchesDateFilter,
  type DateFilterCriteria,
} from '../lib/formatters';
import { useToast } from './Toast';
import { SearchableSelect } from './SearchableSelect';
import { PoItemsEditor, createEmptyDraftItem } from './PoItemsEditor';
import { DateFilterBar } from './DateFilterBar';
import { StatusLabel } from './StatusLabel';
import { PoEditorModal } from './PoEditorModal';
import { CompanyBrand } from './CompanyBrand';
import { CopyWhatsAppButton } from './CopyWhatsAppButton';

interface SalesDashboardProps {
  user: Omit<StaffUser, 'pin'>;
  onLogout: () => void;
}

type SalesTab = 'daftar' | 'buat' | 'riwayat';
type StatusFilter = 'Semua' | 'Pending Approval' | 'Approved' | 'Revisi' | 'Selesai';

export function SalesDashboard({ user, onLogout }: SalesDashboardProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SalesTab>('daftar');

  const [orders, setOrders] = useState<PurchaseOrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail & Revision modal states
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderWithDetails | null>(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [processingStatus, setProcessingStatus] = useState(false);

  // Edit PO modal
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithDetails | null>(null);

  // Create PO states
  const [newCustomerId, setNewCustomerId] = useState('');
  const [draftItems, setDraftItems] = useState<PoDraftItem[]>([createEmptyDraftItem()]);
  const [submittingPo, setSubmittingPo] = useState(false);

  // Store Purchase History filters
  const [historyCustomerId, setHistoryCustomerId] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<DateFilterCriteria>({
    tanggal: '',
    bulan: '',
    tahun: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pos, custs, prods] = await Promise.all([
        fetchPurchaseOrders(),
        fetchCustomers(),
        fetchProducts(),
      ]);
      setOrders(pos);
      setCustomers(custs);
      setProducts(prods);
    } catch (err) {
      showToast(
        'error',
        'Gagal Memuat Data',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data.'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ownedCustomers = useMemo(() => {
    const salesName = user.nama.trim().toLowerCase();
    return customers.filter(
      (c) => (c.sales_pic ?? '').trim().toLowerCase() === salesName
    );
  }, [customers, user.nama]);

  const ownedCustomerIdSet = useMemo(
    () => new Set(ownedCustomers.map((c) => c.id)),
    [ownedCustomers]
  );

  const ownedOrders = useMemo(() => {
    const salesName = user.nama.trim().toLowerCase();
    return orders.filter((po) => {
      if (po.customer?.sales_pic !== undefined && po.customer?.sales_pic !== null) {
        return po.customer.sales_pic.trim().toLowerCase() === salesName;
      }
      return ownedCustomerIdSet.has(po.customer_id);
    });
  }, [orders, user.nama, ownedCustomerIdSet]);

  const customerOptions = useMemo(
    () =>
      ownedCustomers.map((c) => {
        const metaParts = [
          c.kode_pelanggan ? `Kode: ${c.kode_pelanggan}` : '',
          c.telepon ? `Telp: ${c.telepon}` : '',
          c.sales_pic ? `Sales PIC: ${c.sales_pic}` : '',
        ].filter(Boolean);
        return {
          value: c.id,
          label: `${c.nama_toko} - ${c.alamat}`,
          sublabel: metaParts.length > 0 ? metaParts.join(' · ') : undefined,
          searchText: `${c.kode_pelanggan} ${c.nama_toko} ${c.telepon} ${c.alamat} ${c.sales_pic}`,
        };
      }),
    [ownedCustomers]
  );

  const filteredIncomingOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ownedOrders.filter((po) => {
      if (statusFilter !== 'Semua' && po.status !== statusFilter) return false;
      if (!q) return true;
      const target = `${po.no_po} ${po.customer?.nama_toko ?? ''} ${
        po.customer?.alamat ?? ''
      }`.toLowerCase();
      return target.includes(q);
    });
  }, [ownedOrders, statusFilter, searchQuery]);

  const availableYears = useMemo(() => {
    return Array.from(
      new Set(
        ownedOrders
          .map((o) => {
            const d = new Date(o.created_at);
            return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear());
          })
          .filter(Boolean)
      )
    );
  }, [ownedOrders]);

  const filteredHistoryOrders = useMemo(() => {
    return ownedOrders.filter((po) => {
      if (historyCustomerId && po.customer_id !== historyCustomerId) return false;
      return matchesDateFilter(po.created_at, historyDateFilter);
    });
  }, [ownedOrders, historyCustomerId, historyDateFilter]);

  const pendingCount = useMemo(
    () => ownedOrders.filter((o) => o.status === 'Pending Approval').length,
    [ownedOrders]
  );

  const handleApprove = async (po: PurchaseOrderWithDetails) => {
    setProcessingStatus(true);
    try {
      await updatePurchaseOrderStatus({
        poId: po.id,
        status: 'Approved',
      });
      showToast(
        'success',
        'PO Disetujui',
        `${po.no_po} (${po.customer?.nama_toko ?? 'Toko'}) telah disetujui.`
      );
      setSelectedPo(null);
      setRevisionMode(false);
      setRevisionNote('');
      await loadData();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menyetujui PO',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setProcessingStatus(false);
    }
  };

  const handleSubmitRevision = async () => {
    if (!selectedPo) return;
    if (!revisionNote.trim()) {
      showToast(
        'error',
        'Catatan Revisi Wajib Diisi',
        'Tuliskan alasan atau instruksi revisi untuk toko.'
      );
      return;
    }

    setProcessingStatus(true);
    try {
      await updatePurchaseOrderStatus({
        poId: selectedPo.id,
        status: 'Revisi',
        catatanRevisi: revisionNote.trim(),
      });
      showToast(
        'info',
        'PO Dikembalikan untuk Revisi',
        `${selectedPo.no_po} berstatus Revisi dengan catatan.`
      );
      setSelectedPo(null);
      setRevisionMode(false);
      setRevisionNote('');
      await loadData();
    } catch (err) {
      showToast(
        'error',
        'Gagal Mengubah Status',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setProcessingStatus(false);
    }
  };

  const validDraftItems = useMemo(
    () => draftItems.filter((item) => item.product_id && item.qty > 0),
    [draftItems]
  );

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerId) {
      showToast('error', 'Pilih Toko', 'Silakan pilih toko tujuan terlebih dahulu.');
      return;
    }
    if (validDraftItems.length === 0) {
      showToast(
        'error',
        'Item Kosong',
        'Tambahkan minimal 1 barang dengan jumlah valid.'
      );
      return;
    }

    setSubmittingPo(true);
    try {
      const created = await createPurchaseOrder({
        customerId: newCustomerId,
        dibuatOleh: `Sales: ${user.nama}`,
        items: validDraftItems,
      });
      showToast(
        'success',
        'PO Baru Berhasil Dibuat',
        `Nomor PO ${created.no_po} tersimpan dengan status Pending Approval.`
      );
      setNewCustomerId('');
      setDraftItems([createEmptyDraftItem()]);
      await loadData();
      setActiveTab('daftar');
    } catch (err) {
      showToast(
        'error',
        'Gagal Membuat PO',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setSubmittingPo(false);
    }
  };

  const handlePoEdited = async (newStatus: PoStatus) => {
    setEditingOrder(null);
    setSelectedPo(null);
    showToast(
      'success',
      'PO Berhasil Dikoreksi',
      newStatus === 'Pending Approval'
        ? 'Karena PO sebelumnya Approved, status otomatis dikembalikan ke Pending Approval.'
        : 'Perubahan item PO telah disimpan.'
    );
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <CompanyBrand variant="light" size="sm" />
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <button
              type="button"
              onClick={() => setActiveTab('daftar')}
              className={`border-b-2 py-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'daftar'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar PO Masuk ({pendingCount} Pending)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('buat')}
              className={`border-b-2 py-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'buat'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Buat PO Baru
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('riwayat')}
              className={`border-b-2 py-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'riwayat'
                  ? 'border-blue-700 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Riwayat Pembelian Toko
            </button>
          </nav>

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto shrink-0">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap sm:hidden"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-4 w-4" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 border-t border-slate-200 bg-slate-50 px-1 md:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('daftar')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${
              activeTab === 'daftar'
                ? 'border-b-2 border-blue-700 bg-white text-blue-700'
                : 'text-slate-600'
            }`}
          >
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>PO Masuk</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('buat')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${
              activeTab === 'buat'
                ? 'border-b-2 border-blue-700 bg-white text-blue-700'
                : 'text-slate-600'
            }`}
          >
            <FilePlus2 className="h-4 w-4 shrink-0" />
            <span>Buat PO</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('riwayat')}
            className={`flex min-h-[44px] items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap ${
              activeTab === 'riwayat'
                ? 'border-b-2 border-blue-700 bg-white text-blue-700'
                : 'text-slate-600'
            }`}
          >
            <History className="h-4 w-4 shrink-0" />
            <span>Riwayat</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-slate-500">Panel Sales</p>
            <h1 className="text-xl font-bold text-slate-900">{user.nama}</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              No. HP: <span className="font-mono">{user.no_hp}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="tabular-nums">{ownedCustomers.length} toko kelolaan</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="tabular-nums">{pendingCount} PO menunggu persetujuan</span>
            </p>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>
        </section>

        {activeTab === 'daftar' && (
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
              <div className="flex flex-wrap gap-1.5">
                {(
                  ['Semua', 'Pending Approval', 'Approved', 'Revisi', 'Selesai'] as StatusFilter[]
                ).map((st) => {
                  const active = statusFilter === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`min-h-[40px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari No. PO atau Nama Toko..."
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : filteredIncomingOrders.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <p className="text-base font-bold text-slate-900">
                  Tidak Ada PO yang Cocok
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Ubah filter status atau kata kunci pencarian untuk melihat daftar PO lainnya.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredIncomingOrders.map((po) => {
                  const totalQty = calculatePoTotalQty(po);
                  return (
                    <div
                      key={po.id}
                      className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-base font-bold text-slate-900">
                            {po.no_po}
                          </span>
                          <StatusLabel status={po.status} />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {po.customer?.nama_toko ?? 'Toko Tidak Diketahui'}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{po.customer?.alamat ?? '-'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {formatTanggalWaktu(po.created_at)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {po.po_items.length} jenis ({totalQty} unit)
                          </span>
                        </div>
                        {po.status === 'Revisi' && po.catatan_revisi && (
                          <p className="text-xs text-red-700">
                            Catatan Revisi: {po.catatan_revisi}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <CopyWhatsAppButton
                          po={po}
                          includePrices={false}
                          size="sm"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPo(po);
                            setRevisionMode(false);
                            setRevisionNote(po.catatan_revisi ?? '');
                          }}
                          className="inline-flex min-h-[36px] items-center justify-center rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                        >
                          Buka Detail &amp; Proses
                        </button>
                        {po.status !== 'Selesai' && (
                          <button
                            type="button"
                            onClick={() => setEditingOrder(po)}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Koreksi</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'buat' && (
          <form
            onSubmit={handleCreatePo}
            className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Buat PO Baru untuk Toko
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Pilih toko pelanggan dan tambahkan barang yang dipesan.
              </p>
            </div>

            <SearchableSelect
              id="sales-select-store"
              label="Pilih Toko Pelanggan"
              options={customerOptions}
              value={newCustomerId}
              onChange={setNewCustomerId}
              placeholder={
                ownedCustomers.length === 0
                  ? 'Belum ada toko dengan Sales PIC Anda'
                  : 'Ketik Nama Toko atau Alamat...'
              }
              emptyMessage="Toko milik Sales PIC Anda tidak ditemukan."
            />

            <PoItemsEditor
              items={draftItems}
              products={products}
              onChange={setDraftItems}
              hidePrices={false}
            />

            <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900 tabular-nums">
                  {validDraftItems.length}
                </span>{' '}
                jenis barang dipilih
                <span className="mx-2 text-slate-300">·</span>
                Estimasi Total:{' '}
                <span className="font-bold text-blue-700 tabular-nums">
                  {formatRupiah(
                    validDraftItems.reduce(
                      (sum, item) => sum + item.qty * item.harga_satuan,
                      0
                    )
                  )}
                </span>
              </div>
              <button
                type="submit"
                disabled={submittingPo || !newCustomerId || validDraftItems.length === 0}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
              >
                <Send className="h-4 w-4" />
                <span>{submittingPo ? 'Menyimpan PO...' : 'Kirim PO'}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'riwayat' && (
          <div className="space-y-4">
            <DateFilterBar
              filter={historyDateFilter}
              onChange={setHistoryDateFilter}
              availableYears={availableYears}
              customers={ownedCustomers}
              selectedCustomerId={historyCustomerId}
              onCustomerChange={setHistoryCustomerId}
            />

            {filteredHistoryOrders.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                <p className="text-base font-bold text-slate-900">
                  Riwayat Pembelian Kosong
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Belum ada transaksi PO yang sesuai dengan filter toko atau tanggal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">No. PO</th>
                      <th className="px-4 py-3">Waktu PO</th>
                      <th className="px-4 py-3">Toko</th>
                      <th className="px-4 py-3 text-right">Item</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistoryOrders.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {po.no_po}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {formatTanggalWaktu(po.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {po.customer?.nama_toko ?? '-'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {po.customer?.alamat ?? '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {po.po_items.length} jenis ({calculatePoTotalQty(po)} unit)
                        </td>
                        <td className="px-4 py-3">
                          <StatusLabel status={po.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <CopyWhatsAppButton
                              po={po}
                              includePrices={false}
                              size="sm"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPo(po);
                                setRevisionMode(false);
                                setRevisionNote(po.catatan_revisi ?? '');
                              }}
                              className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedPo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sales-po-detail-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2
                    id="sales-po-detail-title"
                    className="font-mono text-lg font-bold text-slate-900"
                  >
                    {selectedPo.no_po}
                  </h2>
                  <StatusLabel status={selectedPo.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  Waktu PO: {formatTanggalWaktu(selectedPo.created_at)} · Dibuat oleh:{' '}
                  {selectedPo.dibuat_oleh}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPo(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Tutup detail"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">Informasi Toko</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {selectedPo.customer?.nama_toko ?? '-'}
                </p>
                <p className="mt-0.5 text-sm text-slate-600">
                  {selectedPo.customer?.alamat ?? '-'}
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">
                  Daftar Produk Pesanan
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="px-3.5 py-2.5">No</th>
                        <th className="px-3.5 py-2.5">Nama Barang</th>
                        <th className="px-3.5 py-2.5 text-right">Qty</th>
                        <th className="px-3.5 py-2.5">Satuan</th>
                        <th className="px-3.5 py-2.5 text-right">Harga Satuan</th>
                        <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPo.po_items.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="px-3.5 py-2.5 text-xs text-slate-500 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-3.5 py-2.5 font-medium text-slate-900">
                            {item.nama_barang}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                            {item.qty}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-700">{item.satuan}</td>
                          <td className="px-3.5 py-2.5 text-right text-slate-700 tabular-nums">
                            {formatRupiah(item.harga_satuan)}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                            {formatRupiah(item.qty * item.harga_satuan)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                        <td
                          colSpan={4}
                          className="px-3.5 py-3 text-right text-xs uppercase text-slate-600"
                        >
                          Total Pesanan
                        </td>
                        <td
                          colSpan={2}
                          className="px-3.5 py-3 text-right text-base text-blue-700 tabular-nums"
                        >
                          {formatRupiah(calculatePoTotal(selectedPo))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {revisionMode && (
                <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4">
                  <label
                    htmlFor="revision-note-input"
                    className="block text-sm font-bold text-red-900"
                  >
                    Catatan Revisi (Wajib Diisi)
                  </label>
                  <textarea
                    id="revision-note-input"
                    rows={3}
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    placeholder="Contoh: Stok barang A kosong, harap ubah ke 5 Dus atau ganti item."
                    className="w-full rounded-lg border border-red-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setRevisionMode(false)}
                      className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={processingStatus}
                      onClick={handleSubmitRevision}
                      className="min-h-[40px] rounded-lg bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      {processingStatus ? 'Menyimpan...' : 'Kirim Status Revisi'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <CopyWhatsAppButton po={selectedPo} includePrices={false} />
                {selectedPo.status !== 'Selesai' && (
                  <button
                    type="button"
                    onClick={() => {
                      const poToEdit = selectedPo;
                      setSelectedPo(null);
                      setEditingOrder(poToEdit);
                    }}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Koreksi Item</span>
                  </button>
                )}
              </div>

              {selectedPo.status !== 'Selesai' && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={processingStatus}
                    onClick={() => setRevisionMode(true)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 whitespace-nowrap shrink-0"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span>Revisi</span>
                  </button>
                  <button
                    type="button"
                    disabled={processingStatus}
                    onClick={() => handleApprove(selectedPo)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{processingStatus ? 'Memproses...' : 'Approve'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <PoEditorModal
          po={editingOrder}
          products={products}
          hidePrices={false}
          onClose={() => setEditingOrder(null)}
          onSaved={handlePoEdited}
          onError={(msg) => showToast('error', 'Gagal Memperbarui PO', msg)}
        />
      )}
    </div>
  );
}
