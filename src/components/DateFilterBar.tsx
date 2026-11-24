import { RotateCcw } from 'lucide-react';
import { NAMA_BULAN, type DateFilterCriteria } from '../lib/formatters';
import type { Customer } from '../types/database';

interface DateFilterBarProps {
  filter: DateFilterCriteria;
  onChange: (next: DateFilterCriteria) => void;
  availableYears: string[];
  customers?: Customer[];
  selectedCustomerId?: string;
  onCustomerChange?: (customerId: string) => void;
}

export function DateFilterBar({
  filter,
  onChange,
  availableYears,
  customers,
  selectedCustomerId,
  onCustomerChange,
}: DateFilterBarProps) {
  const currentYear = String(new Date().getFullYear());
  const years = Array.from(new Set([currentYear, ...availableYears])).sort((a, b) =>
    b.localeCompare(a)
  );

  const hasFilter = Boolean(
    filter.tanggal || filter.bulan || filter.tahun || selectedCustomerId
  );

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {customers && onCustomerChange && (
        <div className="min-w-[210px] flex-1">
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">
            Filter Toko
          </label>
          <select
            value={selectedCustomerId ?? ''}
            onChange={(e) => onCustomerChange(e.target.value)}
            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
          >
            <option value="">Semua Toko</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama_toko}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="min-w-[160px] flex-1">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Tanggal Spesifik
        </label>
        <input
          type="date"
          value={filter.tanggal}
          onChange={(e) =>
            onChange({
              ...filter,
              tanggal: e.target.value,
            })
          }
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
        />
      </div>

      <div className="min-w-[140px] flex-1">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Bulan
        </label>
        <select
          value={filter.bulan}
          onChange={(e) => onChange({ ...filter, bulan: e.target.value })}
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
        >
          <option value="">Semua Bulan</option>
          {NAMA_BULAN.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-[120px] flex-1">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">
          Tahun
        </label>
        <select
          value={filter.tahun}
          onChange={(e) => onChange({ ...filter, tahun: e.target.value })}
          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
        >
          <option value="">Semua Tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {hasFilter && (
        <button
          type="button"
          onClick={() => {
            onChange({ tanggal: '', bulan: '', tahun: '' });
            onCustomerChange?.('');
          }}
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reset Filter</span>
        </button>
      )}
    </div>
  );
}
