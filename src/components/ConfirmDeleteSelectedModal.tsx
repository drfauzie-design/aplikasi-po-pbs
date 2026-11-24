import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteSelectedModalProps {
  open: boolean;
  entityLabel: string;
  selectedCount: number;
  loading: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDeleteSelectedModal({
  open,
  entityLabel,
  selectedCount,
  loading,
  onConfirm,
  onClose,
}: ConfirmDeleteSelectedModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-selected-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3
              id="confirm-delete-selected-title"
              className="text-base font-bold text-slate-900"
            >
              Konfirmasi Hapus Data
            </h3>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="Tutup konfirmasi"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm font-medium text-slate-800">
            Yakin ingin menghapus{' '}
            <span className="font-bold text-red-700 tabular-nums">{selectedCount}</span>{' '}
            data {entityLabel} yang dipilih?
          </p>
          <p className="text-xs text-slate-500">
            Data yang sudah dihapus tidak dapat dikembalikan.
          </p>

          <div className="flex justify-end gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="min-h-[42px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={loading || selectedCount === 0}
              onClick={onConfirm}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              <span>{loading ? 'Menghapus...' : 'Ya, Hapus'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
