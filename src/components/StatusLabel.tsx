import { AlertTriangle, CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import type { PoStatus } from '../types/database';

interface StatusLabelProps {
  status: PoStatus;
  isNewlyApproved?: boolean;
}

export function StatusLabel({ status, isNewlyApproved }: StatusLabelProps) {
  const config: Record<
    PoStatus,
    { colorClass: string; icon: typeof Clock; label: string }
  > = {
    'Pending Approval': {
      colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
      icon: Clock,
      label: 'Pending Approval',
    },
    Approved: {
      colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: CheckCircle2,
      label: 'Approved',
    },
    Revisi: {
      colorClass: 'text-red-700 bg-red-50 border-red-200',
      icon: AlertTriangle,
      label: 'Revisi',
    },
    Selesai: {
      colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: PackageCheck,
      label: 'Selesai',
    },
  };

  const item = config[status] ?? config['Pending Approval'];
  const Icon = item.icon;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${item.colorClass}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{item.label}</span>
      </span>
      {isNewlyApproved && (
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white whitespace-nowrap shrink-0">
          Baru Disetujui
        </span>
      )}
    </div>
  );
}
