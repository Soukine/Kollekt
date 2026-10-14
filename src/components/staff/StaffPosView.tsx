import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import { QrCameraScanner } from './QrCameraScanner';
import {
  Scan,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Gift,
  Lock,
  User,
  History,
  QrCode,
  Zap,
  Camera,
  CameraOff,
  ArrowRight,
  ShieldAlert,
  X,
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
    deductPointsOrStamps,
    claimReward,
    findCustomerByScanOrInput,
  } = useApp();

  // Scanner & Search state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // In-flight & Feedback state
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Points addition state
  const [spendAmount, setSpendAmount] = useState<string>('12.50');

  // Deduction (Retrait avec motif) modal state
  const [showDeductModal, setShowDeductModal] = useState(false);
  const [deductCount, setDeductCount] = useState<number>(1);
  const [deductReason, setDeductReason] = useState<string>('');
  const [deductError, setDeductError] = useState<string>('');

  // Operator PIN Switch Modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Filter customers belonging strictly to current shop
  const shopCustomers = customers.filter((c) => c.shopId === currentShop.id);
  const selectedCustomer = shopCustomers.find((c) => c.id === selectedCustomerId) || null;

  // Filtered customers for search query
  const filteredCustomers = manualInput.trim()
    ? shopCustomers.filter(
        (c) =>
          c.firstName.toLowerCase().includes(manualInput.toLowerCase()) ||
          c.lastName.toLowerCase().includes(manualInput.toLowerCase()) ||
          c.phone.includes(manualInput) ||
          c.passId.toLowerCase().includes(manualInput.toLowerCase()) ||
          (c.qrToken && c.qrToken.toLowerCase().includes(manualInput.toLowerCase()))
      )
    : shopCustomers.slice(0, 5);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  // Process Scanned code or Manual input
  const handleIdentifyCustomer = (rawText: string) => {
    const res = findCustomerByScanOrInput(rawText);
    if (res.success && res.customer) {
      setSelectedCustomerId(res.customer.id);
      showFeedback(
        'success',
        `Pass de ${res.customer.firstName} ${res.customer.lastName} identifié avec succès !`
      );
      setCameraError(null);
      // Auto-close camera on successful scan on mobile to free screen space
      if (window.innerWidth < 768) {
        setIsCameraActive(false);
      }
    } else {
      showFeedback('error', res.error || 'Identifiant non reconnu.');
    }
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
      showFeedback('error', 'Veuillez saisir un montant d’addition valide en euros.');
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

  // Submit Deduction with Mandatory Reason
  const handleConfirmDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || isProcessing) return;

    if (!deductReason || deductReason.trim().length < 3) {
      setDeductError('Le motif justificatif est obligatoire (minimum 3 caractères).');
      return;
    }

    setIsProcessing(true);
    setDeductError('');
    try {
      const res = await deductPointsOrStamps(
        selectedCustomer.id,
        deductCount,
        deductReason.trim()
      );
      if (res.success) {
        showFeedback('success', res.message);
        setShowDeductModal(false);
        setDeductReason('');
        setDeductCount(1);
      } else {
        setDeductError(res.message);
      }
    } catch {
      setDeductError('Erreur lors du retrait de solde.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Claim reward
  const handleClaimReward = async () => {
    if (!selectedCustomer || isProcessing) return;
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
      setPinError('Code PIN incorrect (Ex: 0000 pour Maxime, 1234 pour Sarah)');
    }
  };

  // Simulate cross-merchant scan to test isolation failure
  const handleSimulateCrossMerchant = () => {
    const otherShopCustomer = customers.find((c) => c.shopId !== currentShop.id);
    if (otherShopCustomer) {
      handleIdentifyCustomer(otherShopCustomer.passId);
    } else {
      showFeedback('error', 'Aucun client d’un autre commerce trouvé pour le test.');
    }
  };

  const isRewardReady =
    selectedCustomer &&
    (currentShop.cardConfig.mode === 'stamps'
      ? selectedCustomer.currentStamps >= currentShop.cardConfig.maxStamps
      : selectedCustomer.currentPoints >= currentShop.cardConfig.rewardThreshold);

  return (
    <div className="min-h-[calc(100vh-4.5rem)] py-4 sm:py-6 px-3 sm:px-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Staff Status Bar */}
      <div className="bg-[#2C2825] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF765F]/15 border border-[#FF765F]/30 flex items-center justify-center text-[#FF765F] shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-wider text-[#FF765F]">
                Poste Caisse & Scanner
              </span>
              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-[#A9A39D] hidden sm:inline">
                Opérateur : {currentStaff.role}
              </span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-[#F7F4F0] flex items-center gap-2 mt-0.5">
              <span>{currentShop.name}</span>
              <span className="text-[#A9A39D]">•</span>
              <span className="text-[#8BE3A2]">{currentStaff.name}</span>
            </h2>
          </div>
        </div>

        <button
          onClick={() => setShowPinModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#A9A39D] hover:text-[#F7F4F0] transition-colors cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5 text-[#FF765F]" />
          <span>Changer de caissier (PIN)</span>
        </button>
      </div>

      {/* Global Feedback Alert */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 border shadow-lg ${
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
            <span className="flex-1">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-white/40 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Scan & Finder Left, Actions Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Column: Client Finder / Scanner */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#F7F4F0] flex items-center gap-2">
                <Scan className="w-4 h-4 text-[#FF765F]" />
                Scanner le Pass client
              </h3>
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                  isCameraActive
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-[#FF765F]/15 text-[#FF765F] border border-[#FF765F]/30 hover:bg-[#FF765F]/25'
                }`}
              >
                {isCameraActive ? (
                  <>
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>Masquer caméra</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Activer caméra</span>
                  </>
                )}
              </button>
            </div>

            {/* Real Camera Scanner (with graceful permission/device fallback) */}
            {isCameraActive ? (
              <QrCameraScanner
                active={isCameraActive}
                onScan={handleIdentifyCustomer}
                onError={(err) => setCameraError(err)}
                onClose={() => setIsCameraActive(false)}
              />
            ) : (
              <div className="rounded-2xl bg-[#211D1A] border-2 border-dashed border-[#FF765F]/30 p-5 flex flex-col items-center justify-center text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#FF765F]">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#F7F4F0]">
                    Scannez le QR Code ou Wallet
                  </p>
                  <p className="text-[11px] text-[#A9A39D] mt-0.5">
                    Sur Apple Wallet, Google Wallet ou écran mobile du client
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(true)}
                  className="mt-1 px-4 py-2 rounded-xl bg-[#FF765F] text-[#211D1A] font-extrabold text-xs shadow-md shadow-[#FF765F]/20 hover:bg-[#ff5e42] transition-colors cursor-pointer"
                >
                  Ouvrir le scanner caméra
                </button>
              </div>
            )}

            {/* Camera error notification banner */}
            {cameraError && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{cameraError}</span>
              </div>
            )}

            {/* Manual Input Fallback */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                Saisie manuelle ou recherche :
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#A9A39D] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Pass ID (ex: KOL-78942), tél, prénom..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualInput.trim()) {
                        handleIdentifyCustomer(manualInput);
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] placeholder-[#A9A39D] focus:border-[#FF765F] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleIdentifyCustomer(manualInput)}
                  disabled={!manualInput.trim()}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FF765F]/20 hover:bg-[#FF765F]/30 disabled:opacity-40 text-[#FF765F] font-bold text-xs transition-colors cursor-pointer"
                >
                  Valider
                </button>
              </div>
            </div>

            {/* Quick Test Simulators */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <span className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                Simulations rapides pour tests :
              </span>
              <div className="flex flex-wrap gap-2">
                {shopCustomers.slice(0, 2).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleIdentifyCustomer(c.passId)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-[#F7F4F0] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>{c.firstName}</span>
                    <span className="text-[#A9A39D]">({c.passId})</span>
                  </button>
                ))}

                <button
                  onClick={handleSimulateCrossMerchant}
                  className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[10px] font-bold text-red-300 transition-colors cursor-pointer flex items-center gap-1"
                  title="Teste le rejet d’une carte appartenant à un autre commerce"
                >
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span>Tester client autre commerce</span>
                </button>
              </div>
            </div>

            {/* Recent Local Customers List */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 pt-1">
              <span className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block mb-1">
                Clients récents :
              </span>
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-4 text-xs text-[#A9A39D]">
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
                            <Gift className="w-3 h-3" /> Prêt !
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
              {/* Customer Info Card */}
              <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                      Client sélectionné en caisse
                    </span>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-[#F7F4F0] mt-0.5">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-[#A9A39D] mt-1">
                      <span>
                        Pass : <b className="font-mono text-[#F7F4F0]">{selectedCustomer.passId}</b>
                      </span>
                      <span>•</span>
                      <span>Tél : {selectedCustomer.phone}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-[#A9A39D] block">
                      Solde Fidélité
                    </span>
                    <span className="font-mono text-2xl sm:text-3xl font-black text-[#FF765F]">
                      {currentShop.cardConfig.mode === 'stamps'
                        ? `${selectedCustomer.currentStamps} / ${currentShop.cardConfig.maxStamps}`
                        : `${selectedCustomer.currentPoints} pts`}
                    </span>
                  </div>
                </div>

                {/* Reward Ready Banner */}
                {isRewardReady && (
                  <div className="my-4 p-4 rounded-2xl bg-[#8BE3A2]/15 border-2 border-[#8BE3A2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#8BE3A2] text-[#211D1A] flex items-center justify-center shrink-0">
                        <Gift className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black text-[#8BE3A2] tracking-wider block">
                          🎉 Récompense prête à être remise !
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
                      type="button"
                      onClick={handleClaimReward}
                      disabled={isProcessing}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#8BE3A2] hover:bg-[#72db8d] text-[#211D1A] font-extrabold text-xs shadow-lg shadow-[#8BE3A2]/20 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      Valider & Donner
                    </button>
                  </div>
                )}

                {/* Big Action Buttons (Touch-friendly & Protected against double click) */}
                <div className="pt-4 space-y-3">
                  <span className="text-xs uppercase font-bold text-[#A9A39D] tracking-wider block">
                    Créditer le client :
                  </span>

                  {currentShop.cardConfig.mode === 'stamps' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleAddStamps(1)}
                        disabled={isProcessing}
                        className="h-14 sm:h-16 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-[#FF765F]/20 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        +1 Tampon
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddStamps(2)}
                        disabled={isProcessing}
                        className="h-14 sm:h-16 rounded-2xl bg-[#211D1A] border-2 border-[#FF765F] hover:bg-[#FF765F]/15 disabled:opacity-50 text-[#FF765F] font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        +2 Tampons
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
                            Points à créditer
                          </span>
                          <span className="font-mono text-xl font-bold text-[#FF765F]">
                            +{Math.round((parseFloat(spendAmount) || 0) * currentShop.cardConfig.pointsRatio)} pts
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddPoints}
                        disabled={isProcessing}
                        className="w-full h-14 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-[#FF765F]/20 transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-5 h-5 stroke-[3]" />
                        Créditer les points
                      </button>
                    </div>
                  )}

                  {/* Deduction with mandatory reason button */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeductModal(true);
                        setDeductError('');
                        setDeductReason('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#A9A39D] hover:text-[#F7F4F0] flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Retirer des points/tampons (avec motif)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Local Scan History */}
              <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase font-bold text-[#A9A39D] flex items-center gap-2">
                    <History className="w-4 h-4 text-[#FF765F]" />
                    Journal des opérations de ce client
                  </h4>
                </div>

                <div className="space-y-2">
                  {auditLogs
                    .filter((log) => log.customerId === selectedCustomer.id)
                    .slice(0, 4)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-[#211D1A] border border-white/5 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#F7F4F0]">
                            {log.actionType === 'STAMP_ADD'
                              ? `+${log.amount} tampon(s)`
                              : log.actionType === 'STAMP_REMOVE'
                              ? `-${log.amount} tampon(s)`
                              : log.actionType === 'POINT_ADD'
                              ? `+${log.amount} points`
                              : log.actionType === 'POINT_REMOVE'
                              ? `-${log.amount} points`
                              : log.actionType === 'REWARD_CLAIM'
                              ? 'Récompense remise'
                              : log.actionType}
                          </span>
                          <span className="text-[10px] text-[#A9A39D] block">
                            Par {log.operatorName} • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {log.note && ` — ${log.note}`}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-[#8BE3A2] shrink-0 ml-2">
                          Solde : {log.newBalance}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[360px] bg-[#2C2825] border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-[#A9A39D]">
                <User className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#F7F4F0]">
                Aucun client sélectionné
              </h3>
              <p className="text-xs text-[#A9A39D] max-w-sm leading-relaxed">
                Scannez le QR Code sur le téléphone du client avec la caméra, ou tapez son Pass ID / numéro dans le champ à gauche pour créditer ses points en 1 clic.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Deduction with Mandatory Reason Modal */}
      {showDeductModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-[#F7F4F0] flex items-center gap-2">
                <Minus className="w-4 h-4 text-amber-400" />
                Retirer des {currentShop.cardConfig.mode === 'stamps' ? 'tampons' : 'points'}
              </h3>
              <button
                type="button"
                onClick={() => setShowDeductModal(false)}
                className="text-white/40 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#A9A39D]">
              Client : <b className="text-[#F7F4F0]">{selectedCustomer.firstName} {selectedCustomer.lastName}</b> (Solde actuel : {currentShop.cardConfig.mode === 'stamps' ? selectedCustomer.currentStamps : selectedCustomer.currentPoints})
            </p>

            {deductError && (
              <div className="p-3 rounded-xl bg-red-500/20 text-red-200 text-xs">
                {deductError}
              </div>
            )}

            <form onSubmit={handleConfirmDeduction} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-[#A9A39D] block mb-1">
                  Nombre à déduire :
                </label>
                <input
                  type="number"
                  min={1}
                  max={
                    currentShop.cardConfig.mode === 'stamps'
                      ? selectedCustomer.currentStamps
                      : selectedCustomer.currentPoints
                  }
                  value={deductCount}
                  onChange={(e) => setDeductCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-sm font-bold text-[#F7F4F0] focus:border-[#FF765F] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#A9A39D] block mb-1">
                  Motif obligatoire (justification auditée) :
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex : Annulation commande, erreur de saisie précédente, remboursement produit..."
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] placeholder-[#A9A39D] focus:border-[#FF765F] focus:outline-none"
                />
                <span className="text-[10px] text-[#A9A39D] block mt-1">
                  Ce motif sera consigné de façon immuable dans le grand livre d’audit Kollekt.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeductModal(false)}
                  className="w-1/2 py-2.5 rounded-xl bg-white/5 text-xs text-[#A9A39D] hover:text-[#F7F4F0]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !deductReason.trim()}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold text-xs cursor-pointer"
                >
                  Valider le retrait
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Operator PIN Switch Modal */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#2C2825] border border-white/10 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[#F7F4F0] mb-1">
              Changer d'opérateur
            </h3>
            <p className="text-xs text-[#A9A39D]">
              Saisissez votre code PIN opérateur (ex: 0000 pour Maxime, 1234 pour Sarah).
            </p>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-200 text-xs">
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
