import { useState } from 'react';

const COMPANY_LOGO_SRC = '/assets/aistudio/pangan-berkah-sentosa_7082e0f3.png';

interface CompanyBrandProps {
  variant?: 'light' | 'dark' | 'print';
  size?: 'sm' | 'md' | 'lg';
}

export function CompanyBrand({
  variant = 'light',
  size = 'md',
}: CompanyBrandProps) {
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading'
  );

  const boxSizeClass =
    size === 'lg'
      ? 'h-14 w-14 text-base'
      : size === 'sm'
        ? 'h-8 w-8 text-[11px]'
        : 'h-10 w-10 text-xs';

  const textClass =
    variant === 'dark'
      ? 'text-white'
      : 'text-slate-900';

  const nameSizeClass =
    size === 'lg'
      ? 'text-lg sm:text-xl'
      : size === 'sm'
        ? 'text-sm sm:text-base'
        : 'text-sm sm:text-base';

  return (
    <div className="inline-flex items-center gap-2.5 min-w-0">
      {imgStatus !== 'loaded' && (
        <span
          aria-hidden="true"
          className={`flex items-center justify-center rounded-full border border-red-900/20 bg-red-800 font-bold tracking-tight text-white shrink-0 ${boxSizeClass}`}
        >
          PBS
        </span>
      )}

      {imgStatus !== 'error' && (
        <img
          src={COMPANY_LOGO_SRC}
          alt="Logo CV. Pangan Berkah Sentosa"
          referrerPolicy="no-referrer"
          onLoad={() => setImgStatus('loaded')}
          onError={() => setImgStatus('error')}
          className={`rounded-full border border-slate-200 bg-white object-contain p-0.5 shrink-0 ${boxSizeClass} ${
            imgStatus === 'loaded' ? 'block' : 'hidden'
          }`}
        />
      )}

      <span
        className={`font-bold leading-tight tracking-tight ${textClass} ${nameSizeClass}`}
      >
        CV. Pangan Berkah Sentosa
      </span>
    </div>
  );
}
