import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { loyaltyProgramSchema, STAMP_ICONS, LoyaltyProgramFormData } from '../../lib/validations/program';
import { LogoUploader } from '../common/LogoUploader';
import { generateQrDataUrl } from '../../utils/qr';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Smartphone,
  Eye,
  Edit3,
  Sparkles,
  Gift,
  Coffee,
  RotateCw,
  Info,
  ShieldCheck,
  Check,
  Download,
  Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const COLOR_PRESETS = [
  { name: 'Kollekt Noir Chaud', hex: '#2C2825' },
  { name: 'Café Torréfié', hex: '#28231F' },
  { name: 'Ardoise Sombre', hex: '#1C1917' },
  { name: 'Bleu Nuit Chic', hex: '#1E293B' },
  { name: 'Vert Forêt Sombre', hex: '#142820' },
  { name: 'Bordeaux Gourmand', hex: '#2A181C' },
];

export const CardStudioView: React.FC = () => {
  const { merchant, activeProgram, activeReward, saveMerchantProgram } = useAuth();
  const { currentShop, updateShopConfig, updateShopInfo, openPublicCardPage } = useApp();

  // Controlled form state initialized from Supabase / App state
  const [merchantName, setMerchantName] = useState(merchant?.name || currentShop.name || 'Mon Commerce');
  const [logoUrl, setLogoUrl] = useState<string>(merchant?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState<string>(
    activeProgram?.primary_color || currentShop.cardConfig.primaryColor || '#2C2825'
  );
  const [programName, setProgramName] = useState(
    activeProgram?.name || 'Carte de fidélité'
  );
  const [type, setType] = useState<'stamps' | 'points'>(
    (activeProgram?.type as 'stamps' | 'points') || currentShop.cardConfig.mode || 'stamps'
  );
  const [targetCount, setTargetCount] = useState<number>(
    activeProgram?.type === 'points'
      ? activeProgram.reward_threshold_points || 100
      : activeProgram?.max_stamps || currentShop.cardConfig.maxStamps || 8
  );
  const [rewardTitle, setRewardTitle] = useState(
    activeReward?.title || currentShop.cardConfig.rewardTitle || '1 Menu ou Boisson offerte'
  );
  const [stampIcon, setStampIcon] = useState<LoyaltyProgramFormData['stampIcon']>(
    (activeProgram?.stamp_icon as LoyaltyProgramFormData['stampIcon']) || currentShop.cardConfig.stampIcon || 'burger'
  );
  const [backNotice, setBackNotice] = useState(
    activeProgram?.back_notice || currentShop.cardConfig.backNotice || 'Carte réservée à nos clients habitués. Présentez votre pass au moment de régler.'
  );
  const [isActive, setIsActive] = useState<boolean>(activeProgram ? activeProgram.is_active : true);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Live QR Code for the public enrollment page
  const [publicQrCodeUrl, setPublicQrCodeUrl] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Derived public opaque link
  const merchantSlug = merchant?.slug || currentShop.slug || 'mon-commerce';
  const publicJoinUrl = `https://kollekt.fr/c/${merchantSlug}`;

  // Generate public QR code whenever active status or slug changes
  useEffect(() => {
    if (isActive && merchantSlug) {
      generateQrDataUrl(publicJoinUrl, {
        width: 320,
        margin: 1,
        colorDark: '#211D1A',
        colorLight: '#FFFFFF',
      }).then(setPublicQrCodeUrl);
    } else {
      setPublicQrCodeUrl('');
    }
  }, [isActive, merchantSlug, publicJoinUrl]);

  // Synchronize local preview with AppContext mock store
  useEffect(() => {
    updateShopConfig(currentShop.id, {
      mode: type,
      maxStamps: type === 'stamps' ? targetCount : currentShop.cardConfig.maxStamps,
      rewardThreshold: type === 'points' ? targetCount : currentShop.cardConfig.rewardThreshold,
      rewardTitle,
      primaryColor,
      stampIcon: stampIcon as any,
      backNotice,
    });
    updateShopInfo(currentShop.id, {
      name: merchantName,
      logoEmoji: stampIcon === 'coffee' ? '☕' : stampIcon === 'burger' ? '🍔' : '⭐',
    });
  }, [merchantName, primaryColor, type, targetCount, rewardTitle, stampIcon, backNotice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const formData: LoyaltyProgramFormData = {
      merchantName: merchantName.trim(),
      logoUrl: logoUrl.trim() || undefined,
      primaryColor,
      programName: programName.trim(),
      type,
      targetCount: Number(targetCount),
      rewardTitle: rewardTitle.trim(),
      stampIcon,
      backNotice: backNotice.trim(),
      isActive,
    };

    const validation = loyaltyProgramSchema.safeParse(formData);

    if (!validation.success) {
      const errMap: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) errMap[issue.path[0].toString()] = issue.message;
      });
      setErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveMerchantProgram(validation.data);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setServerError(res.error || 'Erreur lors de la sauvegarde.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Title & Value Pitch */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#2C2825] p-5 sm:p-6 rounded-3xl border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-[#FF765F]/15 text-[#FF765F] border border-[#FF765F]/30">
              Studio Carte en 30s
            </span>
            <span className="text-xs text-[#A9A39D]">• Programme mutualisé</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#F7F4F0] mt-1">
            Personnalisez votre carte de fidélité digitale
          </h2>
          <p className="text-xs text-[#A9A39D] mt-0.5">
            Configurez vos règles et visualisez le rendu en direct sur smartphone.
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              isActive
                ? 'bg-[#8BE3A2]/15 border-[#8BE3A2]/40 text-[#8BE3A2]'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#8BE3A2] animate-pulse' : 'bg-amber-400'}`}
            />
            <span>{isActive ? 'Programme Actif' : 'Mode Brouillon'}</span>
          </div>
        </div>
      </div>

      {/* Mobile Switcher (Édition vs Aperçu Smartphone) */}
      <div className="lg:hidden bg-[#2C2825] p-1 rounded-2xl border border-white/10 grid grid-cols-2 gap-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'editor'
              ? 'bg-[#FF765F] text-[#211D1A]'
              : 'text-[#A9A39D] hover:text-[#F7F4F0]'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Configurer la carte</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
            mobileTab === 'preview'
              ? 'bg-[#FF765F] text-[#211D1A]'
              : 'text-[#A9A39D] hover:text-[#F7F4F0]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Aperçu Smartphone</span>
        </button>
      </div>

      {/* Main Grid: Form Left, Smartphone Mockup Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================= FORM COLUMN (LEFT) ================= */}
        <div className={`lg:col-span-7 space-y-6 ${mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
          <form onSubmit={handleSubmit} className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
            {/* Feedback Notifications */}
            <AnimatePresence>
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3.5 rounded-2xl bg-[#8BE3A2]/15 border border-[#8BE3A2]/40 text-[#8BE3A2] text-xs font-bold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Modifications enregistrées avec succès dans Supabase !</span>
                </motion.div>
              )}
              {serverError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{serverError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Section 1: Identité du Commerce */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase font-extrabold text-[#FF765F] tracking-wider">
                1. Identité du Commerce
              </h3>

              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Nom du commerce *
                </label>
                <input
                  type="text"
                  required
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  placeholder="Ex: Cantina Fresca, Smash Club..."
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border text-xs sm:text-sm text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                    errors.merchantName ? 'border-red-500' : 'border-white/10'
                  }`}
                />
                {errors.merchantName && (
                  <span className="text-[10px] text-red-400 mt-1 block">{errors.merchantName}</span>
                )}
              </div>

              {/* Logo Uploader */}
              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Logo ou icône du commerce
                </label>
                <LogoUploader
                  merchantId={merchant?.id}
                  initialLogoUrl={logoUrl}
                  onUploadSuccess={(url) => setLogoUrl(url)}
                  onRemoveLogo={() => setLogoUrl('')}
                />
              </div>

              {/* Scope notice (Mutualisé V1) */}
              <div className="p-3 rounded-2xl bg-[#211D1A] border border-white/5 flex items-center gap-2.5 text-xs text-[#A9A39D]">
                <Info className="w-4 h-4 text-[#8BE3A2] shrink-0" />
                <span>
                  <b>Établissement concerné :</b> Programme mutualisé s’appliquant à l’ensemble de vos points de vente (V1).
                </span>
              </div>
            </div>

            {/* Section 2: Mécanique de Fidélité (Points vs Tampons) */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-xs uppercase font-extrabold text-[#FF765F] tracking-wider">
                2. Mécanique de Fidélité
              </h3>

              {/* Selector Points vs Tampons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setType('stamps');
                    if (targetCount > 24) setTargetCount(8);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    type === 'stamps'
                      ? 'bg-[#FF765F]/15 border-[#FF765F] text-[#F7F4F0]'
                      : 'bg-[#211D1A] border-white/10 text-[#A9A39D] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[#F7F4F0]">
                    <span>☕ Carte à Tampons</span>
                    {type === 'stamps' && <Check className="w-4 h-4 text-[#FF765F]" />}
                  </div>
                  <p className="text-[11px] text-[#A9A39D] mt-1 leading-snug">
                    1 passage ou achat = 1 tampon.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('points');
                    if (targetCount < 10) setTargetCount(80);
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    type === 'points'
                      ? 'bg-[#FF765F]/15 border-[#FF765F] text-[#F7F4F0]'
                      : 'bg-[#211D1A] border-white/10 text-[#A9A39D] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[#F7F4F0]">
                    <span>✨ Système de Points</span>
                    {type === 'points' && <Check className="w-4 h-4 text-[#FF765F]" />}
                  </div>
                  <p className="text-[11px] text-[#A9A39D] mt-1 leading-snug">
                    Cumul selon montant dépensé (1€ = 10 pts).
                  </p>
                </button>
              </div>

              {/* Target Count (1 to 100) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#F7F4F0]">
                      {type === 'stamps' ? 'Nombre de tampons requis *' : 'Points requis pour débloquer *'}
                    </label>
                    <span className="text-[11px] font-mono text-[#FF765F] font-bold">
                      {targetCount} {type === 'stamps' ? 'tampons' : 'pts'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={targetCount}
                      onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
                      className="w-full accent-[#FF765F] cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targetCount}
                        onChange={(e) => setTargetCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                        className={`w-24 px-3 py-1.5 rounded-xl bg-[#211D1A] border text-xs font-bold text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none ${
                          errors.targetCount ? 'border-red-500' : 'border-white/10'
                        }`}
                      />
                      <span className="text-[11px] text-[#A9A39D]">
                        (Entre 1 et 100)
                      </span>
                    </div>
                  </div>
                  {errors.targetCount && (
                    <span className="text-[10px] text-red-400 mt-1 block">{errors.targetCount}</span>
                  )}
                </div>

                {/* Stamp Icon if stamps mode */}
                {type === 'stamps' && (
                  <div>
                    <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                      Motif du sceau / tampon
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {STAMP_ICONS.map((icon) => (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => setStampIcon(icon.id as any)}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                            stampIcon === icon.id
                              ? 'border-[#FF765F] bg-[#FF765F]/20 scale-105'
                              : 'border-white/10 bg-[#211D1A] hover:border-white/20'
                          }`}
                          title={icon.label}
                        >
                          <span className="text-xl block">{icon.emoji}</span>
                          <span className="text-[9px] text-[#A9A39D] block mt-0.5 truncate">{icon.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reward Title */}
              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Intitulé du cadeau ou de la récompense *
                </label>
                <div className="relative">
                  <Gift className="w-4 h-4 text-[#FF765F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    placeholder="Ex: 1 Boisson chaude offerte, 1 Menu Smash Burger..."
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#211D1A] border text-xs sm:text-sm text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                      errors.rewardTitle ? 'border-red-500' : 'border-white/10'
                    }`}
                  />
                </div>
                {errors.rewardTitle && (
                  <span className="text-[10px] text-red-400 mt-1 block">{errors.rewardTitle}</span>
                )}
              </div>

              {/* Program Name Display */}
              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Nom affiché de la carte
                </label>
                <input
                  type="text"
                  required
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="Ex: Carte Habituelle, Club Gourmand..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>
            </div>

            {/* Section 3: Design & Message */}
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h3 className="text-xs uppercase font-extrabold text-[#FF765F] tracking-wider">
                3. Design & Conditions au Verso
              </h3>

              {/* Colors Presets */}
              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-2">
                  Couleur principale du pass
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setPrimaryColor(preset.hex)}
                      className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                        primaryColor === preset.hex
                          ? 'border-[#FF765F] bg-[#FF765F]/15 text-[#F7F4F0]'
                          : 'border-white/10 bg-[#211D1A] hover:border-white/20 text-[#A9A39D]'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span className="text-[11px] font-semibold truncate">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Back Notice / Optional Message */}
              <div>
                <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
                  Message & Conditions au verso de la carte (Optionnel)
                </label>
                <textarea
                  rows={3}
                  maxLength={350}
                  value={backNotice}
                  onChange={(e) => setBackNotice(e.target.value)}
                  placeholder="Conditions d'utilisation, horaires d'ouverture, lien Instagram..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] leading-relaxed focus:outline-none focus:border-[#FF765F]"
                />
                <span className="text-[10px] text-[#A9A39D] block text-right mt-0.5">
                  {backNotice.length}/350 caractères
                </span>
              </div>

              {/* Active vs Draft Toggle */}
              <div className="p-4 rounded-2xl bg-[#211D1A] border border-white/10 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#F7F4F0] block">
                    Statut du programme
                  </span>
                  <p className="text-[11px] text-[#A9A39D] mt-0.5">
                    {isActive
                      ? 'Actif : les clients peuvent rejoindre la carte via le QR code public.'
                      : 'Brouillon : la carte est masquée et le QR code est désactivé.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isActive ? 'bg-[#8BE3A2]' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-[#211D1A] transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Save CTA */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs text-[#A9A39D]">
                Mise à jour en direct sur smartphone
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3.5 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-[#FF765F]/20 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Enregistrement...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Enregistrer la carte</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ================= SMARTPHONE MOCKUP COLUMN (RIGHT) ================= */}
        <div className={`lg:col-span-5 sticky top-22 space-y-6 ${mobileTab === 'editor' ? 'hidden lg:block' : 'block'}`}>
          {/* Smartphone Frame */}
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#FF765F]" />
                <span className="text-xs uppercase font-extrabold tracking-wider text-[#F7F4F0]">
                  Aperçu Smartphone
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCardFlipped(!isCardFlipped)}
                className="text-xs text-[#A9A39D] hover:text-[#F7F4F0] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{isCardFlipped ? 'Voir Recto' : 'Voir Verso (3D)'}</span>
              </button>
            </div>

            {/* Simulated Mobile Pass View */}
            <div className="max-w-xs mx-auto space-y-4">
              {/* Pass Card Component with Live State */}
              <div
                className="w-full rounded-3xl p-5 shadow-2xl relative border border-white/10 overflow-hidden flex flex-col justify-between min-h-[460px] transition-all duration-300"
                style={{
                  backgroundColor: primaryColor,
                  color: '#F7F4F0',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20 pointer-events-none" />

                {/* Card Recto vs Verso toggle */}
                {!isCardFlipped ? (
                  <>
                    {/* Header */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt="Logo"
                              className="w-8 h-8 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <span className="text-2xl">
                              {stampIcon === 'coffee' ? '☕' : stampIcon === 'burger' ? '🍔' : '⭐'}
                            </span>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm truncate text-[#F7F4F0]">
                              {merchantName}
                            </h4>
                            <span className="text-[10px] text-[#A9A39D] uppercase tracking-wider block">
                              {programName}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#F7F4F0]">
                          KOL-DEMO
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] border-b border-white/10 pb-2">
                        <span className="text-[#A9A39D]">Client : Lucas Martin</span>
                        <span className="text-[#8BE3A2] font-semibold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Membre Actif
                        </span>
                      </div>
                    </div>

                    {/* Body: Stamps or Points Grid */}
                    <div className="relative z-10 my-auto py-3">
                      {type === 'stamps' ? (
                        <div>
                          <div className="grid grid-cols-4 gap-2 my-2">
                            {Array.from({ length: Math.min(16, targetCount) }).map((_, idx) => {
                              const isStamped = idx < Math.min(3, targetCount);
                              const isLast = idx === targetCount - 1;

                              return (
                                <div
                                  key={idx}
                                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${
                                    isStamped
                                      ? 'bg-[#FF765F] text-[#211D1A] font-bold shadow-md shadow-[#FF765F]/20'
                                      : isLast
                                      ? 'bg-amber-400 text-[#211D1A] border-2 border-amber-300 font-black'
                                      : 'bg-white/5 border border-dashed border-white/20 text-[#A9A39D]'
                                  }`}
                                >
                                  {isStamped ? (
                                    <span className="text-xs leading-none">
                                      {stampIcon === 'coffee' ? '☕' : stampIcon === 'burger' ? '🍔' : '✓'}
                                    </span>
                                  ) : isLast ? (
                                    <Gift className="w-4 h-4" />
                                  ) : (
                                    <span className="text-[10px] font-mono opacity-40">{idx + 1}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {targetCount > 16 && (
                            <p className="text-[10px] text-center text-[#A9A39D] italic">
                              +{targetCount - 16} autres tampons sur le pass complet
                            </p>
                          )}

                          <div className="text-center mt-3">
                            <span className="text-[11px] font-semibold text-[#F7F4F0] block">
                              Objectif : {targetCount} tampons
                            </span>
                            <span className="text-[10px] text-[#8BE3A2] font-bold">
                              🎁 {rewardTitle}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Points Mode */
                        <div className="space-y-3 py-2">
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] uppercase text-[#A9A39D]">Solde</span>
                            <span className="font-mono text-2xl font-black text-[#FF765F]">
                              30 / {targetCount} pts
                            </span>
                          </div>
                          <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#FF765F] to-[#8BE3A2] rounded-full"
                              style={{ width: `${Math.min(100, (30 / targetCount) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-center text-[#8BE3A2] font-bold">
                            🎁 Récompense : {rewardTitle}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Barcode Footer */}
                    <div className="relative z-10 pt-2 border-t border-white/10 flex flex-col items-center">
                      <div className="bg-white p-1.5 rounded-xl">
                        <QrCode className="w-14 h-14 text-black" />
                      </div>
                      <span className="text-[9px] text-[#A9A39D] mt-1">
                        Scannable en caisse
                      </span>
                    </div>
                  </>
                ) : (
                  /* Card Back View */
                  <div className="relative z-10 flex flex-col justify-between h-full space-y-4 text-xs">
                    <div>
                      <h4 className="font-bold text-sm text-[#F7F4F0] border-b border-white/10 pb-2">
                        {merchantName} • Verso du Pass
                      </h4>
                      <p className="text-[11px] text-[#A9A39D] mt-2 leading-relaxed">
                        {backNotice || 'Aucun message particulier.'}
                      </p>
                    </div>
                    <div className="text-center pt-3 border-t border-white/10 text-[10px] text-[#A9A39D]">
                      Programme de fidélité propulsé par Kollekt
                    </div>
                  </div>
                )}
              </div>

              {/* Wallet Integration Preview Badges (Visual only, no pass creation yet) */}
              <div className="space-y-2 pt-1">
                <div className="w-full h-11 rounded-2xl bg-black border border-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 opacity-90">
                  <span className="text-base leading-none"></span>
                  <span>Ajouter à Apple Wallet (Aperçu)</span>
                </div>
                <div className="w-full h-11 rounded-2xl bg-[#1e293b] border border-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 opacity-90">
                  <span className="font-bold text-[#0ea5e9]">G</span>
                  <span>Google Wallet (Aperçu)</span>
                </div>
                <p className="text-[10px] text-center text-[#A9A39D]">
                  L’intégration des certificats Apple & Google Wallet sera connectée à la prochaine étape.
                </p>
              </div>
            </div>
          </div>

          {/* Public Enrollment QR Code Section */}
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-extrabold text-[#F7F4F0] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#FF765F]" />
                QR Code d'Inscription Client
              </h3>
              <span className="text-[10px] font-mono text-[#A9A39D]">URL opaque</span>
            </div>

            {isActive ? (
              <div className="space-y-3">
                <div className="p-3 bg-white rounded-2xl flex items-center justify-center max-w-[160px] mx-auto shadow-md">
                  {publicQrCodeUrl ? (
                    <img src={publicQrCodeUrl} alt="QR Code Public" className="w-36 h-36 object-contain" />
                  ) : (
                    <div className="w-36 h-36 bg-stone-100 rounded-xl animate-pulse" />
                  )}
                </div>

                <div className="bg-[#211D1A] p-2.5 rounded-xl border border-white/5 text-center">
                  <span className="text-[10px] text-[#A9A39D] block">Lien public stable :</span>
                  <span className="font-mono text-xs text-[#FF765F] font-bold break-all">
                    {publicJoinUrl}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openPublicCardPage(merchantSlug)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FF765F]/15 hover:bg-[#FF765F]/25 border border-[#FF765F]/30 text-xs font-bold text-[#FF765F] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Tester le parcours client (Page publique)</span>
                </button>

                <p className="text-[11px] text-[#A9A39D] text-center leading-relaxed">
                  Imprimez ce QR code sur vos comptoirs ou chevalets. Vos clients scannent et ajoutent leur carte en 10 secondes.
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-1">
                <span className="text-xs font-bold text-amber-300 block">
                  QR Code désactivé (Mode Brouillon)
                </span>
                <p className="text-[11px] text-[#A9A39D]">
                  Activez le programme ci-dessus pour générer et débloquer le QR code public d’inscription de vos clients.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
