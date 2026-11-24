import React, { useMemo, useState } from 'react';
import {
  Edit3,
  Eye,
  EyeOff,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import type { StaffUser, UserRole } from '../types/database';
import {
  createStaffUser,
  deleteStaffUser,
  updateStaffUser,
} from '../lib/supabase';
import { useToast } from './Toast';

interface AdminStaffManagerProps {
  users: StaffUser[];
  currentUserId: string;
  onRefresh: () => Promise<void>;
}

export function AdminStaffManager({
  users,
  currentUserId,
  onRefresh,
}: AdminStaffManagerProps) {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [formState, setFormState] = useState({
    nama: '',
    no_hp: '',
    pin: '',
    role: 'sales' as UserRole,
  });
  const [showModalPin, setShowModalPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return `${u.nama} ${u.no_hp} ${u.role}`.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const openAddModal = () => {
    setEditingUser(null);
    setFormState({
      nama: '',
      no_hp: '',
      pin: '',
      role: 'sales',
    });
    setShowModalPin(false);
    setModalOpen(true);
  };

  const openEditModal = (u: StaffUser) => {
    setEditingUser(u);
    setFormState({
      nama: u.nama,
      no_hp: u.no_hp,
      pin: u.pin ?? '',
      role: u.role,
    });
    setShowModalPin(false);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = formState.pin.trim();

    if (!formState.nama.trim() || !formState.no_hp.trim()) {
      showToast('error', 'Data Belum Lengkap', 'Nama Lengkap dan Nomor HP wajib diisi.');
      return;
    }

    if (!editingUser && !/^\d{4,6}$/.test(cleanPin)) {
      showToast('error', 'PIN Tidak Valid', 'PIN harus berupa 4 hingga 6 digit angka.');
      return;
    }

    if (editingUser && cleanPin && !/^\d{4,6}$/.test(cleanPin)) {
      showToast('error', 'PIN Tidak Valid', 'PIN harus berupa 4 hingga 6 digit angka.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        await updateStaffUser(editingUser.id, {
          nama: formState.nama,
          no_hp: formState.no_hp,
          pin: cleanPin || undefined,
          role: formState.role,
        });
        showToast(
          'success',
          'Akun Staff Diperbarui',
          `${formState.nama} berhasil diperbarui.`
        );
      } else {
        await createStaffUser({
          nama: formState.nama,
          no_hp: formState.no_hp,
          pin: cleanPin,
          role: formState.role,
        });
        showToast(
          'success',
          'Akun Staff Ditambahkan',
          `${formState.nama} (${formState.role === 'admin_sales' ? 'Admin Sales' : 'Sales'}) berhasil ditambahkan.`
        );
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menyimpan Akun',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: StaffUser) => {
    if (u.id === currentUserId) {
      showToast(
        'error',
        'Tidak Dapat Menghapus',
        'Akun yang sedang login saat ini tidak dapat dihapus.'
      );
      return;
    }

    setSaving(true);
    try {
      await deleteStaffUser(u.id);
      showToast('success', 'Akun Staff Dihapus', `${u.nama} telah dihapus dari sistem.`);
      await onRefresh();
    } catch (err) {
      showToast(
        'error',
        'Gagal Menghapus Akun',
        err instanceof Error ? err.message : 'Terjadi kesalahan.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Kelola Staff / Sales</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Kelola akun pengguna dengan peran Sales dan Admin Sales beserta Nomor HP dan PIN login.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Staff / Sales</span>
        </button>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: `Semua (${users.length})` },
              {
                id: 'sales',
                label: `Sales (${users.filter((u) => u.role === 'sales').length})`,
              },
              {
                id: 'admin_sales',
                label: `Admin Sales (${users.filter((u) => u.role === 'admin_sales').length})`,
              },
            ] as { id: 'all' | UserRole; label: string }[]
          ).map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoleFilter(tab.id)}
                className={`min-h-[40px] rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor HP..."
            className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="px-4 py-3">Nama Lengkap</th>
              <th className="px-4 py-3">Nomor HP</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">PIN</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                  Belum ada akun staff / sales yang sesuai.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const isRevealed = Boolean(revealedPins[u.id]);
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <span>{u.nama}</span>
                      {isSelf && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          (Akun Anda)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap tabular-nums">
                      {u.no_hp}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.role === 'admin_sales' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Admin Sales</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800">
                          <UserCheck className="h-3.5 w-3.5" />
                          <span>Sales</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span className="font-mono text-xs tracking-widest text-slate-700 tabular-nums">
                          {isRevealed ? u.pin || '-' : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedPins((prev) => ({
                              ...prev,
                              [u.id]: !prev[u.id],
                            }))
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={isRevealed ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                        >
                          {isRevealed ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving || isSelf}
                          onClick={() => handleDelete(u)}
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
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
                {editingUser ? 'Edit Akun Staff / Sales' : 'Tambah Akun Staff / Sales'}
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
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={formState.nama}
                  onChange={(e) =>
                    setFormState({ ...formState, nama: e.target.value })
                  }
                  placeholder="Contoh: Budi Santoso"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Nomor HP
                  </label>
                  <input
                    type="tel"
                    required
                    value={formState.no_hp}
                    onChange={(e) =>
                      setFormState({ ...formState, no_hp: e.target.value })
                    }
                    placeholder="081234567890"
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Role Pengguna
                  </label>
                  <select
                    value={formState.role}
                    onChange={(e) =>
                      setFormState({ ...formState, role: e.target.value as UserRole })
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="sales">sales</option>
                    <option value="admin_sales">admin_sales</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                  PIN Login (4–6 Digit Angka)
                </label>
                <div className="relative">
                  <input
                    type={showModalPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={6}
                    required={!editingUser}
                    value={formState.pin}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        pin: e.target.value.replace(/\D/g, ''),
                      })
                    }
                    placeholder={
                      editingUser
                        ? 'Kosongkan jika tidak ingin mengubah PIN'
                        : 'Masukkan 4-6 digit PIN'
                    }
                    className="min-h-[44px] w-full rounded-lg border border-slate-300 pl-3.5 pr-11 font-mono text-sm tracking-widest text-slate-900 placeholder:font-sans placeholder:tracking-normal focus:border-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPin((prev) => !prev)}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showModalPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  >
                    {showModalPin ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
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
                  {saving ? 'Menyimpan...' : 'Simpan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
