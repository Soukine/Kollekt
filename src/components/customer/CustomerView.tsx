import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { WalletPassCard } from './WalletPassCard';
import { WalletAddModal } from './WalletAddModal';
import {
  Smartphone,
  Share2,
  Copy,
  Check,
  Gift,
  UserPlus,
  Users,
  ChevronDown,
  Sparkles,
  QrCode,
  ArrowRight,
} from 'lucide-react';

export const CustomerView: React.FC = () => {
  const {
    currentShop,
    activeCustomer,
    customers,
    setSelectedCustomerId,
    registerCustomer,
  } = useApp();

  const [walletModalType, setWalletModalType] = useState<'apple' | 'google' | null>(null);
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);

  // Registration form state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regReferral, setRegReferral] = useState('');
  const [regError, setRegError] = useState('');

  // Fallback if no active customer found for this shop
  const shopCustomers = customers.filter((c) => c.shopId === currentShop.id);
  const customer = activeCustomer && activeCustomer.shopId === currentShop.id
    ? activeCustomer
    : shopCustomers[0] || customers[0];

  const handleCopyReferral = () => {
    if (!customer) return;
    const shareText = `Rejoins la carte de fidélité de ${currentShop.name} avec mon code ${customer.referralCode} et obtiens ton 1er tampon offert !`;
    navigator.clipboard?.writeText(shareText);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!customer) return;
    const shareText = encodeURIComponent(
      `Salut ! Découvre ${currentShop.name} : ajoute ton pass fidélité directement dans ton Apple ou Google Wallet sans installer d'application. Utilise mon code parrain ${customer.referralCode} pour recevoir un tampon offert !`
    );
    window.open(`https://wa.me/?text=${shareText}`, '_blank');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFirstName.trim() || !regPhone.trim()) {
      setRegError('Veuillez renseigner au moins votre prénom et numéro de téléphone.');
      return;
    }
    setRegError('');
    const newCust = registerCustomer({
      firstName: regFirstName.trim(),
      lastName: regLastName.trim() || 'Client',
      phone: regPhone.trim(),
      email: regEmail.trim() || `${regFirstName.toLowerCase()}@client.kollekt.fr`,
      referredByCode: regReferral.trim() || undefined,
    });
    setShowRegisterModal(false);
    setRegFirstName('');
    setRegLastName('');
    setRegPhone('');
    setRegEmail('');
    setRegReferral('');
    setSelectedCustomerId(newCust.id);
  };

  const isRewardReady =
    customer &&
    (currentShop.cardConfig.mode === 'stamps'
      ? customer.currentStamps >= currentShop.cardConfig.maxStamps
      : customer.currentPoints >= currentShop.cardConfig.rewardThreshold);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] py-8 px-4 sm:px-6 max-w-4xl mx-auto">
      {/* Top test controls bar */}
      <div className="bg-[#2C2825] border border-white/10 rounded-2xl p-3.5 mb-8 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase font-bold text-[#A9A39D] flex items-center gap-1.5">
            <Users className="w-4 h-4 text-[#FF765F]" />
            Tester avec un profil client :
          </span>
          <div className="relative">
            <select
              value={customer?.id || ''}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="bg-[#211D1A] border border-white/10 text-xs font-semibold rounded-xl px-3 py-1.5 text-[#F7F4F0] appearance-none pr-8 cursor-pointer hover:border-white/20 transition-colors"
            >
              {shopCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName} ({c.currentStamps}/{currentShop.cardConfig.maxStamps} tampons)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#A9A39D] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF765F]/15 border border-[#FF765F]/30 text-xs font-bold text-[#FF765F] hover:bg-[#FF765F]/25 transition-colors cursor-pointer"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Nouveau Client (+ Créer pass)
        </button>
      </div>

      {/* Main Mobile Screen Mockup Container */}
      <div className="max-w-md mx-auto">
        {/* Banner if reward ready */}
        {isRewardReady && (
          <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-[#FF765F]/20 to-[#8BE3A2]/20 border border-[#8BE3A2]/40 shadow-xl flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-[#8BE3A2] text-[#211D1A] flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-[#8BE3A2] tracking-wider block">
                Félicitations ! Récompense Débloquée
              </span>
              <h4 className="text-sm font-extrabold text-[#F7F4F0]">
                {currentShop.cardConfig.rewardTitle}
              </h4>
              <p className="text-[11px] text-[#A9A39D] mt-0.5">
                Présentez votre pass au serveur pour en profiter lors de votre commande.
              </p>
            </div>
          </div>
        )}

        {/* The Pass Card */}
        {customer ? (
          <div className="space-y-6">
            <WalletPassCard customer={customer} shop={currentShop} />

            {/* Official Wallet Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => setWalletModalType('apple')}
                className="w-full h-13 rounded-2xl bg-black border border-white/20 hover:border-white/40 text-white font-semibold flex items-center justify-center gap-2 shadow-xl hover:bg-stone-900 transition-all cursor-pointer"
              >
                <span className="text-xl leading-none"></span>
                <span className="text-sm">Ajouter à Apple Wallet</span>
              </button>

              <button
                onClick={() => setWalletModalType('google')}
                className="w-full h-13 rounded-2xl bg-[#1e293b] border border-white/20 hover:border-white/40 text-white font-semibold flex items-center justify-center gap-2 shadow-xl hover:bg-[#334155] transition-all cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <span className="text-xs font-bold text-[#0ea5e9]">G</span>
                </div>
                <span className="text-sm">Enregistrer dans Google Wallet</span>
              </button>
            </div>

            {/* Referral Section */}
            <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF765F]/15 border border-[#FF765F]/30 text-[#FF765F] flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#F7F4F0]">
                    Parrainez vos proches
                  </h4>
                  <p className="text-xs text-[#A9A39D]">
                    1 tampon offert pour vous, 1 tampon pour votre ami !
                  </p>
                </div>
              </div>

              <div className="bg-[#211D1A] p-3 rounded-2xl border border-white/10 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A9A39D] block">
                    Votre code personnel
                  </span>
                  <span className="font-mono text-base font-extrabold text-[#FF765F]">
                    {customer.referralCode}
                  </span>
                </div>
                <button
                  onClick={handleCopyReferral}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-[#F7F4F0] flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedReferral ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#8BE3A2]" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copier
                    </>
                  )}
                </button>
              </div>

              <button
                onClick={handleShareWhatsApp}
                className="w-full py-2.5 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 hover:bg-[#25D366]/30 text-[#25D366] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>Partager directement sur WhatsApp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="text-center text-[11px] text-[#A9A39D] pt-1">
                Vous avez déjà parrainé{' '}
                <span className="font-bold text-[#F7F4F0]">{customer.referredCount} habitué(s)</span>.
              </div>
            </div>

            {/* How it works info footer */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1 text-xs text-[#A9A39D]">
              <p className="font-medium text-[#F7F4F0]">Comment ça marche en caisse ?</p>
              <p className="text-[11px]">
                Présentez simplement le QR Code de votre pass au commerçant au moment de régler. Votre tampon s'ajoute en direct sans aucune manipulation.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 bg-[#2C2825] rounded-3xl border border-white/10 p-6">
            <Smartphone className="w-12 h-12 text-[#A9A39D] mx-auto mb-3" />
            <h4 className="font-bold text-base text-[#F7F4F0]">Aucun pass sélectionné</h4>
            <p className="text-xs text-[#A9A39D] mt-1 mb-4">
              Créez votre première carte de fidélité pour commencer.
            </p>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2 rounded-xl bg-[#FF765F] text-[#211D1A] font-bold text-xs"
            >
              Créer mon pass
            </button>
          </div>
        )}
      </div>

      {/* Wallet Installation Sheet Modal */}
      {customer && walletModalType && (
        <WalletAddModal
          isOpen={!!walletModalType}
          onClose={() => setWalletModalType(null)}
          type={walletModalType}
          customer={customer}
          shop={currentShop}
        />
      )}

      {/* New Customer Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-[#F7F4F0] mb-1">
              Rejoindre la carte de fidélité
            </h3>
            <p className="text-xs text-[#A9A39D] mb-5">
              10 secondes pour créer votre pass {currentShop.name} avec 1er tampon offert.
            </p>

            {regError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs">
                {regError}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                    Prénom *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Clara"
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Petit"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                  Téléphone Mobile *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="06 12 34 56 78"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                  Email (pour sauvegarde)
                </label>
                <input
                  type="email"
                  placeholder="clara.petit@email.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                  Code parrain (optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: LUCAS-SMASH"
                  value={regReferral}
                  onChange={(e) => setRegReferral(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-[#A9A39D] hover:text-[#F7F4F0]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#FF765F] hover:bg-[#ff5e42] text-[#211D1A] font-bold text-xs shadow-lg shadow-[#FF765F]/20 cursor-pointer"
                >
                  Générer mon Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
