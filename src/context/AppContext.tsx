import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  Shop,
  Customer,
  AuditLogEntry,
  Campaign,
  StaffMember,
  ActiveRole,
  CardConfig,
  EnrollPublicCardResult,
} from '../types';
import {
  INITIAL_SHOPS,
  INITIAL_CUSTOMERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CAMPAIGNS,
  INITIAL_STAFF,
} from '../data/initialData';
import { generateIdempotencyKey, checkAndMarkIdempotent } from '../utils/idempotency';
import { fireRewardConfetti } from '../utils/confetti';

interface PushNotificationToast {
  id: string;
  title: string;
  message: string;
  shopName: string;
}

interface AppContextType {
  // Roles & Selection
  role: ActiveRole;
  setRole: (role: ActiveRole) => void;
  currentShop: Shop;
  shops: Shop[];
  setCurrentShopId: (id: string) => void;
  currentStaff: StaffMember;
  setCurrentStaffId: (id: string) => void;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  activeCustomer: Customer | undefined;

  // Data
  customers: Customer[];
  auditLogs: AuditLogEntry[];
  campaigns: Campaign[];
  staff: StaffMember[];

  // Mutations
  addStamps: (customerId: string, count: number, note?: string) => Promise<{ success: boolean; message: string; rewardUnlocked?: boolean }>;
  addPoints: (customerId: string, points: number, spentAmount?: number, note?: string) => Promise<{ success: boolean; message: string; rewardUnlocked?: boolean }>;
  claimReward: (customerId: string, note?: string) => Promise<{ success: boolean; message: string }>;
  manualAdjustBalance: (customerId: string, newBalance: number, reason: string) => Promise<{ success: boolean; message: string }>;
  updateShopConfig: (shopId: string, partialConfig: Partial<CardConfig>) => void;
  updateShopInfo: (shopId: string, partialShop: Partial<Shop>) => void;
  registerCustomer: (customerData: { firstName: string; lastName: string; phone: string; email: string; referredByCode?: string }) => Customer;
  installWalletPass: (customerId: string, type: 'apple' | 'google') => void;
  sendCampaign: (title: string, message: string, target: 'all' | 'inactive' | 'vip') => void;
  resetToDemoData: () => void;

  // Public QR Enrollment Flow
  publicTestSlug: string | null;
  openPublicCardPage: (slug?: string) => void;
  closePublicCardPage: () => void;
  getShopBySlug: (slug: string) => Shop | undefined;
  enrollOrRetrievePublicCustomer: (merchantSlug: string, input: { firstName: string; phone?: string; email?: string; optinMarketing?: boolean }) => EnrollPublicCardResult;

  // Wallet Push Notification Simulator Toast
  activeNotification: PushNotificationToast | null;
  dismissNotification: () => void;
  triggerSimulatedPush: (title: string, message: string) => void;
}

const STORAGE_KEYS = {
  SHOPS: 'kollekt_shops_v1',
  CUSTOMERS: 'kollekt_customers_v1',
  AUDIT: 'kollekt_audit_logs_v1',
  CAMPAIGNS: 'kollekt_campaigns_v1',
  STAFF: 'kollekt_staff_v1',
  CURRENT_SHOP: 'kollekt_current_shop_v1',
  CURRENT_STAFF: 'kollekt_current_staff_v1',
  SELECTED_CUSTOMER: 'kollekt_selected_customer_v1',
  ROLE: 'kollekt_role_v1',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Safe LocalStorage loader
  const loadStorage = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved) as T;
    } catch (e) {
      console.warn(`Error loading ${key} from localStorage:`, e);
    }
    return fallback;
  };

  const [shops, setShops] = useState<Shop[]>(() => loadStorage(STORAGE_KEYS.SHOPS, INITIAL_SHOPS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadStorage(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => loadStorage(STORAGE_KEYS.AUDIT, INITIAL_AUDIT_LOGS));
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => loadStorage(STORAGE_KEYS.CAMPAIGNS, INITIAL_CAMPAIGNS));
  const [staff, setStaff] = useState<StaffMember[]>(() => loadStorage(STORAGE_KEYS.STAFF, INITIAL_STAFF));

  const [role, setRoleState] = useState<ActiveRole>(() => loadStorage(STORAGE_KEYS.ROLE, 'merchant'));
  const [currentShopId, setCurrentShopIdState] = useState<string>(() => loadStorage(STORAGE_KEYS.CURRENT_SHOP, 'shop_smash_burger'));
  const [currentStaffId, setCurrentStaffIdState] = useState<string>(() => loadStorage(STORAGE_KEYS.CURRENT_STAFF, 'staff_02'));
  const [selectedCustomerId, setSelectedCustomerIdState] = useState<string>(() => loadStorage(STORAGE_KEYS.SELECTED_CUSTOMER, 'cust_lucas_martin'));

  const [activeNotification, setActiveNotification] = useState<PushNotificationToast | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SHOPS, JSON.stringify(shops));
  }, [shops]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT, JSON.stringify(auditLogs));
  }, [auditLogs]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  }, [campaigns]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(staff));
  }, [staff]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ROLE, JSON.stringify(role));
  }, [role]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHOP, JSON.stringify(currentShopId));
  }, [currentShopId]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_STAFF, JSON.stringify(currentStaffId));
  }, [currentStaffId]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CUSTOMER, JSON.stringify(selectedCustomerId));
  }, [selectedCustomerId]);

  const setRole = (newRole: ActiveRole) => setRoleState(newRole);
  const setCurrentShopId = (id: string) => setCurrentShopIdState(id);
  const setCurrentStaffId = (id: string) => setCurrentStaffIdState(id);
  const setSelectedCustomerId = (id: string) => setSelectedCustomerIdState(id);

  const currentShop = shops.find((s) => s.id === currentShopId) || shops[0];
  const currentStaff = staff.find((s) => s.id === currentStaffId) || staff[0];
  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers.find((c) => c.shopId === currentShop.id);

  // Notification simulation
  const triggerSimulatedPush = (title: string, message: string) => {
    const notif: PushNotificationToast = {
      id: 'notif_' + Date.now(),
      title,
      message,
      shopName: currentShop.name,
    };
    setActiveNotification(notif);
    // Auto dismiss after 6s
    setTimeout(() => {
      setActiveNotification((prev) => (prev?.id === notif.id ? null : prev));
    }, 6000);
  };

  const dismissNotification = () => setActiveNotification(null);

  // Idempotent Stamp Operation
  const addStamps = async (customerId: string, count: number, note?: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    const idempotencyKey = generateIdempotencyKey('STAMP', customerId);
    if (!checkAndMarkIdempotent(idempotencyKey)) {
      return { success: false, message: 'Opération déjà enregistrée (protection anti-double-clic)' };
    }

    const previousBalance = cust.currentStamps;
    const max = currentShop.cardConfig.maxStamps;
    const newBalance = previousBalance + count;
    const justUnlockedReward = newBalance >= max && previousBalance < max;

    const updatedCustomer: Customer = {
      ...cust,
      currentStamps: newBalance,
      totalVisits: cust.totalVisits + 1,
      totalRewardsUnlocked: justUnlockedReward ? cust.totalRewardsUnlocked + 1 : cust.totalRewardsUnlocked,
      lastVisitAt: new Date().toISOString(),
    };

    const newLog: AuditLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      shopId: currentShop.id,
      timestamp: new Date().toISOString(),
      operatorName: currentStaff.name,
      operatorRole: currentStaff.role,
      customerId: cust.id,
      customerName: `${cust.firstName} ${cust.lastName}`,
      actionType: 'STAMP_ADD',
      amount: count,
      previousBalance,
      newBalance,
      idempotencyKey,
      note: note || `+${count} tampon(s) crédité(s) en caisse.`,
    };

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCustomer : c)));
    setAuditLogs((prev) => [newLog, ...prev]);

    if (justUnlockedReward) {
      fireRewardConfetti();
      triggerSimulatedPush(
        '🎉 Félicitations ! Votre récompense est prête !',
        `Vous venez de débloquer : "${currentShop.cardConfig.rewardTitle}". Présentez votre pass lors de votre commande.`
      );
    } else {
      triggerSimulatedPush(
        `💳 +${count} Tampon ajouté chez ${currentShop.name}`,
        `Votre solde est désormais de ${newBalance}/${max} tampons.`
      );
    }

    return {
      success: true,
      message: justUnlockedReward ? `Félicitations ! Récompense débloquée (${currentShop.cardConfig.rewardTitle})` : `+${count} tampon(s) validé(s)`,
      rewardUnlocked: justUnlockedReward,
    };
  };

  // Idempotent Points Operation
  const addPoints = async (customerId: string, points: number, spentAmount?: number, note?: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    const idempotencyKey = generateIdempotencyKey('POINT', customerId);
    if (!checkAndMarkIdempotent(idempotencyKey)) {
      return { success: false, message: 'Opération déjà enregistrée (protection anti-double-clic)' };
    }

    const previousBalance = cust.currentPoints;
    const threshold = currentShop.cardConfig.rewardThreshold;
    const newBalance = previousBalance + points;
    const justUnlocked = newBalance >= threshold && previousBalance < threshold;

    const updatedCustomer: Customer = {
      ...cust,
      currentPoints: newBalance,
      totalVisits: cust.totalVisits + 1,
      totalRewardsUnlocked: justUnlocked ? cust.totalRewardsUnlocked + 1 : cust.totalRewardsUnlocked,
      lastVisitAt: new Date().toISOString(),
    };

    const newLog: AuditLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      shopId: currentShop.id,
      timestamp: new Date().toISOString(),
      operatorName: currentStaff.name,
      operatorRole: currentStaff.role,
      customerId: cust.id,
      customerName: `${cust.firstName} ${cust.lastName}`,
      actionType: 'POINT_ADD',
      amount: points,
      previousBalance,
      newBalance,
      idempotencyKey,
      note: note || (spentAmount ? `Achat de ${spentAmount.toFixed(2)}€ -> +${points} pts` : `+${points} points ajoutés`),
    };

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCustomer : c)));
    setAuditLogs((prev) => [newLog, ...prev]);

    if (justUnlocked) {
      fireRewardConfetti();
      triggerSimulatedPush('🎉 Seuil atteint !', `Vous avez atteint ${newBalance} points et pouvez utiliser votre récompense.`);
    }

    return {
      success: true,
      message: `+${points} points crédités`,
      rewardUnlocked: justUnlocked,
    };
  };

  // Claim Reward Operation
  const claimReward = async (customerId: string, note?: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    const mode = currentShop.cardConfig.mode;
    const isEligible =
      mode === 'stamps'
        ? cust.currentStamps >= currentShop.cardConfig.maxStamps
        : cust.currentPoints >= currentShop.cardConfig.rewardThreshold;

    if (!isEligible) {
      return { success: false, message: 'Le client n’a pas atteint le solde requis pour cette récompense.' };
    }

    const idempotencyKey = generateIdempotencyKey('CLAIM', customerId);
    if (!checkAndMarkIdempotent(idempotencyKey)) {
      return { success: false, message: 'Cette récompense a déjà été validée (sécurité anti-doublon).' };
    }

    const previousBalance = mode === 'stamps' ? cust.currentStamps : cust.currentPoints;
    const newBalance =
      mode === 'stamps'
        ? Math.max(0, cust.currentStamps - currentShop.cardConfig.maxStamps)
        : Math.max(0, cust.currentPoints - currentShop.cardConfig.rewardThreshold);

    const updatedCustomer: Customer = {
      ...cust,
      currentStamps: mode === 'stamps' ? newBalance : cust.currentStamps,
      currentPoints: mode === 'points' ? newBalance : cust.currentPoints,
      totalRewardsClaimed: cust.totalRewardsClaimed + 1,
      lastVisitAt: new Date().toISOString(),
    };

    const newLog: AuditLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      shopId: currentShop.id,
      timestamp: new Date().toISOString(),
      operatorName: currentStaff.name,
      operatorRole: currentStaff.role,
      customerId: cust.id,
      customerName: `${cust.firstName} ${cust.lastName}`,
      actionType: 'REWARD_CLAIM',
      amount: mode === 'stamps' ? currentShop.cardConfig.maxStamps : currentShop.cardConfig.rewardThreshold,
      previousBalance,
      newBalance,
      idempotencyKey,
      note: note || `Récompense utilisée : ${currentShop.cardConfig.rewardTitle}`,
    };

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCustomer : c)));
    setAuditLogs((prev) => [newLog, ...prev]);

    fireRewardConfetti();
    triggerSimulatedPush('🎁 Récompense validée avec succès !', `Profitez de votre ${currentShop.cardConfig.rewardTitle}. Merci pour votre fidélité !`);

    return { success: true, message: `Récompense "${currentShop.cardConfig.rewardTitle}" validée avec succès !` };
  };

  // Manual adjustment by Admin with strict audit log
  const manualAdjustBalance = async (customerId: string, newBalance: number, reason: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return { success: false, message: 'Client introuvable' };

    const mode = currentShop.cardConfig.mode;
    const previousBalance = mode === 'stamps' ? cust.currentStamps : cust.currentPoints;
    const idempotencyKey = generateIdempotencyKey('ADJUST', customerId);

    const updatedCustomer: Customer = {
      ...cust,
      currentStamps: mode === 'stamps' ? newBalance : cust.currentStamps,
      currentPoints: mode === 'points' ? newBalance : cust.currentPoints,
    };

    const newLog: AuditLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      shopId: currentShop.id,
      timestamp: new Date().toISOString(),
      operatorName: currentStaff.name,
      operatorRole: currentStaff.role,
      customerId: cust.id,
      customerName: `${cust.firstName} ${cust.lastName}`,
      actionType: 'MANUAL_ADJUST',
      amount: newBalance - previousBalance,
      previousBalance,
      newBalance,
      idempotencyKey,
      note: `Ajustement manuel : ${reason}`,
    };

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? updatedCustomer : c)));
    setAuditLogs((prev) => [newLog, ...prev]);

    return { success: true, message: 'Solde ajusté et consigné dans le journal d’audit' };
  };

  // Update shop card configuration
  const updateShopConfig = (shopId: string, partialConfig: Partial<CardConfig>) => {
    setShops((prev) =>
      prev.map((s) => {
        if (s.id !== shopId) return s;
        return {
          ...s,
          cardConfig: {
            ...s.cardConfig,
            ...partialConfig,
          },
        };
      })
    );
  };

  // Update shop profile
  const updateShopInfo = (shopId: string, partialShop: Partial<Shop>) => {
    setShops((prev) =>
      prev.map((s) => (s.id === shopId ? { ...s, ...partialShop } : s))
    );
  };

  // Register a new customer
  const registerCustomer = (data: { firstName: string; lastName: string; phone: string; email: string; referredByCode?: string }) => {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const passId = `KOL-${randomDigits}`;
    const cleanFirst = data.firstName.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'CLIENT';
    const referralCode = `${cleanFirst}-${Math.floor(10 + Math.random() * 90)}`;
    const welcomeStamps = currentShop.cardConfig.mode === 'stamps' ? currentShop.cardConfig.welcomeBonus : 0;
    const welcomePoints = currentShop.cardConfig.mode === 'points' ? currentShop.cardConfig.welcomeBonus : 0;

    const newCust: Customer = {
      id: 'cust_' + Date.now(),
      shopId: currentShop.id,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      passId,
      createdAt: new Date().toISOString(),
      currentStamps: welcomeStamps,
      currentPoints: welcomePoints,
      totalVisits: 1,
      totalRewardsUnlocked: 0,
      totalRewardsClaimed: 0,
      lastVisitAt: new Date().toISOString(),
      walletInstalled: {
        apple: false,
        google: false,
      },
      referralCode,
      referredByCode: data.referredByCode,
      referredCount: 0,
    };

    // If referred by another customer, reward referrer
    if (data.referredByCode) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.referralCode === data.referredByCode && c.shopId === currentShop.id) {
            return {
              ...c,
              referredCount: c.referredCount + 1,
              currentStamps: currentShop.cardConfig.mode === 'stamps' ? c.currentStamps + 1 : c.currentStamps,
              currentPoints: currentShop.cardConfig.mode === 'points' ? c.currentPoints + 20 : c.currentPoints,
            };
          }
          return c;
        })
      );
    }

    const log: AuditLogEntry = {
      id: 'log_' + Date.now(),
      shopId: currentShop.id,
      timestamp: new Date().toISOString(),
      operatorName: currentStaff.name,
      operatorRole: currentStaff.role,
      customerId: newCust.id,
      customerName: `${newCust.firstName} ${newCust.lastName}`,
      actionType: 'PASS_ISSUED',
      amount: welcomeStamps || welcomePoints,
      previousBalance: 0,
      newBalance: welcomeStamps || welcomePoints,
      idempotencyKey: generateIdempotencyKey('PASS', newCust.id),
      note: `Création du pass ${passId}. Bonus d’accueil crédité.`,
    };

    setCustomers((prev) => [newCust, ...prev]);
    setAuditLogs((prev) => [log, ...prev]);
    setSelectedCustomerId(newCust.id);

    triggerSimulatedPush('Bienvenue chez ' + currentShop.name + ' !', 'Votre pass de fidélité digital a été créé avec succès.');

    return newCust;
  };

  // Mark wallet pass installed
  const installWalletPass = (customerId: string, type: 'apple' | 'google') => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== customerId) return c;
        return {
          ...c,
          walletInstalled: {
            ...c.walletInstalled,
            [type]: true,
          },
        };
      })
    );
    triggerSimulatedPush(
      type === 'apple' ? ' Ajouté à Apple Wallet' : 'G Enregistré dans Google Wallet',
      'Votre pass est disponible sans connexion et s’actualisera automatiquement.'
    );
  };

  // Broadcast campaign
  const sendCampaign = (title: string, message: string, target: 'all' | 'inactive' | 'vip') => {
    const newCamp: Campaign = {
      id: 'camp_' + Date.now(),
      shopId: currentShop.id,
      title,
      message,
      target,
      dateSent: new Date().toISOString(),
      opensCount: 0,
      active: true,
      type: 'push_wallet',
    };
    setCampaigns((prev) => [newCamp, ...prev]);
    triggerSimulatedPush(title, message);
  };

  // Public QR Enrollment state & methods
  const [publicTestSlug, setPublicTestSlug] = useState<string | null>(null);
  const openPublicCardPage = (slug?: string) => setPublicTestSlug(slug || currentShop.slug);
  const closePublicCardPage = () => setPublicTestSlug(null);
  const getShopBySlug = (slug: string): Shop | undefined => shops.find((s) => s.slug === slug);

  const enrollOrRetrievePublicCustomer = (
    merchantSlug: string,
    input: { firstName: string; phone?: string; email?: string; optinMarketing?: boolean }
  ): EnrollPublicCardResult => {
    const targetShop = shops.find((s) => s.slug === merchantSlug);
    if (!targetShop) {
      return {
        success: false,
        isExisting: false,
        cardId: '',
        qrToken: '',
        passCode: '',
        currentStamps: 0,
        currentPoints: 0,
        firstName: input.firstName,
        message: 'Commerce introuvable',
      };
    }

    const cleanPhone = input.phone ? input.phone.replace(/[^0-9+]/g, '') : '';
    const cleanEmail = input.email ? input.email.trim().toLowerCase() : '';

    // Search strictly for THIS shop (strict multi-tenant isolation)
    const existing = customers.find((c) => {
      if (c.shopId !== targetShop.id) return false;
      const cPhone = c.phone.replace(/[^0-9+]/g, '');
      const cEmail = c.email.trim().toLowerCase();
      if (cleanPhone && cPhone === cleanPhone) return true;
      if (cleanEmail && cEmail === cleanEmail) return true;
      return false;
    });

    if (existing) {
      return {
        success: true,
        isExisting: true,
        cardId: existing.id,
        qrToken: existing.qrToken || existing.passId,
        passCode: existing.passId,
        currentStamps: existing.currentStamps,
        currentPoints: existing.currentPoints,
        firstName: existing.firstName,
      };
    }

    // Create new customer for this shop
    const randomCode = 'KOL-' + Math.floor(10000 + Math.random() * 90000);
    const opaqueQrToken = 'qr_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const welcomeStamps = targetShop.cardConfig.mode === 'stamps' ? targetShop.cardConfig.welcomeBonus : 0;
    const welcomePoints = targetShop.cardConfig.mode === 'points' ? targetShop.cardConfig.welcomeBonus : 0;

    const newCustomer: Customer = {
      id: 'cust_' + Date.now(),
      shopId: targetShop.id,
      firstName: input.firstName.trim(),
      lastName: '',
      phone: input.phone?.trim() || '',
      email: input.email?.trim() || '',
      passId: randomCode,
      qrToken: opaqueQrToken,
      optinMarketing: Boolean(input.optinMarketing),
      createdAt: new Date().toISOString(),
      currentStamps: welcomeStamps,
      currentPoints: welcomePoints,
      totalVisits: 1,
      totalRewardsUnlocked: 0,
      totalRewardsClaimed: 0,
      lastVisitAt: new Date().toISOString(),
      walletInstalled: {
        apple: false,
        google: false,
      },
      referralCode: `${input.firstName.toUpperCase().slice(0, 4)}-${Math.floor(10 + Math.random() * 90)}`,
      referredCount: 0,
    };

    setCustomers((prev) => [newCustomer, ...prev]);

    return {
      success: true,
      isExisting: false,
      cardId: newCustomer.id,
      qrToken: opaqueQrToken,
      passCode: randomCode,
      currentStamps: welcomeStamps,
      currentPoints: welcomePoints,
      firstName: newCustomer.firstName,
    };
  };

  // Reset to initial demo
  const resetToDemoData = () => {
    setShops(INITIAL_SHOPS);
    setCustomers(INITIAL_CUSTOMERS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCampaigns(INITIAL_CAMPAIGNS);
    setStaff(INITIAL_STAFF);
    setCurrentShopId('shop_smash_burger');
    setCurrentStaffId('staff_02');
    setSelectedCustomerId('cust_lucas_martin');
    setRoleState('merchant');
    setPublicTestSlug(null);
    localStorage.clear();
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        currentShop,
        shops,
        setCurrentShopId,
        currentStaff,
        setCurrentStaffId,
        selectedCustomerId,
        setSelectedCustomerId,
        activeCustomer,
        customers,
        auditLogs,
        campaigns,
        staff,
        addStamps,
        addPoints,
        claimReward,
        manualAdjustBalance,
        updateShopConfig,
        updateShopInfo,
        registerCustomer,
        installWalletPass,
        sendCampaign,
        resetToDemoData,
        publicTestSlug,
        openPublicCardPage,
        closePublicCardPage,
        getShopBySlug,
        enrollOrRetrievePublicCustomer,
        activeNotification,
        dismissNotification,
        triggerSimulatedPush,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
