import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  LogOut,
  Package,
  PackageCheck,
  Printer,
  Radio,
  RefreshCw,
  Search,
  Store,
  Users,
  X,
} from 'lucide-react';
import type {
  Customer,
  PoStatus,
  Product,
  PurchaseOrder,
  PurchaseOrderWithDetails,
  StaffUser,
} from '../types/database';
import {
  fetchCustomers,
  fetchProducts,
  fetchPurchaseOrders,
  fetchStaffUsers,
  supabase,
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
import { exportPurchaseOrdersReport } from '../lib/excel';
import { useToast } from './Toast';
import { StatusLabel } from './StatusLabel';
import { DateFilterBar } from './DateFilterBar';
import { PrintPoSheet } from './PrintPoSheet';
import { AdminCustomerManager } from './AdminCustomerManager';
import { AdminProductManager } from './AdminProductManager';
import { AdminStaffManager } from './AdminStaffManager';
import { CompanyBrand } from './CompanyBrand';
import { CopyWhatsAppButton } from './CopyWhatsAppButton';

interface AdminDashboardProps {
  user: Omit<StaffUser, 'pin'>;
  onLogout: () => void;
}

type AdminTab = 'realtime' | 'data' | 'staff' | 'laporan';
type DataSubTab = 'customers' | 'products';
type StatusFilter = 'Semua' | PoStatus;

export function AdminDashboard({ user, onLogout }: AdminDashboardProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>('realtime');
  const [dataSubTab, setDataSubTab] = useState<DataSubTab>('customers');

  const [orders, setOrders] = useState<PurchaseOrderWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [newlyApprovedIds, setNewlyApprovedIds] = useState<Record<string, boolean>>({});

  // Realtime tab filters & modals
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailPo, setDetailPo] = useState<PurchaseOrderWithDetails | null>(null);
  const [printPo, setPrintPo] = useState<PurchaseOrderWithDetails | null>(null);
  const [updatingPo, setUpdatingPo] = useState(false);

  // Report filters
  const [reportCustomerId, setReportCustomerId] = useState('');
  const [reportDateFilter, setReportDateFilter] = useState<DateFilterCriteria>({
    tanggal: '',
    bulan: '',
    tahun: '',
  });

  const ordersRef = useRef<PurchaseOrderWithDetails[]>([]);
  ordersRef.current = orders;

  const loadAllData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [pos, custs, prods, usersList] = await Promise.all([
          fetchPurchaseOrders(),
          fetchCustomers(),
          fetchProducts(),
          fetchStaffUsers(),
        ]);
        setOrders(pos);
        setCustomers(custs);
        setProducts(prods);
        setStaffUsers(usersList);

        // Keep open detail modal synced if realtime refreshed
        setDetailPo((prev) => (prev ? pos.find((o) => o.id === prev.id) ?? null : null));
      } catch (err) {
        showToast(
          'error',
          'Gagal Memuat Data',
          err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungi Supabase.'
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Supabase Realtime Subscription on purchase_orders and po_items
  useEffect(() => {
    const channel = supabase
      .channel('admin-po-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'purchase_orders' },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as PurchaseOrder;
            const previous = ordersRef.current.find((o) => o.id === updated.id);
            if (
              updated.status === 'Approved' &&
              (!previous || previous.status !== 'Approved')
            ) {
              setNewlyApprovedIds((prev) => ({ ...prev, [updated.id]: true }));
              showToast(
                'success',
                'PO Baru Disetujui Sales',
                `${updated.no_po} baru saja disetujui dan siap diproses.`
              );
            }
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as PurchaseOrder;
            showToast(
              'info',
              'PO Baru Masuk',
              `${inserted.no_po} baru saja dibuat.`
            );
          }

          await loadAllData(true);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'po_items' },
        async () => {
          await loadAllData(true);
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAllData, showToast]);

  const filteredRealtimeOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((po) => {
      if (statusFilter !== 'Semua' && po.status !== statusFilter) return false;
      if (!q) return true;
      const target = `${po.no_po} ${po.customer?.nama_toko ?? ''} ${
        po.customer?.alamat ?? ''
      } ${po.dibuat_oleh}`.toLowerCase();
      return target.includes(q);
    });
  }, [orders, statusFilter, searchQuery]);

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

  const filteredReportOrders = useMemo(() => {
    return orders.filter((po) => {
      if (reportCustomerId && po.customer_id !== reportCustomerId) return false;
      return matchesDateFilter(po.created_at, reportDateFilter);
    });
  }, [orders, reportCustomerId, reportDateFilter]);

  const reportTotalValue = useMemo(
    () => filteredReportOrders.reduce((sum, po) => sum + calculatePoTotal(po), 0),
    [filteredReportOrders]
  );

  const reportTotalQty = useMemo(
    () => filteredReportOrders.reduce((sum, po) => sum + calculatePoTotalQty(po), 0),
    [filteredReportOrders]
  );

  const approvedCount = useMemo(
    () => orders.filter((o) => o.status === 'Approved').length,
    [orders]
  );
  const pendingCount = useMemo(
    () => orders.filter((o) => o.status === 'Pending Approval').length,
    [orders]
  );

  const handleMarkStatus = async (po: PurchaseOrderWithDetails, status: PoStatus) => {
    setUpdatingPo(true);
    try {
      await updatePurchaseOrderStatus({ poId: po.id, status });
      if (status !== 'Approved') {
        setNewlyApprovedIds((prev) => {
          const copy = { ...prev };
          delete copy[po.id];
          return copy;
        });
      }
      showToast('success', 'Status Diperbarui', `${po.no_po} diubah menjadi ${status}.`);
      await loadAllData(true);
    } catch (err) {
      showToast(
        'error',
        'Gagal Memperbarui Status',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setUpdatingPo(false);
    }
  };

  const salesUsers = useMemo(
    () => staffUsers.filter((u) => u.role === 'sales'),
    [staffUsers]
  );

  const navItems: { id: AdminTab; label: string; icon: typeof Activity }[] = [
    { id: 'realtime', label: 'Dasbor Real-Time', icon: Activity },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'staff', label: 'Kelola Staff / Sales', icon: Users },
    { id: 'laporan', label: 'Laporan Pembelian', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-72 shrink-0 flex-col justify-between border-r border-slate-200 bg-white lg:flex">
        <div>
          <div className="border-b border-slate-200 px-5 py-4">
            <CompanyBrand variant="light" size="sm" />
            <p className="mt-1.5 text-xs text-slate-500">Admin Sales · Sistem PO</p>
          </div>

          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3">
            <p className="text-sm font-bold text-slate-900">{user.nama}</p>
            <p className="font-mono text-xs text-slate-500">{user.no_hp}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:static">
          <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center justify-between gap-3 min-w-0">
              <div className="lg:hidden">
                <CompanyBrand variant="light" size="sm" />
              </div>
              <span className="hidden text-sm font-semibold text-slate-600 lg:inline">
                {navItems.find((n) => n.id === activeTab)?.label}
              </span>
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto shrink-0">
              <div
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  realtimeConnected
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }`}
              >
                <Radio className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {realtimeConnected ? 'Realtime Aktif' : 'Menghubungkan...'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => loadAllData()}
                disabled={loading}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap lg:hidden"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 border-t border-slate-200 bg-slate-50 px-1 lg:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              const mobileLabel =
                item.id === 'staff' ? 'Staff' : item.label.split(' ')[0];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[46px] flex-col items-center justify-center gap-1 rounded-t-lg px-1.5 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                    active
                      ? 'border-b-2 border-blue-700 bg-white text-blue-700'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-full">{mobileLabel}</span>
                </button>
              );
            })}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          {activeTab === 'realtime' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">Total PO Masuk</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                    {orders.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">Siap Diproses (Approved)</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">
                    {approvedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">Pending Approval</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">
                    {pendingCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">Total Toko / Produk</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                    {customers.length} · {products.length}
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    ['Semua', 'Approved', 'Pending Approval', 'Revisi', 'Selesai'] as StatusFilter[]
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
              ) : filteredRealtimeOrders.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
                  <p className="text-base font-bold text-slate-900">
                    Tidak Ada Pesanan Ditemukan
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Pesanan baru atau yang disetujui Sales akan muncul otomatis secara real-time di sini.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="px-4 py-3">No. PO</th>
                        <th className="px-4 py-3">Toko</th>
                        <th className="px-4 py-3">Waktu</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Total Nilai</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRealtimeOrders.map((po) => {
                        const isNewApproved = Boolean(newlyApprovedIds[po.id]);
                        const totalVal = calculatePoTotal(po);
                        return (
                          <tr
                            key={po.id}
                            className={`transition-colors hover:bg-slate-50/80 ${
                              isNewApproved ? 'bg-emerald-50/40' : ''
                            }`}
                          >
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {po.no_po}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-slate-900">
                                {po.customer?.nama_toko ?? '-'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {po.customer?.alamat ?? '-'}
                              </p>
                            </td>
                            <td className="px-4 py-3.5 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                              {formatTanggalWaktu(po.created_at)}
                            </td>
                            <td className="px-4 py-3.5">
                              <StatusLabel
                                status={po.status}
                                isNewlyApproved={isNewApproved}
                              />
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                              {formatRupiah(totalVal)}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDetailPo(po);
                                    if (isNewApproved) {
                                      setNewlyApprovedIds((prev) => {
                                        const next = { ...prev };
                                        delete next[po.id];
                                        return next;
                                      });
                                    }
                                  }}
                                  className="inline-flex min-h-[36px] items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                                >
                                  Rincian Harga
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPrintPo(po)}
                                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  <span>Cetak</span>
                                </button>
                                <CopyWhatsAppButton
                                  po={po}
                                  includePrices={true}
                                  size="sm"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">Data</h1>
                  <p className="text-xs text-slate-500">
                    Pilih sub-bagian Customer atau Barang untuk mengelola master data.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setDataSubTab('customers')}
                    className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap ${
                      dataSubTab === 'customers'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Store className="h-4 w-4 shrink-0" />
                    <span>Customer ({customers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataSubTab('products')}
                    className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap ${
                      dataSubTab === 'products'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Package className="h-4 w-4 shrink-0" />
                    <span>Barang ({products.length})</span>
                  </button>
                </div>
              </div>

              {dataSubTab === 'customers' ? (
                <AdminCustomerManager
                  customers={customers}
                  salesUsers={salesUsers}
                  onRefresh={() => loadAllData(true)}
                />
              ) : (
                <AdminProductManager
                  products={products}
                  onRefresh={() => loadAllData(true)}
                />
              )}
            </div>
          )}

          {activeTab === 'staff' && (
            <AdminStaffManager
              users={staffUsers}
              currentUserId={user.id}
              onRefresh={() => loadAllData(true)}
            />
          )}

          {activeTab === 'laporan' && (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Laporan Riwayat Pembelian
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Filter transaksi berdasarkan nama toko, tanggal spesifik, bulan, dan tahun.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={filteredReportOrders.length === 0}
                  onClick={() => {
                    exportPurchaseOrdersReport(filteredReportOrders);
                    showToast(
                      'success',
                      'Laporan Diekspor',
                      `${filteredReportOrders.length} transaksi PO diekspor ke file Excel.`
                    );
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 whitespace-nowrap shrink-0"
                >
                  <Download className="h-4 w-4" />
                  <span>Ekspor Laporan ke Excel</span>
                </button>
              </div>

              <DateFilterBar
                filter={reportDateFilter}
                onChange={setReportDateFilter}
                availableYears={availableYears}
                customers={customers}
                selectedCustomerId={reportCustomerId}
                onCustomerChange={setReportCustomerId}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Jumlah PO Terfilter
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                    {filteredReportOrders.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Total Kuantitas Barang
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                    {reportTotalQty} unit
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Akumulasi Nilai Pembelian
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">
                    {formatRupiah(reportTotalValue)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-4 py-3">No. PO</th>
                      <th className="px-4 py-3">Tanggal PO</th>
                      <th className="px-4 py-3">Nama Toko</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Total Item</th>
                      <th className="px-4 py-3 text-right">Total Nilai</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReportOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm text-slate-500"
                        >
                          Tidak ada transaksi pada rentang filter ini.
                        </td>
                      </tr>
                    ) : (
                      filteredReportOrders.map((po) => (
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
                              Sales: {po.customer?.sales_pic ?? '-'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <StatusLabel status={po.status} />
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-700 tabular-nums whitespace-nowrap">
                            {po.po_items.length} jenis ({calculatePoTotalQty(po)})
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatRupiah(calculatePoTotal(po))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailPo(po)}
                                className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                              >
                                Detail
                              </button>
                              <button
                                type="button"
                                onClick={() => setPrintPo(po)}
                                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                              >
                                <Printer className="h-3.5 w-3.5" />
                                <span>Nota</span>
                              </button>
                              <CopyWhatsAppButton
                                po={po}
                                includePrices={true}
                                size="sm"
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {detailPo && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-po-detail-title"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2
                    id="admin-po-detail-title"
                    className="font-mono text-lg font-bold text-slate-900"
                  >
                    {detailPo.no_po}
                  </h2>
                  <StatusLabel status={detailPo.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500 tabular-nums">
                  {formatTanggalWaktu(detailPo.created_at)} · Dibuat oleh:{' '}
                  {detailPo.dibuat_oleh}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailPo(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Pelanggan / Toko</p>
                  <p className="mt-1 text-base font-bold text-slate-900">
                    {detailPo.customer?.nama_toko ?? '-'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {detailPo.customer?.alamat ?? '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Sales PIC</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {detailPo.customer?.sales_pic ?? '-'}
                  </p>
                  {detailPo.catatan_revisi && (
                    <p className="mt-2 text-xs text-red-700">
                      Catatan Revisi: {detailPo.catatan_revisi}
                    </p>
                  )}
                </div>
              </div>

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
                    {detailPo.po_items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="px-3.5 py-2.5 text-xs text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-900">
                          {item.nama_barang}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold tabular-nums">
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
                      <td colSpan={4} className="px-3.5 py-3 text-right text-xs uppercase text-slate-600">
                        Total Keseluruhan
                      </td>
                      <td colSpan={2} className="px-3.5 py-3 text-right text-base text-blue-700 tabular-nums">
                        {formatRupiah(calculatePoTotal(detailPo))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintPo(detailPo)}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <Printer className="h-4 w-4" />
                  <span>Cetak Surat Jalan / Nota PO</span>
                </button>
                <CopyWhatsAppButton po={detailPo} includePrices={true} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {detailPo.status === 'Pending Approval' && (
                  <button
                    type="button"
                    disabled={updatingPo}
                    onClick={() => handleMarkStatus(detailPo, 'Approved')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Approve</span>
                  </button>
                )}

                {detailPo.status === 'Approved' && (
                  <button
                    type="button"
                    disabled={updatingPo}
                    onClick={() => handleMarkStatus(detailPo, 'Selesai')}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <PackageCheck className="h-4 w-4" />
                    <span>Tandai Selesai</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {printPo && <PrintPoSheet po={printPo} onClose={() => setPrintPo(null)} />}
    </div>
  );
}
