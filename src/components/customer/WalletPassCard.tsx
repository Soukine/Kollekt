import React, { useState, useEffect } from 'react';
import { Customer, Shop, StampIconType } from '../../types';
import { generateQrDataUrl } from '../../utils/qr';
import {
  Coffee,
  Utensils,
  Star,
  Heart,
  Gift,
  Zap,
  RotateCw,
  MapPin,
  Clock,
  Phone,
  Instagram,
  Sparkles,
  Check,
} from 'lucide-react';
import { motion } from 'motion/react';

interface WalletPassCardProps {
  customer: Customer;
  shop: Shop;
  onFlip?: (isFlipped: boolean) => void;
  interactive?: boolean;
}

export const WalletPassCard: React.FC<WalletPassCardProps> = ({
  customer,
  shop,
  onFlip,
  interactive = true,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const { cardConfig } = shop;
  const isStamps = cardConfig.mode === 'stamps';
  const maxStamps = cardConfig.maxStamps || 8;
  const currentStamps = customer.currentStamps;
  const isRewardReady = isStamps
    ? currentStamps >= maxStamps
    : customer.currentPoints >= cardConfig.rewardThreshold;

  // Render correct icon for stamp
  const renderStampIcon = (type: StampIconType, className: string = 'w-5 h-5') => {
    switch (type) {
      case 'coffee':
        return <Coffee className={className} />;
      case 'burger':
        return <span className="text-lg leading-none">🍔</span>;
      case 'star':
        return <Star className={className} />;
      case 'heart':
        return <Heart className={className} />;
      case 'gift':
        return <Gift className={className} />;
      case 'pizza':
        return <span className="text-lg leading-none">🍕</span>;
      case 'zap':
        return <Zap className={className} />;
      case 'utensils':
      default:
        return <Utensils className={className} />;
    }
  };

  useEffect(() => {
    generateQrDataUrl(customer.passId, {
      width: 220,
      margin: 1,
      colorDark: '#211D1A',
      colorLight: '#FFFFFF',
    }).then(setQrCodeUrl);
  }, [customer.passId]);

  const handleToggleFlip = () => {
    if (!interactive) return;
    const next = !isFlipped;
    setIsFlipped(next);
    onFlip?.(next);
  };

  return (
    <div className="w-full max-w-sm mx-auto perspective-1000 select-none">
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', damping: 20 }}
        className="w-full relative transform-style-3d cursor-pointer"
        onClick={handleToggleFlip}
      >
        {/* ================= RECTO (FRONT) ================= */}
        <div
          className="w-full rounded-3xl p-5 shadow-2xl relative backface-hidden border border-white/10 overflow-hidden flex flex-col justify-between min-h-[500px]"
          style={{
            backgroundColor: cardConfig.primaryColor || '#2C2825',
            color: cardConfig.textColor || '#F7F4F0',
          }}
        >
          {/* Subtle noise/gradient highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20 pointer-events-none" />

          {/* Pass Header */}
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{shop.logoEmoji}</span>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight leading-none text-[#F7F4F0]">
                    {shop.name}
                  </h3>
                  <span className="text-[11px] text-[#A9A39D] uppercase tracking-wider font-semibold">
                    Pass Fidélité
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-white/10 text-[#F7F4F0] border border-white/10">
                  {customer.passId}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFlip();
                  }}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#A9A39D] hover:text-[#F7F4F0] transition-colors"
                  title="Voir les détails au verso"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Customer name & Status */}
            <div className="flex items-center justify-between text-xs border-b border-white/10 pb-3 pt-1">
              <div>
                <span className="text-[10px] uppercase text-[#A9A39D] block font-medium">Titulaire</span>
                <span className="font-semibold text-[#F7F4F0]">
                  {customer.firstName} {customer.lastName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase text-[#A9A39D] block font-medium">Statut</span>
                <span className="font-semibold text-[#8BE3A2] flex items-center gap-1 justify-end">
                  <Sparkles className="w-3 h-3" />
                  {customer.totalVisits > 5 ? 'Habitué VIP' : 'Membre Actif'}
                </span>
              </div>
            </div>
          </div>

          {/* Pass Body: Stamps or Points */}
          <div className="relative z-10 py-4 my-auto">
            {isStamps ? (
              <div>
                {/* Stamp Grid */}
                <div className="grid grid-cols-4 gap-3 my-2">
                  {Array.from({ length: maxStamps }).map((_, idx) => {
                    const isStamped = idx < currentStamps;
                    const isLast = idx === maxStamps - 1;

                    return (
                      <div
                        key={idx}
                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-300 ${
                          isStamped
                            ? 'bg-[#FF765F] text-[#211D1A] shadow-lg shadow-[#FF765F]/30 scale-[1.02] border-2 border-[#FF765F]'
                            : isLast && isRewardReady
                            ? 'bg-amber-400 text-stone-900 border-2 border-amber-300 shadow-xl animate-pulse'
                            : 'bg-white/5 border border-dashed border-white/20 text-[#A9A39D]'
                        }`}
                      >
                        {isStamped ? (
                          <div className="flex flex-col items-center">
                            <span className="text-[#211D1A]">
                              {renderStampIcon(cardConfig.stampIcon, 'w-5 h-5')}
                            </span>
                            <span className="text-[9px] font-bold text-[#211D1A] mt-0.5">
                              #{idx + 1}
                            </span>
                          </div>
                        ) : isLast ? (
                          <div className="flex flex-col items-center text-center p-1">
                            <Gift className={`w-5 h-5 ${isRewardReady ? 'text-stone-900' : 'text-[#FF765F]'}`} />
                            <span className="text-[8px] font-extrabold uppercase mt-0.5 leading-none">
                              Cadeau
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs font-semibold opacity-40">
                            {idx + 1}
                          </span>
                        )}

                        {isStamped && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#8BE3A2] rounded-full flex items-center justify-center text-[#211D1A]">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress message */}
                <div className="mt-3 text-center">
                  {isRewardReady ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8BE3A2]/20 border border-[#8BE3A2]/40 text-[#8BE3A2] text-xs font-bold animate-bounce">
                      <Gift className="w-3.5 h-3.5" />
                      Récompense prête : {cardConfig.rewardTitle} !
                    </div>
                  ) : (
                    <p className="text-xs text-[#A9A39D]">
                      Plus que{' '}
                      <span className="font-bold text-[#FF765F]">
                        {maxStamps - currentStamps} tampon{maxStamps - currentStamps > 1 ? 's' : ''}
                      </span>{' '}
                      pour débloquer votre cadeau !
                    </p>
                  )}
                </div>
              </div>
            ) : (
              /* Points Mode */
              <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase text-[#A9A39D]">Solde actuel</span>
                  <div className="text-right">
                    <span className="font-mono text-3xl font-extrabold text-[#FF765F]">
                      {customer.currentPoints}
                    </span>
                    <span className="text-xs text-[#A9A39D] ml-1">/ {cardConfig.rewardThreshold} pts</span>
                  </div>
                </div>

                {/* Points bar */}
                <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF765F] to-[#8BE3A2] rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (customer.currentPoints / cardConfig.rewardThreshold) * 100
                      )}%`,
                    }}
                  />
                </div>

                <div className="text-center">
                  {isRewardReady ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#8BE3A2]/20 border border-[#8BE3A2]/40 text-[#8BE3A2] text-xs font-bold">
                      <Gift className="w-3.5 h-3.5" />
                      Seuil atteint : {cardConfig.rewardTitle} disponible !
                    </div>
                  ) : (
                    <p className="text-xs text-[#A9A39D]">
                      Encore{' '}
                      <span className="font-bold text-[#FF765F]">
                        {cardConfig.rewardThreshold - customer.currentPoints} points
                      </span>{' '}
                      pour votre récompense.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Barcode & Flip Hint Footer */}
          <div className="relative z-10 pt-3 border-t border-white/10 flex flex-col items-center">
            {qrCodeUrl ? (
              <div className="bg-white p-2 rounded-xl shadow-md flex items-center justify-center">
                <img
                  src={qrCodeUrl}
                  alt={`QR Code Pass ${customer.passId}`}
                  className="w-24 h-24 object-contain"
                />
              </div>
            ) : (
              <div className="w-24 h-24 bg-white/10 rounded-xl animate-pulse" />
            )}

            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#A9A39D]">
              <RotateCw className="w-3 h-3" />
              <span>Touchez pour afficher les infos & conditions au verso</span>
            </div>
          </div>
        </div>

        {/* ================= VERSO (BACK) ================= */}
        <div
          className="w-full rounded-3xl p-5 shadow-2xl absolute inset-0 backface-hidden rotate-y-180 border border-white/10 overflow-y-auto flex flex-col justify-between"
          style={{
            backgroundColor: '#26221E',
            color: '#F7F4F0',
          }}
        >
          <div>
            {/* Back Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{shop.logoEmoji}</span>
                <h4 className="font-bold text-sm text-[#F7F4F0]">{shop.name}</h4>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFlip();
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium text-[#F7F4F0] flex items-center gap-1 transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                Retour
              </button>
            </div>

            {/* Shop Details */}
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2 text-[#A9A39D]">
                <MapPin className="w-4 h-4 shrink-0 text-[#FF765F] mt-0.5" />
                <span>
                  {shop.address}, {shop.city}
                </span>
              </div>
              <div className="flex items-start gap-2 text-[#A9A39D]">
                <Clock className="w-4 h-4 shrink-0 text-[#FF765F] mt-0.5" />
                <span>{shop.openingHours}</span>
              </div>
              <div className="flex items-center gap-2 text-[#A9A39D]">
                <Phone className="w-4 h-4 shrink-0 text-[#FF765F]" />
                <span>{shop.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-[#A9A39D]">
                <Instagram className="w-4 h-4 shrink-0 text-[#FF765F]" />
                <span>{shop.instagram}</span>
              </div>
            </div>

            {/* Reward Summary */}
            <div className="mt-4 p-3 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-[#FF765F] tracking-wider block mb-1">
                Récompense du commerce
              </span>
              <p className="text-xs font-semibold text-[#F7F4F0]">{cardConfig.rewardTitle}</p>
              <p className="text-[11px] text-[#A9A39D] mt-0.5">{cardConfig.rewardDescription}</p>
            </div>

            {/* Referral promo */}
            <div className="mt-3 p-3 rounded-2xl bg-[#FF765F]/10 border border-[#FF765F]/20">
              <span className="text-[10px] uppercase font-bold text-[#FF765F] tracking-wider block mb-1">
                Votre Code Parrainage
              </span>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[#F7F4F0]">
                  {customer.referralCode}
                </span>
                <span className="text-[10px] text-[#8BE3A2] font-semibold">
                  +1 tampon par ami
                </span>
              </div>
            </div>

            {/* Terms notice */}
            <div className="mt-4 text-[10px] text-[#A9A39D] leading-relaxed border-t border-white/10 pt-3">
              <span className="font-semibold text-[#F7F4F0] block mb-1">Conditions du programme</span>
              <p>{cardConfig.backNotice}</p>
            </div>
          </div>

          <div className="pt-3 text-center border-t border-white/10">
            <span className="text-[9px] text-[#A9A39D]">
              Propulsé par Kollekt • Carte de fidélité digitale sans application
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
