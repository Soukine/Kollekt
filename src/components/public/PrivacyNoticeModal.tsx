import React from 'react';
import { X, ShieldCheck, Lock, UserCheck, Trash2 } from 'lucide-react';

interface PrivacyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantName: string;
}

export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({
  isOpen,
  onClose,
  merchantName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#2C2825] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[85vh] overflow-y-auto space-y-5 text-[#F7F4F0]">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#8BE3A2]" />
            <h3 className="font-extrabold text-sm sm:text-base">
              Protection de vos Données Personnelles (RGPD)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#A9A39D] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs text-[#A9A39D] leading-relaxed">
          <div>
            <h4 className="font-bold text-[#F7F4F0] mb-1">1. Responsable de Traitement</h4>
            <p>
              Le responsable du traitement de vos données est l’établissement <b>{merchantName}</b>, utilisant la plateforme technique Kollekt.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#F7F4F0] mb-1">2. Données Collectées & Minimisation</h4>
            <p>
              Kollekt applique une stricte minimisation des données : seul votre prénom et votre numéro de téléphone (ou email) sont collectés afin d’enregistrer vos tampons et de vous permettre de retrouver votre solde si vous changez d'appareil. Aucun nom de famille, adresse ou moyen de paiement n'est requis.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#F7F4F0] mb-1">3. Confidentialité & Zéro Partage</h4>
            <p>
              Vos données sont strictement cloisonnées à l'établissement <b>{merchantName}</b>. Elles ne sont <b>jamais revendues, partagées, ni croisées</b> avec d'autres commerces ou plateformes tierces.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#F7F4F0] mb-1">4. Communications & Consentement</h4>
            <p>
              Les offres promotionnelles ne vous sont envoyées que si vous avez expressément coché la case d'accord (opt-in). Vous pouvez retirer votre consentement à tout moment.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-[#F7F4F0] mb-1">5. Vos Droits & Suppression</h4>
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification et d'effacement de vos données. Vous pouvez supprimer votre carte et vos données personnelles à tout moment directement depuis cette interface.
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#FF765F] text-[#211D1A] font-extrabold text-xs cursor-pointer shadow-lg shadow-[#FF765F]/20"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
};
