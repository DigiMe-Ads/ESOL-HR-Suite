import React, { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PHOTO_MIME_TYPES, validateUpload } from '@/db/api';
import { cn } from '@/lib/utils';

const initials = (name?: string | null) =>
  (name ?? '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

/** Round employee photo with an initials fallback */
export const EmployeeAvatar: React.FC<{ url?: string | null; name?: string | null; className?: string }> = ({ url, name, className }) => (
  <div className={cn('relative shrink-0 overflow-hidden rounded-full bg-accent text-primary ring-1 ring-border flex items-center justify-center font-semibold', className ?? 'h-10 w-10 text-xs')}>
    {url ? <img src={url} alt={name ?? 'Employee photo'} className="h-full w-full object-cover" /> : initials(name)}
  </div>
);

interface PhotoPickerProps {
  /** Current saved photo (signed URL), shown until a new file is picked */
  currentUrl?: string | null;
  name?: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

/** Choose a profile photo (JPG/PNG/WebP, ≤10 MB) with a live preview; the caller uploads it on save */
export const PhotoPicker: React.FC<PhotoPickerProps> = ({ currentUrl, name, file, onChange, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const invalid = validateUpload(f, PHOTO_MIME_TYPES);
    setError(invalid);
    if (!invalid) onChange(f);
  };

  return (
    <div className="flex items-center gap-4">
      <EmployeeAvatar url={preview ?? currentUrl} name={name} className="h-20 w-20 text-lg" />
      <div className="space-y-1.5 min-w-0">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <Camera size={14} /> {preview || currentUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {file && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { onChange(null); setError(null); }}>
              <X size={14} /> Discard
            </Button>
          )}
        </div>
        <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ?? 'JPG, PNG or WebP, up to 10 MB.'}
        </p>
        <input
          ref={inputRef} type="file" accept={PHOTO_MIME_TYPES.join(',')} className="hidden"
          onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </div>
  );
};
