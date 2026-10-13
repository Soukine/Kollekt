import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import {
  Scan,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Gift,
  Lock,
  User,
  History,
  QrCode,
  Zap,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const StaffPosView: React.FC = () => {
  const {
    currentShop,
    currentStaff,
    staff,
    setCurrentStaffId,
    customers,
    auditLogs,
    addStamps,
    addPoints,
    claimReward,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [spendAmount, setSpendAmount] = useState<string>('12.50');
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const shopCustomers = customers.filter((c) => c.shopId === currentShop.id);
  const selectedCustomer = shopCustomers.find((c) => c.id === selectedCustomerId) || null;

  // Filtered customers for search
  const filteredCustomers = searchQuery.trim()
    ? shopCustomers.filter(
        (c) =>
          c.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone.includes(searchQuery) ||
          c.passId.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shopCustomers.slice(0, 5);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  // Add stamps with idempotency and double-click guard
  const handleAddStamps = async (count: number) => {
    if (!selectedCustomer || isProcessing) return;
    setIsProcessing(true);
    try {
      const res = await addStamps(selectedCustomer.id, count);
      if (res.success) {
        showFeedback('success', res.message);
      } else {
        showFeedback('error', res.message);
      }
    } catch {
      showFeedback('error', 'Erreur lors de la validation.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add points with calculation
  const handleAddPoints = async () => {
    if (!selectedCustomer || isProcessing) return;
    const amount = parseFloat(spendAmount);
    if (isNaN(amount) || amount <= 0) {
      showFeedback('error', 'Veuillez saisir un montant valide.');
      return;
    }
    const points = Math.round(amount * currentShop.cardConfig.pointsRatio);
    setIsProcessing(true);
    try {
      const res = await addPoints(selectedCustomer.id, points, amount);
      if (res.success) {
        showFeedback('success', res.message);
      } else {
        showFeedback('error', res.message);
      }
    } catch {
      showFeedback('error', 'Erreur lors du crédit de points.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Claim reward
  const handleClaimReward = async () => {
    if (!selectedCustomer || isProcessing) return;
    if (
      !window.confirm(
        `Confirmez-vous la remise de la récompense "${currentShop.cardConfig.rewardTitle}" au client ${selectedCustomer.firstName} ${selectedCustomer.lastName} ?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await claimReward(selectedCustomer.id);
      if (res.success) {
        showFeedback('success', res.message);
      } else {
        showFeedback('error', res.message);
      }
    } catch {
      showFeedback('error', 'Erreur lors de la validation du cadeau.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Simulate scanning a random or targeted pass
  const handleSimulateScan = (cust: Customer) => {
    setIsScanningSimulated(true);
    setTimeout(() => {
      setIsScanningSimulated(false);
      setSelectedCustomerId(cust.id);
      showFeedback('success', `Pass ${cust.passId} de ${cust.firstName} scanné avec succès !`);
    }, 800);
  };

  // Handle PIN verification for operator switch
  const handleSwitchOperator = (e: React.FormEvent) => {
    e.preventDefault();
    const targetStaff = staff.find((s) => s.pinCode === pinInput);
    if (targetStaff) {
      setCurrentStaffId(targetStaff.id);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      showFeedback('success', `Connecté en tant que ${targetStaff.name}`);
    } else {
      setPinError('Code PIN incorrect (Ex: 0000 ou 1234)');
    }
  };

  const isRewardReady =
    selectedCustomer &&
    (currentShop.cardConfig.mode === 'stamps'
      ? selectedCustomer.currentStamps >= currentShop.cardConfig.maxStamps
      : selectedCustomer.currentPoints >= currentShop.cardConfig.rewardThreshold);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] py-6 px-4 sm:px-6 max-w-5xl mx-auto">
      {/* Top Staff Status Bar */}
      <div className="bg-[#2C2825] border border-white/10 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF765F]/15 border border-[#FF765F]/30 flex items-center justify-center text-[#FF765F]">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-[#FF765F]">
                Poste Caisse & Scan Express
              </span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-[#A9A39D]">
                Accès Opérateur Restreint
              </span>
            </div>
            <h2 className="text-sm font-bold text-[#F7F4F0] flex items-center gap-2 mt-0.5">
              <span>{currentShop.name}</span>
              <span className="text-[#A9A39D]">•</span>
              <span className="text-[#8BE3A2]">{currentStaff.name}</span>
            </h2>
          </div>
        </div>

        <button
          onClick={() => setShowPinModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#A9A39D] hover:text-[#F7F4F0] transition-colors cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          Changer de caissier (PIN)
        </button>
      </div>

      {/* Main Grid: Scan / Search Left, Actions Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client Finder / Scanner */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#F7F4F0] flex items-center gap-2">
                <Scan className="w-4 h-4 text-[#FF765F]" />
                Identifier le client
              </h3>
              <span className="text-[11px] text-[#A9A39D]">Scan QR ou Recherche</span>
            </div>

            {/* Scan Simulation Viewfinder */}
            <div className="relative rounded-2xl bg-[#211D1A] border-2 border-dashed border-[#FF765F]/40 p-6 flex flex-col items-center justify-center overflow-hidden min-h-[160px]">
              {isScanningSimulated ? (
                <div className="flex flex-col items-center gap-2 text-[#FF765F]">
                  <motion.div
                    animate={{ y: [-30, 30, -30] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                    className="w-full max-w-[140px] h-0.5 bg-[#FF765F] shadow-[0_0_12px_#FF765F]"
                  />
                  <QrCode className="w-12 h-12 animate-pulse mt-2" />
                  <span className="text-xs font-bold">Lecture du Pass en cours...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#FF765F] mb-2">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-[#F7F4F0]">
                    Scannez le QR Code du client
                  </p>
                  <p className="text-[11px] text-[#A9A39D] mt-0.5">
                    Sur son Apple Wallet, Google Wallet ou écran mobile
                  </p>
                  <div className="flex gap-2 mt-3">
                    {shopCustomers.slice(0, 2).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSimulateScan(c)}
                        className="px-2.5 py-1 rounded-lg bg-[#FF765F]/15 hover:bg-[#FF765F]/25 border border-[#FF765F]/30 text-[10px] font-bold text-[#FF765F] transition-colors cursor-pointer"
                      >
                        Simuler {c.firstName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manual Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par prénom, tél ou Pass ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] placeholder-[#A9A39D] focus:border-[#FF765F] focus:outline-none"
              />
            </div>

            {/* Client List */}
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              <span className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block mb-1">
                Clients en attente / récents :
              </span>
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#A9A39D]">
                  Aucun client trouvé pour cette recherche.
                </div>
              ) : (
                filteredCustomers.map((c) => {
                  const isSelected = selectedCustomerId === c.id;
                  const ready =
                    currentShop.cardConfig.mode === 'stamps'
                      ? c.currentStamps >= currentShop.cardConfig.maxStamps
                      : c.currentPoints >= currentShop.cardConfig.rewardThreshold;

                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setFeedback(null);
                      }}
                      className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF765F]/20 border border-[#FF765F] text-[#F7F4F0]'
                          : 'bg-[#211D1A] hover:bg-white/5 border border-white/5 text-[#F7F4F0]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs truncate">
                            {c.firstName} {c.lastName}
                          </span>
                          <span className="font-mono text-[10px] text-[#A9A39D]">
                            ({c.passId})
                          </span>
                        </div>
                        <span className="text-[10px] text-[#A9A39D] block truncate">
                          {c.phone}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        {ready ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#8BE3A2]/20 text-[#8BE3A2] text-[10px] font-bold">
                            <Gift className="w-3 h-3" /> Cadeau !
                          </span>
                        ) : (
                          <span className="font-bold text-xs text-[#FF765F]">
                            {currentShop.cardConfig.mode === 'stamps'
                              ? `${c.currentStamps}/${currentShop.cardConfig.maxStamps}`
                              : `${c.currentPoints} pts`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customer Card & Huge POS Actions */}
        <div className="lg:col-span-7 space-y-4">
          {selectedCustomer ? (
            <div className="space-y-4">
              {/* Feedback Alert */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 border ${
                      feedback.type === 'success'
                        ? 'bg-[#8BE3A2]/15 border-[#8BE3A2]/40 text-[#8BE3A2]'
                        : 'bg-red-500/15 border-red-500/40 text-red-300'
                    }`}
                  >
                    {feedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{feedback.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Customer Info Card */}
              <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                      Client sélectionné en caisse
                    </span>
                    <h3 className="text-xl font-extrabold text-[#F7F4F0] mt-0.5">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[#A9A39D] mt-1">
                      <span>Pass : <b className="font-mono text-[#F7F4F0]">{selectedCustomer.passId}</b></span>
                      <span>•</span>
                      <span>Tél : {selectedCustomer.phone}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#A9A39D] block">
                      Solde Fidélité
                    </span>
                    <span className="font-mono text-3xl font-black text-[#FF765F]">
                      {currentShop.cardConfig.mode === 'stamps'
                        ? `${selectedCustomer.currentStamps} / ${currentShop.cardConfig.maxStamps}`
                        : `${selectedCustomer.currentPoints} pts`}
                    </span>
                  </div>
                </div>

                {/* Reward Ready Banner */}
                {isRewardReady && (
                  <div className="my-4 p-4 rounded-2xl bg-[#8BE3A2]/15 border-2 border-[#8BE3A2] flex items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#8BE3A2] text-[#211D1A] flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-[#8BE3A2] tracking-wider block">
                          Récompense à remettre
                        </span>
                        <p className="text-sm font-bold text-[#F7F4F0]">
                          {currentShop.cardConfig.rewardTitle}
                        </p>
                        <span className="text-[10px] text-[#A9A39D]">
                          Valeur estimée : ~{currentShop.cardConfig.rewardEstimatedValue.toFixed(2)}€
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleClaimReward}
                      disabled={isProcessing}
                      className="px-4 py-2.5 rounded-xl bg-[#8BE3A2] hover:bg-[#72db8d] text-[#211D1A] font-extrabold text-xs shadow-lg shadow-[#8BE3A2]/20 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Valider & Donner
                    </button>
                  </div>
                )}

                {/* Big Action Buttons */}
                <div className="pt-4 space-y-3">
                  <span className="text-xs uppercase font-bold text-[#A9A39D] tracking-wider block">
                    Actions rapides (Protégées contre les doubles clics) :
                  </span>

                  {currentShop.cardConfig.mode === 'stamps' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleAddStamps(1)}
                        disabled={isProcessing}
                        className="h-16 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#FF765F]/20 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        +1 Tampon
                      </button>

                      <button
                        onClick={() => handleAddStamps(2)}
                        disabled={isProcessing}
                        className="h-16 rounded-2xl bg-[#211D1A] border-2 border-[#FF765F] hover:bg-[#FF765F]/15 disabled:opacity-50 text-[#FF765F] font-black text-base flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        +2 Tampons (Menu duo)
                      </button>
                    </div>
                  ) : (
                    /* Points mode form */
                    <div className="space-y-3">
                      <div className="p-3 bg-[#211D1A] rounded-2xl border border-white/10 flex items-center justify-between gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-[#A9A39D] block">
                            Montant de l'addition (€)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={spendAmount}
                            onChange={(e) => setSpendAmount(e.target.value)}
                            className="bg-transparent font-mono text-xl font-bold text-[#F7F4F0] focus:outline-none w-28"
                          />
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-[#A9A39D] block">
                            Points générés
                          </span>
                          <span className="font-mono text-xl font-bold text-[#FF765F]">
                            +{Math.round((parseFloat(spendAmount) || 0) * currentShop.cardConfig.pointsRatio)} pts
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleAddPoints}
                        disabled={isProcessing}
                        className="w-full h-14 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#FF765F]/20 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        Créditer les points
                      </button>
                    </div>
                  )}

                  {/* Redemptions button if eligible */}
                  {isRewardReady && (
                    <button
                      onClick={handleClaimReward}
                      disabled={isProcessing}
                      className="w-full py-3.5 rounded-2xl bg-[#8BE3A2] hover:bg-[#72db8d] text-[#211D1A] font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#8BE3A2]/20 transition-all cursor-pointer"
                    >
                      <Gift className="w-5 h-5" />
                      Valider et déduire la récompense ({currentShop.cardConfig.rewardTitle})
                    </button>
                  )}
                </div>
              </div>

              {/* Local Scan History */}
              <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase font-bold text-[#A9A39D] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#FF765F]" />
                    Dernières opérations de ce client
                  </h4>
                </div>

                <div className="space-y-2">
                  {auditLogs
                    .filter((log) => log.customerId === selectedCustomer.id)
                    .slice(0, 3)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-[#211D1A] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#F7F4F0]">
                            {log.actionType === 'STAMP_ADD'
                              ? `+${log.amount} tampon(s)`
                              : log.actionType === 'REWARD_CLAIM'
                              ? 'Récompense validée'
                              : log.actionType}
                          </span>
                          <span className="text-[10px] text-[#A9A39D] block">
                            Par {log.operatorName} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#8BE3A2]">
                          Solde : {log.newBalance}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[360px] bg-[#2C2825] border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-[#A9A39D] mb-4">
                <User className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#F7F4F0]">
                Aucun client sélectionné
              </h3>
              <p className="text-xs text-[#A9A39D] max-w-sm mt-1">
                Scannez le QR Code sur le téléphone du client ou choisissez un client dans la liste à gauche pour créditer ses points en 1 clic.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Operator PIN Switch Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[#F7F4F0] mb-1">
              Changer d'opérateur
            </h3>
            <p className="text-xs text-[#A9A39D] mb-4">
              Saisissez votre code PIN opérateur (ex: 0000 pour Maxime, 1234 pour Sarah).
            </p>

            {pinError && (
              <div className="p-2.5 mb-3 rounded-xl bg-red-500/20 text-red-200 text-xs">
                {pinError}
              </div>
            )}

            <form onSubmit={handleSwitchOperator} className="space-y-4">
              <input
                type="password"
                maxLength={4}
                autoFocus
                placeholder="****"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-widest font-mono text-2xl py-3 rounded-xl bg-[#211D1A] border border-white/10 text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-white/5 text-xs text-[#A9A39D]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-xl bg-[#FF765F] text-[#211D1A] font-bold text-xs"
                >
                  Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
