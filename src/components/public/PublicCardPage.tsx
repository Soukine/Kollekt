import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { customerEnrollmentSchema, customerRecoverySchema } from '../../lib/validations/customerEnrollment';
import { generateQrDataUrl } from '../../utils/qr';
import { PrivacyNoticeModal } from './PrivacyNoticeModal';
import {
  Gift,
  CheckCircle2,
  AlertCircle,
  QrCode,
  ShieldCheck,
  User,
  Phone,
  Mail,
  ArrowRight,
  Sparkles,
  Smartphone,
  RotateCcw,
  Check,
  Trash2,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface PublicProgramData {
  found?: boolean;
  is_active: boolean;
  merchant_id?: string;
  merchant_name: string;
  merchant_slug: string;
  logo_url: string | null;
  currency?: string;
  program_name?: string;
  program_type: 'stamps' | 'points';
  max_stamps?: number;
  reward_threshold_points?: number;
  primary_color: string;
  stamp_icon?: string;
  back_notice?: string;
  reward_title: string;
  message?: string;
}

interface PublicCardPageProps {
  merchantSlug: string;
  onExitToApp?: () => void;
}

interface StoredCardData {
  cardId: string;
  qrToken: string;
  passCode: string;
  currentStamps: number;
  currentPoints: number;
  firstName: string;
  savedAt: string;
}

export const PublicCardPage: React.FC<PublicCardPageProps> = ({
  merchantSlug,
  onExitToApp,
}) => {
  const { getShopBySlug, enrollOrRetrievePublicCustomer, customers } = useApp();
  const [loading, setLoading] = useState(true);
  const [programInfo, setProgramInfo] = useState<PublicProgramData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isInactive, setIsInactive] = useState(false);

  // Stored customer card on this phone
  const storageKey = `kollekt_card_${merchantSlug}`;
  const [cardData, setCardData] = useState<StoredCardData | null>(null);
  const [personalQrUrl, setPersonalQrUrl] = useState<string>('');

  // Enrollment Form State
  const [firstName, setFirstName] = useState('');
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [optinMarketing, setOptinMarketing] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery Mode State
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryContact, setRecoveryContact] = useState('');
  const [recoveryFirstName, setRecoveryFirstName] = useState('');
  const [recoveryFeedback, setRecoveryFeedback] = useState<string | null>(null);

  // Privacy Modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Rate Limiting attempt counter
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);

  // 1. Load public merchant program
  useEffect(() => {
    async function loadProgram() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_public_merchant_program', {
          p_slug: merchantSlug,
        });

        if (error || !data || !data.found) {
          // Fallback program lookup from local store or mock data
          const localShop = getShopBySlug(merchantSlug);
          if (localShop) {
            setProgramInfo({
              found: true,
              is_active: true,
              merchant_id: localShop.id,
              merchant_name: localShop.name,
              merchant_slug: localShop.slug,
              logo_url: null,
              currency: 'EUR',
              program_name: localShop.name,
              program_type: localShop.cardConfig.mode,
              max_stamps: localShop.cardConfig.maxStamps,
              reward_threshold_points: localShop.cardConfig.rewardThreshold,
              primary_color: localShop.cardConfig.primaryColor || '#2C2825',
              stamp_icon: localShop.cardConfig.stampIcon,
              back_notice: localShop.cardConfig.backNotice,
              reward_title: localShop.cardConfig.rewardTitle,
            });
          } else {
            // Default demo program if unknown slug
            setProgramInfo({
              found: true,
              is_active: true,
              merchant_name: 'Smash Burger Club',
              merchant_slug: merchantSlug,
              logo_url: null,
              primary_color: '#2C2825',
              program_type: 'stamps',
              max_stamps: 8,
              reward_title: '1 Menu Smash Burger offert',
              stamp_icon: 'burger',
              back_notice: '1 passage = 1 tampon. Valable sur tous nos emplacements.',
            });
          }
        } else if (!data.is_active) {
          setIsInactive(true);
          setProgramInfo(data as PublicProgramData);
        } else {
          setProgramInfo(data as PublicProgramData);
        }
      } catch (err) {
        console.warn('Program fetch fallback:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProgram();

    // Check local storage for existing card
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCardData(parsed);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  }, [merchantSlug]);

  // Generate QR code whenever personal card is available
  useEffect(() => {
    if (cardData?.qrToken) {
      generateQrDataUrl(cardData.qrToken, {
        width: 240,
        margin: 1,
        colorDark: '#211D1A',
        colorLight: '#FFFFFF',
      }).then(setPersonalQrUrl);
    }
  }, [cardData]);

  // Handle Enrollment
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Honeypot bot protection
    if (honeypot) return;

    const validation = customerEnrollmentSchema.safeParse({
      firstName,
      phone: contactType === 'phone' ? phone : undefined,
      email: contactType === 'email' ? email : undefined,
      optinMarketing,
    });

    if (!validation.success) {
      const errMap: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) errMap[issue.path[0].toString()] = issue.message;
      });
      setFormErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('enroll_or_retrieve_public_card', {
        p_merchant_slug: merchantSlug,
        p_first_name: validation.data.firstName,
        p_phone: validation.data.phone || null,
        p_email: validation.data.email || null,
        p_optin_marketing: validation.data.optinMarketing,
      });

      if (error || !data) {
        // Fallback local simulation if remote RPC is not ready
        const localRes = enrollOrRetrievePublicCustomer(merchantSlug, {
          firstName: validation.data.firstName,
          phone: validation.data.phone,
          email: validation.data.email,
          optinMarketing: validation.data.optinMarketing,
        });

        if (localRes.success) {
          const mockCard: StoredCardData = {
            cardId: localRes.cardId,
            qrToken: localRes.qrToken,
            passCode: localRes.passCode,
            currentStamps: localRes.currentStamps,
            currentPoints: localRes.currentPoints,
            firstName: localRes.firstName,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(storageKey, JSON.stringify(mockCard));
          setCardData(mockCard);
        }
      } else {
        const newCard: StoredCardData = {
          cardId: data.card_id,
          qrToken: data.qr_token,
          passCode: data.pass_code,
          currentStamps: data.current_stamps,
          currentPoints: data.current_points,
          firstName: data.first_name,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(newCard));
        setCardData(newCard);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Recovery Challenge
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryFeedback(null);

    // Rate limiting: 3 maximum failed attempts
    if (recoveryAttempts >= 3) {
      setRecoveryFeedback('Trop de tentatives infructueuses. Veuillez réessayer dans quelques minutes.');
      return;
    }

    const validation = customerRecoverySchema.safeParse({
      firstName: recoveryFirstName,
      contact: recoveryContact,
    });

    if (!validation.success) {
      setRecoveryFeedback('Veuillez renseigner votre prénom et votre moyen de contact.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEmail = validation.data.contact.includes('@');
      const { data, error } = await supabase.rpc('enroll_or_retrieve_public_card', {
        p_merchant_slug: merchantSlug,
        p_first_name: validation.data.firstName,
        p_phone: isEmail ? null : validation.data.contact,
        p_email: isEmail ? validation.data.contact : null,
        p_optin_marketing: false,
      });

      if (data && data.is_existing) {
        const restored: StoredCardData = {
          cardId: data.card_id,
          qrToken: data.qr_token,
          passCode: data.pass_code,
          currentStamps: data.current_stamps,
          currentPoints: data.current_points,
          firstName: data.first_name,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(storageKey, JSON.stringify(restored));
        setCardData(restored);
        setIsRecoveryMode(false);
        return;
      }

      // Fallback search in local store with strict merchant isolation
      const targetShop = getShopBySlug(merchantSlug);
      if (targetShop) {
        const cleanContact = validation.data.contact.trim().toLowerCase();
        const cleanPhone = cleanContact.replace(/[^0-9+]/g, '');
        const existingCust = customers.find((c) => {
          if (c.shopId !== targetShop.id) return false;
          if (c.firstName.toLowerCase() !== validation.data.firstName.toLowerCase()) return false;
          const cPhone = c.phone.replace(/[^0-9+]/g, '');
          const cEmail = c.email.trim().toLowerCase();
          if (cleanPhone && cPhone && (cPhone === cleanPhone || cPhone.endsWith(cleanPhone) || cleanPhone.endsWith(cPhone))) return true;
          if (cleanContact.includes('@') && cEmail === cleanContact) return true;
          return false;
        });

        if (existingCust) {
          const restored: StoredCardData = {
            cardId: existingCust.id,
            qrToken: existingCust.qrToken || existingCust.passId,
            passCode: existingCust.passId,
            currentStamps: existingCust.currentStamps,
            currentPoints: existingCust.currentPoints,
            firstName: existingCust.firstName,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(storageKey, JSON.stringify(restored));
          setCardData(restored);
          setIsRecoveryMode(false);
          return;
        }
      }

      // If neither Supabase nor local found a match:
      setRecoveryAttempts((prev) => prev + 1);
      setRecoveryFeedback('Aucune carte ne correspond exactement à ce prénom et ce contact pour ce commerce.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveCard = () => {
    if (window.confirm('Voulez-vous supprimer cette carte de fidélité de votre téléphone ?')) {
      localStorage.removeItem(storageKey);
      setCardData(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#211D1A] flex flex-col items-center justify-center p-4 text-[#F7F4F0]">
        <div className="w-12 h-12 rounded-2xl bg-[#FF765F] animate-pulse flex items-center justify-center text-stone-900 font-black text-xl mb-3">
          K
        </div>
        <p className="text-xs text-[#A9A39D]">Chargement de votre carte de fidélité...</p>
      </div>
    );
  }

  if (isInactive) {
    return (
      <div className="min-h-screen bg-[#211D1A] flex flex-col items-center justify-center p-6 text-center text-[#F7F4F0]">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center justify-center text-2xl mb-4">
          ⏳
        </div>
        <h2 className="text-lg font-bold text-[#F7F4F0]">Programme bientôt disponible</h2>
        <p className="text-xs text-[#A9A39D] max-w-sm mt-2 leading-relaxed">
          Le programme de fidélité de <b>{programInfo?.merchant_name}</b> est actuellement en préparation. Revenez très prochainement lors de votre prochaine visite !
        </p>
      </div>
    );
  }

  const isStamps = programInfo?.program_type === 'stamps';
  const maxStamps = programInfo?.max_stamps || 8;
  const currentStamps = cardData?.currentStamps || 0;
  const currentPoints = cardData?.currentPoints || 0;

  return (
    <div className="min-h-screen bg-[#211D1A] text-[#F7F4F0] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#FF765F] selection:text-[#211D1A]">
      {/* Top Brand Bar */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          {programInfo?.logo_url ? (
            <img
              src={programInfo.logo_url}
              alt="Logo commerce"
              className="w-8 h-8 rounded-xl object-cover border border-white/10"
            />
          ) : (
            <span className="text-2xl">🍔</span>
          )}
          <div>
            <h1 className="font-extrabold text-sm text-[#F7F4F0] leading-none">
              {programInfo?.merchant_name}
            </h1>
            <span className="text-[10px] text-[#A9A39D] uppercase tracking-wider">
              Fidélité Digitale
            </span>
          </div>
        </div>

        {onExitToApp && (
          <button
            onClick={onExitToApp}
            className="text-[11px] text-[#A9A39D] hover:text-white underline cursor-pointer"
          >
            Espace Commerçant
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-md mx-auto w-full my-auto py-6">
        {cardData ? (
          /* ================= ACTIVE CUSTOMER PASS VIEW ================= */
          <div className="space-y-6">
            {/* The Digital Card */}
            <div
              className="w-full rounded-3xl p-6 shadow-2xl relative border border-white/10 overflow-hidden text-[#F7F4F0]"
              style={{ backgroundColor: programInfo?.primary_color || '#2C2825' }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#A9A39D] tracking-wider block">
                    Titulaire du Pass
                  </span>
                  <h3 className="font-extrabold text-base text-[#F7F4F0]">
                    {cardData.firstName}
                  </h3>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-white/10 text-white font-bold">
                  {cardData.passCode}
                </span>
              </div>

              {/* Progress Display: Stamps or Points */}
              {isStamps ? (
                <div className="space-y-3 py-2">
                  <div className="grid grid-cols-4 gap-2.5">
                    {Array.from({ length: Math.min(16, maxStamps) }).map((_, idx) => {
                      const isStamped = idx < currentStamps;
                      const isLast = idx === maxStamps - 1;

                      return (
                        <div
                          key={idx}
                          className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all ${
                            isStamped
                              ? 'bg-[#FF765F] text-[#211D1A] font-black shadow-md shadow-[#FF765F]/30 scale-[1.02]'
                              : isLast
                              ? 'bg-amber-400 text-stone-900 border-2 border-amber-300 shadow-lg'
                              : 'bg-white/5 border border-dashed border-white/20 text-[#A9A39D]'
                          }`}
                        >
                          {isStamped ? (
                            <span className="text-base leading-none">✓</span>
                          ) : isLast ? (
                            <Gift className="w-4 h-4 text-stone-900" />
                          ) : (
                            <span className="text-[10px] font-mono opacity-40">{idx + 1}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-center pt-2">
                    <span className="text-xs font-bold text-[#F7F4F0] block">
                      {currentStamps} sur {maxStamps} tampons validés
                    </span>
                    <span className="text-[11px] text-[#8BE3A2] font-semibold flex items-center justify-center gap-1 mt-0.5">
                      <Gift className="w-3.5 h-3.5" />
                      Cadeau : {programInfo?.reward_title}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase text-[#A9A39D]">Solde actuel</span>
                    <span className="font-mono text-2xl font-black text-[#FF765F]">
                      {currentPoints} pts
                    </span>
                  </div>
                  <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF765F] to-[#8BE3A2] rounded-full"
                      style={{
                        width: `${Math.min(100, (currentPoints / (programInfo?.reward_threshold_points || 100)) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-center text-[#8BE3A2] font-bold">
                    Récompense : {programInfo?.reward_title}
                  </p>
                </div>
              )}

              {/* Personal Opaque QR Code for Cashier Scan */}
              <div className="pt-4 border-t border-white/10 flex flex-col items-center">
                <div className="bg-white p-2.5 rounded-2xl shadow-xl">
                  {personalQrUrl ? (
                    <img
                      src={personalQrUrl}
                      alt="QR Code Personnel"
                      className="w-36 h-36 object-contain"
                    />
                  ) : (
                    <div className="w-36 h-36 bg-stone-100 rounded-xl animate-pulse" />
                  )}
                </div>
                <p className="text-[10px] text-[#A9A39D] mt-2 text-center">
                  Présentez ce QR Code en caisse pour créditer vos tampons
                </p>
              </div>
            </div>

            {/* Wallet Integration Placeholders (Visual Only) */}
            <div className="space-y-2.5">
              <div className="w-full h-12 rounded-2xl bg-black border border-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 opacity-80 cursor-not-allowed">
                <span className="text-lg leading-none"></span>
                <span>Ajouter à Apple Wallet (Bientôt disponible)</span>
              </div>
              <div className="w-full h-12 rounded-2xl bg-[#1e293b] border border-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 opacity-80 cursor-not-allowed">
                <span className="font-bold text-[#0ea5e9]">G</span>
                <span>Enregistrer dans Google Wallet (Bientôt disponible)</span>
              </div>
              <p className="text-[10px] text-center text-[#A9A39D]">
                💡 Conservez cette page en favori sur votre écran d'accueil pour y accéder en 1 clic.
              </p>
            </div>

            {/* Manage / Delete Card */}
            <div className="text-center pt-2">
              <button
                onClick={handleRemoveCard}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer cette carte de mon téléphone</span>
              </button>
            </div>
          </div>
        ) : !isRecoveryMode ? (
          /* ================= ENROLLMENT FORM (NEW CUSTOMER) ================= */
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            {/* Value pitch */}
            <div className="text-center space-y-1.5 pb-2">
              <span className="text-[11px] uppercase font-black tracking-wider text-[#FF765F] block">
                Carte de Fidélité Sans Application
              </span>
              <h2 className="text-xl font-extrabold text-[#F7F4F0]">
                Rejoignez le programme de {programInfo?.merchant_name}
              </h2>
              <p className="text-xs text-[#A9A39D] leading-relaxed">
                Obtenez <b>{programInfo?.reward_title}</b> à chaque passage régulier. 1er tampon offert dès maintenant !
              </p>
            </div>

            <form onSubmit={handleEnrollSubmit} className="space-y-4">
              {/* Invisible Honeypot Anti-Spam */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
              />

              {/* First Name */}
              <div>
                <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                  Votre Prénom *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A9A39D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Camille"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs sm:text-sm text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                      formErrors.firstName ? 'border-red-500' : 'border-white/10'
                    }`}
                  />
                </div>
                {formErrors.firstName && (
                  <span className="text-[10px] text-red-400 mt-1 block">{formErrors.firstName}</span>
                )}
              </div>

              {/* Contact Switcher (Phone vs Email) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] uppercase font-bold text-[#A9A39D]">
                    Moyen de récupération *
                  </label>
                  <div className="flex gap-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setContactType('phone')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        contactType === 'phone' ? 'bg-[#FF765F] text-[#211D1A]' : 'text-[#A9A39D]'
                      }`}
                    >
                      Téléphone
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactType('email')}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        contactType === 'email' ? 'bg-[#FF765F] text-[#211D1A]' : 'text-[#A9A39D]'
                      }`}
                    >
                      Email
                    </button>
                  </div>
                </div>

                {contactType === 'phone' ? (
                  <div className="relative">
                    <Phone className="w-4 h-4 text-[#A9A39D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      placeholder="06 12 34 56 78"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs sm:text-sm text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                        formErrors.phone ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#A9A39D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="camille@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-[#211D1A] border text-xs sm:text-sm text-[#F7F4F0] focus:outline-none focus:border-[#FF765F] transition-colors ${
                        formErrors.email ? 'border-red-500' : 'border-white/10'
                      }`}
                    />
                  </div>
                )}
                {formErrors.phone && (
                  <span className="text-[10px] text-red-400 mt-1 block">{formErrors.phone}</span>
                )}
                {formErrors.email && (
                  <span className="text-[10px] text-red-400 mt-1 block">{formErrors.email}</span>
                )}

                <p className="text-[10px] text-[#A9A39D] leading-snug">
                  🔒 Sert exclusivement à restaurer vos tampons si vous changez d'appareil. Aucune revente de données.
                </p>
              </div>

              {/* Marketing Opt-in (Never Pre-checked!) */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={optinMarketing}
                    onChange={(e) => setOptinMarketing(e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-[#211D1A] text-[#FF765F] focus:ring-[#FF765F] cursor-pointer"
                  />
                  <span className="text-[11px] text-[#A9A39D] leading-snug">
                    J'accepte de recevoir les offres exclusives et nouveautés de <b>{programInfo?.merchant_name}</b> (max. 2 messages/mois).
                  </span>
                </label>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF765F] hover:bg-[#ff5e42] disabled:opacity-50 text-[#211D1A] font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#FF765F]/20 transition-all cursor-pointer mt-2"
              >
                {isSubmitting ? (
                  <span>Génération de votre pass...</span>
                ) : (
                  <>
                    <span>Créer ma carte fidélité</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Recovery link */}
            <div className="pt-3 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => setIsRecoveryMode(true)}
                className="text-xs text-[#A9A39D] hover:text-[#F7F4F0] underline transition-colors cursor-pointer"
              >
                Déjà client ? Retrouver ma carte existante
              </button>
            </div>
          </div>
        ) : (
          /* ================= RECOVERY CHALLENGE MODE ================= */
          <div className="bg-[#2C2825] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="text-center space-y-1">
              <span className="text-[11px] uppercase font-black tracking-wider text-[#FF765F] block">
                Récupération Sécurisée
              </span>
              <h3 className="text-lg font-bold text-[#F7F4F0]">
                Retrouvez vos tampons chez {programInfo?.merchant_name}
              </h3>
              <p className="text-xs text-[#A9A39D]">
                Indiquez le prénom et le contact utilisés lors de votre inscription.
              </p>
            </div>

            {recoveryFeedback && (
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-200">
                {recoveryFeedback}
              </div>
            )}

            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div>
                <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                  Votre Prénom *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Camille"
                  value={recoveryFirstName}
                  onChange={(e) => setRecoveryFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-[#A9A39D] block mb-1">
                  Numéro de téléphone ou Email *
                </label>
                <input
                  type="text"
                  required
                  placeholder="06 12 34 56 78 ou camille@email.com"
                  value={recoveryContact}
                  onChange={(e) => setRecoveryContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#211D1A] border border-white/10 text-xs text-[#F7F4F0] focus:outline-none focus:border-[#FF765F]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-2xl bg-[#FF765F] text-[#211D1A] font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF765F]/20"
              >
                {isSubmitting ? 'Vérification...' : 'Retrouver ma carte'}
              </button>

              <button
                type="button"
                onClick={() => setIsRecoveryMode(false)}
                className="w-full py-2 text-xs text-[#A9A39D] hover:text-white block text-center"
              >
                Retour à l'inscription
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Footer Legal & Privacy Links */}
      <div className="max-w-md mx-auto w-full pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-[#A9A39D]">
        <span>Propulsé par Kollekt.fr</span>
        <button
          onClick={() => setShowPrivacyModal(true)}
          className="hover:text-white underline cursor-pointer"
        >
          Données personnelles & RGPD
        </button>
      </div>

      {/* Privacy Notice Modal */}
      <PrivacyNoticeModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        merchantName={programInfo?.merchant_name || 'Votre commerce'}
      />
    </div>
  );
};
