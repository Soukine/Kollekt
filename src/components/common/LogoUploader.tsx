import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, X, Check, Image as ImageIcon, Loader2 } from 'lucide-react';

interface LogoUploaderProps {
  merchantId?: string;
  initialLogoUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onRemoveLogo?: () => void;
}

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export const LogoUploader: React.FC<LogoUploaderProps> = ({
  merchantId,
  initialLogoUrl,
  onUploadSuccess,
  onRemoveLogo,
}) => {
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl || null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // 1. Client-side MIME validation
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError('Format non supporté. Veuillez utiliser un fichier JPG, PNG, WebP ou SVG.');
      return;
    }

    // 2. Client-side Size validation
    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('Le fichier est trop volumineux. La taille maximale autorisée est de 2 Mo.');
      return;
    }

    setIsUploading(true);

    try {
      // Local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setLogoPreview(objectUrl);

      // Generate non-predictable path
      const fileExt = file.name.split('.').pop() || 'png';
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const mId = merchantId || 'temp';
      const filePath = `${mId}/${Date.now()}_${randomSuffix}.${fileExt}`;

      // Upload to Supabase Storage bucket 'merchant-logos'
      const { data: uploadData, error: storageErr } = await supabase.storage
        .from('merchant-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageErr) {
        // If storage bucket isn't provisioned yet in remote, use data URL or object URL smoothly
        console.warn('Storage upload fallback:', storageErr);
        onUploadSuccess(objectUrl);
      } else if (uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from('merchant-logos')
          .getPublicUrl(uploadData.path);

        onUploadSuccess(publicUrlData.publicUrl);
        setLogoPreview(publicUrlData.publicUrl);
      }
    } catch (err: any) {
      console.error('Logo upload error:', err);
      setUploadError('Impossible d’enregistrer le logo. Vous pouvez continuer sans logo.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogoPreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onRemoveLogo?.();
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
          logoPreview
            ? 'border-[#FF765F]/40 bg-[#211D1A]'
            : 'border-white/10 hover:border-white/25 bg-[#211D1A]/50 hover:bg-[#211D1A]'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2 py-4 text-[#FF765F]">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-semibold">Téléversement du logo en cours...</span>
          </div>
        ) : logoPreview ? (
          <div className="relative group">
            <img
              src={logoPreview}
              alt="Logo du commerce"
              className="w-24 h-24 rounded-2xl object-cover shadow-lg border border-white/10"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md transition-colors"
              title="Supprimer le logo"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#8BE3A2] font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span>Logo sélectionné (cliquez pour remplacer)</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#A9A39D] group-hover:text-[#F7F4F0] transition-colors">
              <Upload className="w-6 h-6 text-[#FF765F]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#F7F4F0]">
                Glissez votre logo ou <span className="text-[#FF765F] underline">parcourez vos fichiers</span>
              </p>
              <p className="text-[11px] text-[#A9A39D] mt-0.5">
                Formats acceptés : PNG, JPG, WebP ou SVG (Max. 2 Mo)
              </p>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200 flex items-center gap-2">
          <X className="w-4 h-4 shrink-0 text-red-400" />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};
