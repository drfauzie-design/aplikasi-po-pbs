import { useCallback, useEffect, useState } from 'react';
import type { AppSession, Customer } from './types/database';
import { fetchCustomers } from './lib/supabase';
import { ToastProvider, useToast } from './components/Toast';
import { LoginView } from './components/LoginView';
import { CustomerDashboard } from './components/CustomerDashboard';
import { SalesDashboard } from './components/SalesDashboard';
import { AdminDashboard } from './components/AdminDashboard';

function PurchaseOrderApp() {
  const { showToast } = useToast();
  const [session, setSession] = useState<AppSession | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    setCustomerLoadError(null);
    try {
      const list = await fetchCustomers();
      setCustomers(list);
    } catch (err) {
      setCustomerLoadError(
        err instanceof Error ? err.message : 'Gagal memuat daftar toko dari Supabase.'
      );
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleLogin = (nextSession: AppSession) => {
    setSession(nextSession);
    if (nextSession.type === 'customer') {
      showToast(
        'success',
        'Berhasil Masuk',
        `Selamat datang, ${nextSession.customer.nama_toko}.`
      );
    } else {
      const roleLabel =
        nextSession.user.role === 'admin_sales' ? 'Admin Sales' : 'Sales';
      showToast(
        'success',
        'Berhasil Masuk',
        `Selamat datang, ${nextSession.user.nama} (${roleLabel}).`
      );
    }
  };

  const handleLogout = () => {
    setSession(null);
    loadCustomers();
    showToast('info', 'Keluar Berhasil', 'Anda telah keluar dari sesi saat ini.');
  };

  if (!session) {
    return (
      <LoginView
        customers={customers}
        loadingCustomers={loadingCustomers}
        customerLoadError={customerLoadError}
        onRetryCustomers={loadCustomers}
        onLogin={handleLogin}
      />
    );
  }

  if (session.type === 'customer') {
    return (
      <CustomerDashboard customer={session.customer} onLogout={handleLogout} />
    );
  }

  if (session.user.role === 'admin_sales') {
    return <AdminDashboard user={session.user} onLogout={handleLogout} />;
  }

  return <SalesDashboard user={session.user} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <ToastProvider>
      <PurchaseOrderApp />
    </ToastProvider>
  );
}
