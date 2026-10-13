import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { step2Schema } from '../../../lib/validations/onboarding';
import { LogoUploader } from '../../common/LogoUploader';
import { ArrowLeft, ArrowRight, MapPin, Palette, Check } from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Kollekt Noir Chaud', hex: '#2C2825' },
  { name: 'Café Torréfié', hex: '#28231F' },
  { name: 'Ardoise Sombre', hex: '#1C1917' },
  { name: 'Bleu Nuit Chic', hex: '#1E293B' },
  { name: 'Vert Forêt Sombre', hex: '#142820' },
  { name: 'Bordeaux Gourmand', hex: '#2A181C' },
];

export const Step2BrandingLocation: React.FC = () => {
  const { merchant, submitStep2, setCurrentStep } = useAuth();

  const [logoUrl, setLogoUrl] = useState<string>(merchant?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState<string>('#2C2825');
  const [city, setCity] = useState<string>('Paris');
  const [address, setAddress] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = step2Schema.safeParse({
      primaryColor,
      city: city.trim() || undefined,
      address: address.trim() || undefined,
      logoUrl: logoUrl || undefined,
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || 'Vérifiez les données saisies.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitStep2(validation.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <span className="text-[11px] uppercase font-extrabold tracking-wider text-[#FF765F] block mb-1">
          Étape 2 sur 3 • Identité & Emplacement
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#F7F4F0]">
          Personnalisez votre présence
        </h2>
        <p className="text-xs text-[#A9A39D] mt-1 leading-relaxed">
          Votre logo et vos couleurs habilleront le pass sur les smartphones de vos clients.
        </p>
      </div>

      {/* Logo Upload Section */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#F7F4F0] block">
          Logo de l'établissement <span className="text-[#A9A39D] font-normal">(Facultatif)</span>
        </label>
        <LogoUploader
          merchantId={merchant?.id}
          initialLogoUrl={logoUrl}
          onUploadSuccess={(url) => setLogoUrl(url)}
          onRemoveLogo={() => setLogoUrl('')}
        />
      </div>

      {/* Primary Color Palette */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <label className="text-xs font-bold text-[#F7F4F0] flex items-center gap-2">
          <Palette className="w-3.5 h-3.5 text-[#FF765F]" />
          Couleur de fond de la carte (Apple & Google Wallet)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {COLOR_PRESETS.map((preset) => {
            const isSelected = primaryColor === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => setPrimaryColor(preset.hex)}
                className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#FF765F] bg-[#FF765F]/15 text-[#F7F4F0]'
                    : 'border-white/10 bg-[#211D1A] hover:border-white/20 text-[#A9A39D]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                    style={{ backgroundColor: preset.hex }}
                  />
                  <span className="text-xs font-semibold truncate">{preset.name}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#FF765F] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Location / Address */}
      <div className="space-y-3 pt-2 border-t border-white/10">
        <label className="text-xs font-bold text-[#F7F4F0] flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#FF765F]" />
          Premier établissement / Emplacement
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-[#A9A39D] block mb-1">
              Ville ou Secteur
            </label>
            <input
              type="text"
              placeholder="Ex: Paris, Lyon, Bordeaux..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#A9A39D] block mb-1">
              Adresse ou Emplacement habituel
            </label>
            <input
              type="text"
              placeholder="Ex: 14 rue Saint-Denis ou Spot Madeleine"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
            />
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep(1)}
          className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#A9A39D] hover:text-[#F7F4F0] flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3.5 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-[#FF765F]/20 transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <span>Enregistrement...</span>
          ) : (
            <>
              <span>Continuer</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
