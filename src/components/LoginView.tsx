import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw, Store, UserCheck } from 'lucide-react';
import type { AppSession, Customer } from '../types/database';
import { authenticateStaff } from '../lib/supabase';
import { SearchableSelect } from './SearchableSelect';
import { CompanyBrand } from './CompanyBrand';

interface LoginViewProps {
  customers: Customer[];
  loadingCustomers: boolean;
  customerLoadError: string | null;
  onRetryCustomers: () => void;
  onLogin: (session: AppSession) => void;
}

export function LoginView({
  customers,
  loadingCustomers,
  customerLoadError,
  onRetryCustomers,
  onLogin,
}: LoginViewProps) {
  const [activeTab, setActiveTab] = useState<'customer' | 'staff'>('customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [noHp, setNoHp] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [submittingStaff, setSubmittingStaff] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => {
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
    [customers]
  );

  const handleCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const chosen = customers.find((c) => c.id === selectedCustomerId);
    if (!chosen) {
      setErrorMsg('Silakan pilih atau cari Nama Toko Anda terlebih dahulu.');
      return;
    }
    onLogin({ type: 'customer', customer: chosen });
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPin = pin.trim();
    if (!noHp.trim()) {
      setErrorMsg('Nomor HP wajib diisi.');
      return;
    }
    if (cleanPin.length < 4 || cleanPin.length > 6) {
      setErrorMsg('PIN harus terdiri dari 4 hingga 6 digit.');
      return;
    }

    setSubmittingStaff(true);
    try {
      const user = await authenticateStaff(noHp, cleanPin);
      onLogin({ type: 'staff', user });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal masuk. Periksa Nomor HP dan PIN.'
      );
    } finally {
      setSubmittingStaff(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-12">
          <div className="flex flex-col justify-between bg-slate-900 p-7 text-white sm:p-10 lg:col-span-5">
            <div>
              <div className="mb-6">
                <CompanyBrand variant="dark" size="lg" />
              </div>
              <p className="text-xs font-semibold tracking-wider text-blue-300 uppercase">
                Portal Distribusi &amp; Pemesanan
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
                Sistem Purchase Order
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Kelola permintaan barang toko, persetujuan Sales, dan pemantauan nota PO secara
                terpadu dan real-time.
              </p>
            </div>

            <div className="mt-8 space-y-4 border-t border-slate-800 pt-6 text-xs text-slate-300">
              <div>
                <p className="font-semibold text-white">Customer (Toko)</p>
                <p className="mt-0.5 text-slate-400">
                  Masuk langsung dengan memilih nama toko untuk membuat dan memantau PO.
                </p>
              </div>
              <div>
                <p className="font-semibold text-white">Sales &amp; Admin Sales</p>
                <p className="mt-0.5 text-slate-400">
                  Masuk dengan Nomor HP dan PIN terdaftar untuk persetujuan, master data, dan
                  cetak nota.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-10 lg:col-span-7">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Masuk ke Aplikasi</h2>
              <p className="mt-1 text-sm text-slate-500">
                Pilih peran Anda untuk melanjutkan ke halaman kerja.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Pilihan Masuk"
              className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'customer'}
                onClick={() => {
                  setActiveTab('customer');
                  setErrorMsg(null);
                }}
                className={`flex min-w-0 w-full min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
                  activeTab === 'customer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">Customer (Toko)</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'staff'}
                onClick={() => {
                  setActiveTab('staff');
                  setErrorMsg(null);
                }}
                className={`flex min-w-0 w-full min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap sm:text-sm ${
                  activeTab === 'staff'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                <span className="truncate">Staff (Sales &amp; Admin)</span>
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {errorMsg}
              </div>
            )}

            {activeTab === 'customer' ? (
              <form onSubmit={handleCustomerSubmit} className="space-y-5">
                {customerLoadError && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    <span>{customerLoadError}</span>
                    <button
                      type="button"
                      onClick={onRetryCustomers}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Muat Ulang</span>
                    </button>
                  </div>
                )}

                <SearchableSelect
                  id="customer-login-select"
                  label="Cari & Pilih Nama Toko"
                  options={customerOptions}
                  value={selectedCustomerId}
                  onChange={setSelectedCustomerId}
                  disabled={loadingCustomers}
                  placeholder={
                    loadingCustomers
                      ? 'Memuat daftar toko...'
                      : 'Ketik Nama Toko atau Alamat...'
                  }
                  emptyMessage="Nama toko tidak ditemukan. Hubungi Admin Sales untuk pendaftaran toko."
                />

                <p className="text-xs leading-relaxed text-slate-500">
                  Masuk tanpa kata sandi atau PIN. Jika toko Anda belum terdaftar dalam daftar,
                  silakan hubungi tim Admin Sales untuk penambahan akun toko.
                </p>

                <button
                  type="submit"
                  disabled={loadingCustomers || !selectedCustomerId}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Store className="h-4 w-4" />
                  <span>Masuk sebagai Toko</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleStaffSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="staff-phone"
                    className="mb-1.5 block text-sm font-semibold text-slate-800"
                  >
                    Nomor HP Terdaftar
                  </label>
                  <input
                    id="staff-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="staff-pin"
                    className="mb-1.5 block text-sm font-semibold text-slate-800"
                  >
                    PIN Keamanan (4–6 Digit)
                  </label>
                  <div className="relative">
                    <input
                      id="staff-pin"
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Masukkan PIN 4-6 digit"
                      className="min-h-[46px] w-full rounded-lg border border-slate-300 bg-white pl-3.5 pr-12 font-mono text-sm tracking-widest text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                    >
                      {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                >
                  {submittingStaff ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memverifikasi Akun...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Masuk sebagai Staff</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
