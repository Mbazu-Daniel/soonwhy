import { useRef, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { api } from '~/lib/api';
import { cn } from '~/lib/utils';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type UploadKind = 'user_avatar' | 'member_avatar' | 'organization_logo';

interface UploadUrlResponse {
  uploadId: string;
  uploadUrl: string;
}

export interface ImageUploadProps {
  kind: UploadKind;
  targetId?: string;
  imageUrl?: string | null;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
  disabled?: boolean;
  className?: string;
  onUploaded: (fileUrl: string) => void;
}

const sizeClasses = { sm: 'h-9 w-9 text-xs', md: 'h-12 w-12 text-base', lg: 'h-16 w-16 text-lg' } as const;

export function ImageUpload({
  kind,
  targetId,
  imageUrl,
  fallback,
  size = 'md',
  shape = 'circle',
  disabled,
  className,
  onUploaded,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError('Only JPEG, PNG and WebP images are allowed.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('That image is larger than 5 MB.');
      return;
    }

    setUploading(true);
    try {
      const presigned = await api.post<UploadUrlResponse>('uploads/upload-url', {
        kind,
        targetId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      const putResponse = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putResponse.ok) {
        throw new Error(`Upload failed with status ${putResponse.status}`);
      }

      const confirmed = await api.post<{ fileUrl: string }>(`uploads/${presigned.uploadId}/confirm`);
      onUploaded(confirmed.fileUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={cn('inline-flex flex-col items-center gap-1.5', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          aria-label="Upload image"
          className={cn(
            'grid shrink-0 place-items-center overflow-hidden border border-[#242426] bg-[#151517] font-semibold text-[#ACFC15] transition-opacity',
            sizeClasses[size],
            shape === 'circle' ? 'rounded-full' : 'rounded-lg',
            (disabled || uploading) && 'opacity-60',
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-[#989898]" />
          ) : imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            fallback
          )}
        </button>
        {!disabled && !uploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label="Change image"
            className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-[#242426] bg-[#0B0B0C] text-[#ACFC15] shadow-sm transition-colors hover:bg-[#1A1A1C]"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-[220px] text-center text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
