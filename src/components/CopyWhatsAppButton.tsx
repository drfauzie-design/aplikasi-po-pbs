import { useState } from 'react';
import { Check, MessageCircle } from 'lucide-react';
import type { PurchaseOrderWithDetails } from '../types/database';
import {
  buildPurchaseOrderWhatsAppText,
  copyTextToClipboard,
} from '../lib/whatsapp';
import { useToast } from './Toast';

interface CopyWhatsAppButtonProps {
  po: PurchaseOrderWithDetails;
  includePrices: boolean;
  size?: 'sm' | 'md';
}

export function CopyWhatsAppButton({
  po,
  includePrices,
  size = 'md',
}: CopyWhatsAppButtonProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const formatted = buildPurchaseOrderWhatsAppText(po, includePrices);
      await copyTextToClipboard(formatted);
      setCopied(true);
      showToast(
        'success',
        'Disalin ke Clipboard',
        'Format PO berhasil disalin! Silakan paste di WhatsApp.'
      );
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast(
        'error',
        'Gagal Menyalin Format PO',
        err instanceof Error
          ? err.message
          : 'Tidak dapat mengakses clipboard pada perangkat ini.'
      );
    }
  };

  const sizeClasses =
    size === 'sm'
      ? 'min-h-[36px] px-3 text-xs rounded-lg'
      : 'min-h-[42px] px-3.5 text-xs sm:text-sm rounded-xl';

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center justify-center gap-1.5 border font-semibold transition-colors whitespace-nowrap shrink-0 ${sizeClasses} ${
        copied
          ? 'border-emerald-500 bg-emerald-600 text-white'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
      }`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <MessageCircle className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{copied ? 'Tersalin' : 'Copy untuk WhatsApp'}</span>
    </button>
  );
}
