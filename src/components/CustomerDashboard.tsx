import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  FilePlus2,
  History,
  LogOut,
  Package,
  RefreshCw,
  Send,
  Store,
} from 'lucide-react';
import type {
  Customer,
  PoDraftItem,
  PoStatus,
  Product,
  PurchaseOrderWithDetails,
} from '../types/database';
import {
  createPurchaseOrder,
  fetchProducts,
  fetchPurchaseOrders,
} from '../lib/supabase';
import {
  calculatePoTotalQty,
  formatTanggalWaktu,
  matchesDateFilter,
  type DateFilterCriteria,
} from '../lib/formatters';
import { useToast } from './Toast';
import { PoItemsEditor, createEmptyDraftItem } from './PoItemsEditor';
import { DateFilterBar } from './DateFilterBar';
import { StatusLabel } from './StatusLabel';
import { PoEditorModal } from './PoEditorModal';
import { CompanyBrand } from './CompanyBrand';
import { CopyWhatsAppButton } from './CopyWhatsAppButton';

interface CustomerDashboardProps {
  customer: Customer;
  onLogout: () => void;
}

export function CustomerDashboard({ customer, onLogout }: CustomerDashboardProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'buat' | 'riwayat'>('buat');

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [draftItems, setDraftItems] = useState<PoDraftItem[]>([createEmptyDraftItem()]);
  const [dateFilter, setDateFilter] = useState<DateFilterCriteria>({
    tanggal: '',
    bulan: '',
    tahun: '',
  });
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderWithDetails | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, pos] = await Promise.all([
        fetchProducts(),
        fetchPurchaseOrders(customer.id),
      ]);
      setProducts(prods);
      setOrders(pos);
    } catch (err) {
      showToast(
        'error',
        'Gagal Memuat Data',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungi database.'
      );
    } finally {
      setLoading(false);
    }
  }, [customer.id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const availableYears = useMemo(() => {
    return Array.from(
      new Set(
        orders
          .map((o) => {
            const d = new Date(o.created_at);
            return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear());
          })
          .filter(Boolean)
      )
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((po) => matchesDateFilter(po.created_at, dateFilter));
  }, [orders, dateFilter]);

  const validDraftItems = useMemo(
    () => draftItems.filter((item) => item.product_id && item.qty > 0),
    [draftItems]
  );

  const totalDraftQty = useMemo(
    () => validDraftItems.reduce((sum, item) => sum + item.qty, 0),
    [validDraftItems]
  );

  const handleSubmitPo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validDraftItems.length === 0) {
      showToast(
        'error',
        'Pesanan Belum Lengkap',
        'Pilih minimal 1 produk dan tentukan jumlah pesanan sebelum mengirim PO.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPurchaseOrder({
        customerId: customer.id,
        dibuatOleh: customer.nama_toko,
        items: validDraftItems,
      });

      showToast(
        'success',
        'PO Berhasil Dikirim',
        `Nomor PO ${created.no_po} tersimpan dengan status Pending Approval.`
      );
      setDraftItems([createEmptyDraftItem()]);
      await loadData();
      setActiveTab('riwayat');
      setExpandedOrderId(created.id);
    } catch (err) {
      showToast(
        'error',
        'Gagal Mengirim PO',
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan PO.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePoEdited = async (newStatus: PoStatus) => {
    setEditingOrder(null);
    showToast(
      'success',
      'Perubahan PO Disimpan',
      newStatus === 'Pending Approval'
        ? 'Status PO diperbarui menjadi Pending Approval untuk ditinjau Sales.'
        : 'Item pesanan berhasil diperbarui.'
    );
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <CompanyBrand variant="light" size="sm" />
          </div>

          <nav className="hidden items-center gap-6 md:flex">
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
              Riwayat &amp; Edit PO ({orders.length})
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

        <div className="grid grid-cols-2 gap-1 border-t border-slate-200 bg-slate-50 px-1 md:hidden">
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
            <span>Buat PO Baru</span>
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
            <span>Riwayat PO ({orders.length})</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Akun Toko Aktif
                {customer.kode_pelanggan ? ` · Kode: ${customer.kode_pelanggan}` : ''}
              </p>
              <h1 className="text-lg font-bold text-slate-900">{customer.nama_toko}</h1>
              <p className="mt-0.5 text-sm text-slate-600">
                {customer.alamat}
                {customer.telepon ? ` · Telp: ${customer.telepon}` : ''}
                {customer.sales_pic ? ` · Sales PIC: ${customer.sales_pic}` : ''}
              </p>
            </div>
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

        {activeTab === 'buat' ? (
          <form
            onSubmit={handleSubmitPo}
            className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Formulir Purchase Order</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cari nama produk, tentukan jumlah dan satuan (Dus / Pack), lalu kirim pesanan.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500">
                  Nama Toko
                </label>
                <input
                  type="text"
                  readOnly
                  value={customer.nama_toko}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500">
                  Alamat Pengiriman
                </label>
                <input
                  type="text"
                  readOnly
                  value={customer.alamat}
                  className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                />
              </div>
            </div>

            <PoItemsEditor
              items={draftItems}
              products={products}
              onChange={setDraftItems}
              hidePrices={true}
            />

            <div className="flex flex-col justify-between gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900 tabular-nums">
                  {validDraftItems.length}
                </span>{' '}
                jenis barang dipilih
                <span className="mx-2 text-slate-300">·</span>
                Total kuantitas:{' '}
                <span className="font-semibold text-slate-900 tabular-nums">
                  {totalDraftQty}
                </span>{' '}
                unit
              </div>

              <button
                type="submit"
                disabled={submitting || validDraftItems.length === 0}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto whitespace-nowrap shrink-0"
              >
                <Send className="h-4 w-4" />
                <span>{submitting ? 'Mengirim PO...' : 'Kirim PO'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <DateFilterBar
              filter={dateFilter}
              onChange={setDateFilter}
              availableYears={availableYears}
            />

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
                  />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                <Package className="h-10 w-10 text-slate-300" />
                <h3 className="mt-3 text-base font-bold text-slate-900">
                  Belum Ada Riwayat PO
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {orders.length === 0
                    ? 'Anda belum pernah mengirimkan Purchase Order. Mulai buat pesanan pertama Anda.'
                    : 'Tidak ada PO yang cocok dengan filter tanggal yang dipilih.'}
                </p>
                {orders.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('buat')}
                    className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    <span>Buat PO Pertama</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((po) => {
                  const isExpanded = expandedOrderId === po.id;
                  const totalQty = calculatePoTotalQty(po);
                  const canEdit = po.status !== 'Selesai';

                  return (
                    <div
                      key={po.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >
                      <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono text-base font-bold text-slate-900">
                              {po.no_po}
                            </span>
                            <StatusLabel status={po.status} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="tabular-nums">
                              {formatTanggalWaktu(po.created_at)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {po.po_items.length} jenis barang
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">Total {totalQty} unit</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <CopyWhatsAppButton
                            po={po}
                            includePrices={false}
                            size="sm"
                          />
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingOrder(po)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap shrink-0"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit / Koreksi PO</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedOrderId(isExpanded ? null : po.id)
                            }
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <span>{isExpanded ? 'Tutup Rincian' : 'Lihat Rincian'}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {po.status === 'Revisi' && po.catatan_revisi && (
                        <div className="border-t border-red-100 bg-red-50/80 px-4 py-3 text-xs text-red-900 sm:px-5">
                          <span className="font-bold">Catatan Revisi Sales:</span>{' '}
                          {po.catatan_revisi}
                        </div>
                      )}

                      {isExpanded && (
                        <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-700">
                              Detail Barang Pesanan ({po.po_items.length} item)
                            </p>
                            <CopyWhatsAppButton
                              po={po}
                              includePrices={false}
                              size="sm"
                            />
                          </div>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full border-collapse text-left text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                                  <th className="px-3.5 py-2.5">No</th>
                                  <th className="px-3.5 py-2.5">Nama Barang</th>
                                  <th className="px-3.5 py-2.5 text-right">Qty</th>
                                  <th className="px-3.5 py-2.5">Satuan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {po.po_items.map((item, idx) => (
                                  <tr key={item.id || idx} className="hover:bg-slate-50/60">
                                    <td className="px-3.5 py-2.5 text-xs text-slate-500 tabular-nums">
                                      {idx + 1}
                                    </td>
                                    <td className="px-3.5 py-2.5 font-medium text-slate-900">
                                      {item.nama_barang}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                                      {item.qty}
                                    </td>
                                    <td className="px-3.5 py-2.5 text-slate-700">
                                      {item.satuan}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {editingOrder && (
        <PoEditorModal
          po={editingOrder}
          products={products}
          hidePrices={true}
          onClose={() => setEditingOrder(null)}
          onSaved={handlePoEdited}
          onError={(msg) => showToast('error', 'Gagal Memperbarui PO', msg)}
        />
      )}
    </div>
  );
}
