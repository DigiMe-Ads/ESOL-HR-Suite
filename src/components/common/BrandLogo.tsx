import React from 'react';
import { cn } from '@/lib/utils';

export const LOGO_URL = '/esol_logo.png';
export const CREST_URL = '/esol_crest.png';

interface BrandMarkProps {
  /** `dark` for navy surfaces (sidebar, brand panels), `light` for white/app surfaces */
  tone?: 'light' | 'dark';
  subtitle?: string;
  className?: string;
}

/**
 * Compact ESOL lockup for tight spaces: crest on a white tile, a heavy "ESOL" wordmark
 * and widely tracked "PREMIER CAMPUS" — mirrors the structure of the full logo.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ tone = 'light', subtitle, className }) => (
  <div className={cn('flex items-center gap-3 min-w-0', className)}>
    <div className={cn(
      'h-11 w-11 shrink-0 rounded-xl bg-white p-1 flex items-center justify-center',
      tone === 'dark' ? 'shadow-lg ring-1 ring-brand-silver/60' : 'shadow-card ring-1 ring-border',
    )}>
      <img src={CREST_URL} alt="" className="h-full w-full object-contain" />
    </div>
    <div className="min-w-0">
      <p className={cn('brand-wordmark text-[22px]', tone === 'dark' ? 'text-white' : 'text-primary')}>
        ES<span className={tone === 'dark' ? 'text-brand-sky' : 'text-brand-globe'}>O</span>L
      </p>
      <p className={cn('brand-tagline mt-1 truncate', tone === 'dark' ? 'text-brand-silver/80' : 'text-foreground/80')}>
        Premier Campus
      </p>
      {subtitle && (
        <p className={cn('mt-1 text-[10px] font-medium truncate', tone === 'dark' ? 'text-sky-200/70' : 'text-muted-foreground')}>
          {subtitle}
        </p>
      )}
    </div>
  </div>
);

/** Full-colour ESOL logo. The artwork has charcoal text, so on dark surfaces it sits on a white plate. */
export const BrandLogo: React.FC<{ className?: string; plate?: boolean }> = ({ className, plate }) => {
  const img = <img src={LOGO_URL} alt="ESOL Premier Campus" className={cn('h-auto w-full object-contain', !plate && className)} />;
  if (!plate) return img;
  return (
    <div className={cn('rounded-2xl bg-white px-6 py-5 shadow-2xl ring-1 ring-brand-silver/70', className)}>
      {img}
    </div>
  );
};
