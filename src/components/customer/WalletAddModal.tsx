import React, { useState, useEffect } from 'react';
import { Customer, Shop } from '../../types';
import { useApp } from '../../context/AppContext';
import { Check, ShieldCheck, Zap, Bell, Download, Smartphone, Loader2, ExternalLink, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WalletAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'apple' | 'google';
  customer: Customer;
  shop: Shop;
}

interface ServerPassInfo {
  applePassUrl?: string;
  googleWalletUrl?: string;
  universalInstallUrl?: string;
  syncStatus?: 'pending' | 'synced' | 'failed' | 'retrying';
  retryCount?: number;
}

export const WalletAddModal: React.FC<WalletAddModalProps> = ({
  isOpen,
  onClose,
  type,
  customer,
  shop,
}) => {
  const { installWalletPass } = useApp();
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverPass, setServerPass] = useState<ServerPassInfo | null>(null);

  const isApple = type === 'apple';

  // Charger ou créer le pass côté serveur
  useEffect(() => {
    if (!isOpen || !customer) return;

    let isMounted = true;
    setIsLoading(true);

    const isStamps = shop.cardConfig.mode === 'stamps';
    const balance = isStamps ? customer.currentStamps : customer.currentPoints;
    const target = isStamps ? shop.cardConfig.maxStamps : shop.cardConfig.rewardThreshold;
    const isRewardReady = balance >= target;

    fetch('/api/wallet/passes/get-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId: shop.id,
        design: {
          merchantName: shop.name,
          logoEmoji: shop.logoEmoji,
          primaryColor: shop.cardConfig.primaryColor,
          secondaryColor: shop.cardConfig.secondaryColor,
          textColor: shop.cardConfig.textColor,
          programName: `${shop.name} Fidélité`,
          termsNotice: shop.cardConfig.backNotice,
        },
        data: {
          loyaltyCardId: customer.id,
          serialNumber: customer.passId,
          qrToken: customer.qrToken || customer.passId,
          customerFirstName: customer.firstName,
          customerLastName: customer.lastName,
          mode: shop.cardConfig.mode,
          balance,
          target,
          rewardTitle: shop.cardConfig.rewardTitle,
          isRewardReady,
        },
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setServerPass({
            applePassUrl: data.applePassUrl,
            googleWalletUrl: data.googleWalletUrl,
            universalInstallUrl: data.universalInstallUrl,
            syncStatus: data.syncStatus,
            retryCount: data.retryCount,
          });
        }
      })
      .catch((err) => {
        console.warn('Wallet endpoint offline or local dev, using client fallback:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, customer, shop]);

  if (!isOpen) return null;

  const handleConfirmAdd = () => {
    installWalletPass(customer.id, type);
    setIsAdded(true);

    const targetUrl = isApple
      ? serverPass?.applePassUrl
      : serverPass?.googleWalletUrl;

    if (targetUrl && !targetUrl.includes('example.com')) {
      // Ouvre le lien Wallet sans alertes bloquantes
      window.location.assign(targetUrl);
    }

    setTimeout(() => {
      setIsAdded(false);
      onClose();
    }, 1800);
  };

  const handleDownloadPassFile = () => {
    const passPayload = {
      formatVersion: 1,
      passTypeIdentifier: 'pass.com.kollekt.loyalty',
      serialNumber: customer.passId,
      teamIdentifier: 'KOLLEKT75',
      organizationName: shop.name,
      description: `Carte de fidélité ${shop.name}`,
      foregroundColor: '#F7F4F0',
      backgroundColor: shop.cardConfig.primaryColor,
      labelColor: '#A9A39D',
      barcode: {
        message: customer.qrToken || customer.passId,
        format: 'PKBarcodeFormatQR',
        altText: 'Présentez ce code lors de votre commande',
      },
      generic: {
        primaryFields: [
          {
            key: 'balance',
            label: shop.cardConfig.mode === 'stamps' ? 'TAMPONS' : 'POINTS',
            value:
              shop.cardConfig.mode === 'stamps'
                ? `${customer.currentStamps}/${shop.cardConfig.maxStamps}`
                : `${customer.currentPoints} pts`,
          },
        ],
        secondaryFields: [
          {
            key: 'holder',
            label: 'CLIENT',
            value: `${customer.firstName} ${customer.lastName}`,
          },
          {
            key: 'reward',
            label: 'CADEAU',
            value: shop.cardConfig.rewardTitle,
          },
        ],
      },
    };

    const blob = new Blob([JSON.stringify(passPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shop.slug}-${customer.passId}.${isApple ? 'pkpass.json' : 'googlepass.json'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative z-10 w-full max-w-md bg-[#2C2825] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* iOS / Google Header */}
          <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-[#211D1A]">
            <button
              onClick={onClose}
              className="text-xs text-[#A9A39D] hover:text-[#F7F4F0] font-medium"
            >
              Annuler
            </button>
            <div className="flex items-center gap-1.5 font-semibold text-xs text-[#F7F4F0]">
              {isApple ? (
                <>
                  <span className="text-sm"></span> Apple Wallet
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-[#8BE3A2]">G</span> Google Wallet
                </>
              )}
            </div>
            <button
              onClick={handleConfirmAdd}
              disabled={isAdded || isLoading}
              className={`text-xs font-bold transition-colors ${
                isAdded
                  ? 'text-[#8BE3A2]'
                  : isApple
                  ? 'text-[#38bdf8] hover:text-[#0284c7]'
                  : 'text-[#8BE3A2] hover:text-[#72db8d]'
              }`}
            >
              {isAdded ? 'Ajouté !' : 'Ajouter'}
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Sync status indicator */}
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[#A9A39D]">État du pass serveur :</span>
              {isLoading ? (
                <span className="text-[#FF765F] flex items-center gap-1.5 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Génération...
                </span>
              ) : serverPass?.syncStatus === 'retrying' ? (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  En attente de connexion (sécurisé)
                </span>
              ) : (
                <span className="text-[#8BE3A2] font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  Pass prêt & synchronisé
                </span>
              )}
            </div>

            {/* Visual Pass Preview Card */}
            <div
              className="p-5 rounded-2xl shadow-lg border border-white/10 relative overflow-hidden text-[#F7F4F0]"
              style={{ backgroundColor: shop.cardConfig.primaryColor }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{shop.logoEmoji}</span>
                  <div>
                    <h4 className="font-bold text-sm leading-tight">{shop.name}</h4>
                    <span className="text-[10px] text-[#A9A39D] uppercase tracking-wider">
                      Pass Fidélité
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10">
                  {customer.passId}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 border-y border-white/10 my-2">
                <div>
                  <span className="text-[10px] uppercase text-[#A9A39D] block">
                    {shop.cardConfig.mode === 'stamps' ? 'Tampons' : 'Solde Points'}
                  </span>
                  <span className="font-extrabold text-lg text-[#FF765F]">
                    {shop.cardConfig.mode === 'stamps'
                      ? `${customer.currentStamps} / ${shop.cardConfig.maxStamps}`
                      : `${customer.currentPoints} pts`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#A9A39D] block">Cadeau</span>
                  <span className="font-medium text-xs text-[#F7F4F0] line-clamp-1">
                    {shop.cardConfig.rewardTitle}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#A9A39D]">
                <span>{customer.firstName} {customer.lastName}</span>
                <span className="font-medium text-[#8BE3A2]">Prêt à l'emploi</span>
              </div>
            </div>

            {/* Value Proposition bullets */}
            <div className="space-y-2.5">
              <h5 className="text-xs uppercase font-bold text-[#A9A39D] tracking-wider">
                Avantages du pass sans application
              </h5>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-[#8BE3A2]/15 text-[#8BE3A2] flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F7F4F0]">
                    Zéro application à télécharger
                  </p>
                  <p className="text-[11px] text-[#A9A39D] mt-0.5">
                    Le pass s’intègre directement dans votre application Cartes (Apple Wallet) ou Google Wallet native.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-[#FF765F]/15 text-[#FF765F] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F7F4F0]">
                    Mise à jour en temps réel
                  </p>
                  <p className="text-[11px] text-[#A9A39D] mt-0.5">
                    À chaque achat en caisse, votre solde de tampons s'actualise automatiquement sur votre pass.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F7F4F0]">
                    Toujours accessible hors-ligne
                  </p>
                  <p className="text-[11px] text-[#A9A39D] mt-0.5">
                    Accessible en 1 double-clic sur le bouton latéral de votre téléphone, même sans réseau.
                  </p>
                </div>
              </div>
            </div>

            {/* Disclaimer explicite sur les notifications */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start gap-2.5 text-[11px] text-[#A9A39D]">
              <Info className="w-4 h-4 text-[#A9A39D] shrink-0 mt-0.5" />
              <span>
                Les notifications sur l'écran verrouillé dépendent des réglages de notifications et du mode d'économie d'énergie de votre appareil Apple ou Android.
              </span>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleConfirmAdd}
                disabled={isAdded || isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] text-[#211D1A] font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF765F]/20 transition-all cursor-pointer"
              >
                {isAdded ? (
                  <>
                    <Check className="w-5 h-5 stroke-[3]" />
                    Pass ajouté avec succès !
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    {isApple ? 'Ajouter à Apple Wallet' : 'Enregistrer dans Google Wallet'}
                  </>
                )}
              </button>

              <button
                onClick={handleDownloadPassFile}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-[#A9A39D] hover:text-[#F7F4F0] flex items-center justify-center gap-1.5 transition-colors"
                title="Exporter le fichier pass JSON officiel"
              >
                <Download className="w-3.5 h-3.5" />
                Télécharger la spécification pass (.json)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
