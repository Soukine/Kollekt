import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { step3Schema, Step3Input } from '../../../lib/validations/onboarding';
import { ArrowLeft, CheckCircle2, Gift, Coffee, Utensils, Star, Heart, Zap, Sparkles } from 'lucide-react';

export const Step3LoyaltyProgram: React.FC = () => {
  const { merchant, submitStep3, setCurrentStep } = useAuth();

  const [programName, setProgramName] = useState('Carte de fidélité');
  const [type, setType] = useState<Step3Input['type']>('stamps');
  const [targetCount, setTargetCount] = useState<number>(8);
  const [rewardTitle, setRewardTitle] = useState('');
  const [stampIcon, setStampIcon] = useState('burger');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = step3Schema.safeParse({
      programName,
      type,
      targetCount: Number(targetCount),
      rewardTitle,
      stampIcon,
    });

    if (!validation.success) {
      setErrorMsg(validation.error.issues[0]?.message || 'Veuillez vérifier les informations du programme.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitStep3(validation.data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <span className="text-[11px] uppercase font-extrabold tracking-wider text-[#FF765F] block mb-1">
          Étape 3 sur 3 • Programme de Fidélité
        </span>
        <h2 className="text-xl sm:text-2xl font-extrabold text-[#F7F4F0]">
          Définissez votre première récompense
        </h2>
        <p className="text-xs text-[#A9A39D] mt-1 leading-relaxed">
          Fixez une règle simple et motivante pour inciter vos clients à revenir régulièrement.
        </p>
      </div>

      {/* Program Mode: Stamps vs Points */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-[#F7F4F0] block">
          Mécanique de récompense *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => {
              setType('stamps');
              setTargetCount(8);
            }}
            className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
              type === 'stamps'
                ? 'bg-[#FF765F]/15 border-[#FF765F] text-[#F7F4F0]'
                : 'bg-[#211D1A] border-white/10 hover:border-white/20 text-[#A9A39D]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[#F7F4F0]">
              <span>☕ Carte à Tampons</span>
              {type === 'stamps' && <CheckCircle2 className="w-4 h-4 text-[#FF765F]" />}
            </div>
            <p className="text-[11px] text-[#A9A39D] mt-1">
              Idéal pour food trucks, cafés, sandwicheries et menus du jour.
            </p>
          </div>

          <div
            onClick={() => {
              setType('points');
              setTargetCount(100);
            }}
            className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
              type === 'points'
                ? 'bg-[#FF765F]/15 border-[#FF765F] text-[#F7F4F0]'
                : 'bg-[#211D1A] border-white/10 hover:border-white/20 text-[#A9A39D]'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[#F7F4F0]">
              <span>✨ Système de Points</span>
              {type === 'points' && <CheckCircle2 className="w-4 h-4 text-[#FF765F]" />}
            </div>
            <p className="text-[11px] text-[#A9A39D] mt-1">
              Idéal pour restaurants à la carte et additions variables (1€ = 10 pts).
            </p>
          </div>
        </div>
      </div>

      {/* Target count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
            {type === 'stamps' ? 'Nombre de tampons requis *' : 'Points requis pour le cadeau *'}
          </label>
          {type === 'stamps' ? (
            <select
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs font-semibold text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
            >
              <option value={6}>6 tampons</option>
              <option value={8}>8 tampons (Recommandé)</option>
              <option value={10}>10 tampons</option>
              <option value={12}>12 tampons</option>
            </select>
          ) : (
            <input
              type="number"
              min={10}
              step={10}
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs font-semibold text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
            />
          )}
        </div>

        {type === 'stamps' && (
          <div>
            <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
              Motif du tampon
            </label>
            <select
              value={stampIcon}
              onChange={(e) => setStampIcon(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs font-semibold text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
            >
              <option value="burger">🍔 Burger</option>
              <option value="coffee">☕ Café / Boisson</option>
              <option value="utensils">🍽️ Couverts</option>
              <option value="pizza">🍕 Pizza</option>
              <option value="star">⭐ Étoile</option>
              <option value="gift">🎁 Cadeau</option>
            </select>
          </div>
        )}
      </div>

      {/* Reward Title */}
      <div>
        <label className="text-xs font-bold text-[#F7F4F0] block mb-1">
          Intitulé de la récompense offerte *
        </label>
        <div className="relative">
          <Gift className="w-4 h-4 text-[#FF765F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            required
            placeholder="Ex: 1 Burger au choix offert, 1 Café ou Pâtisserie, 1 Dessert maison..."
            value={rewardTitle}
            onChange={(e) => setRewardTitle(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[#211D1A] border border-white/10 text-xs sm:text-sm text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors"
          />
        </div>
      </div>

      {/* Summary box */}
      <div className="p-4 rounded-2xl bg-[#211D1A] border border-white/10 flex items-start gap-3 text-xs">
        <Sparkles className="w-5 h-5 text-[#8BE3A2] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold text-[#F7F4F0]">Programme mutualisé (V1)</p>
          <p className="text-[#A9A39D] text-[11px] leading-relaxed">
            Votre programme s’applique automatiquement à l’ensemble de vos points de vente. Vos clients cumulent sans expiration de points.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep(2)}
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
            <span>Finalisation de votre espace...</span>
          ) : (
            <>
              <span>Créer mon espace Kollekt</span>
              <Sparkles className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
