export type RewardMode = 'stamps' | 'points';

export type StampIconType = 'coffee' | 'burger' | 'star' | 'heart' | 'gift' | 'utensils' | 'pizza' | 'zap';

export interface CardConfig {
  mode: RewardMode;
  maxStamps: number; // e.g. 8 or 10
  pointsRatio: number; // e.g. 1€ = 10 pts
  rewardThreshold: number; // e.g. 100 pts
  rewardTitle: string; // e.g. "1 Menu Burger ou Plat du jour offert"
  rewardDescription: string;
  rewardEstimatedValue: number; // e.g. 13.50€
  primaryColor: string; // Background color of the pass
  secondaryColor: string;
  textColor: string;
  stampIcon: StampIconType;
  backNotice: string; // Notice displayed on the back of the pass
  welcomeBonus: number; // 1 stamp or 20 points upon registration
}

export interface Shop {
  id: string;
  name: string;
  slug: string;
  category: 'foodtruck' | 'restaurant' | 'cafe' | 'snack' | 'commerce';
  tagline: string;
  address: string;
  city: string;
  phone: string;
  instagram: string;
  openingHours: string;
  logoEmoji: string;
  cardConfig: CardConfig;
}

export interface Customer {
  id: string;
  shopId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  passId: string; // e.g. "KOL-48291"
  qrToken?: string; // Opaque random hex token for QR code
  optinMarketing?: boolean;
  createdAt: string;
  currentStamps: number;
  currentPoints: number;
  totalVisits: number;
  totalRewardsUnlocked: number;
  totalRewardsClaimed: number;
  lastVisitAt: string;
  walletInstalled: {
    apple: boolean;
    google: boolean;
  };
  referralCode: string;
  referredByCode?: string;
  referredCount: number;
  notes?: string;
}

export interface EnrollPublicCardResult {
  success: boolean;
  isExisting: boolean;
  cardId: string;
  qrToken: string;
  passCode: string;
  currentStamps: number;
  currentPoints: number;
  firstName: string;
  message?: string;
}

export type AuditActionType =
  | 'STAMP_ADD'
  | 'STAMP_REMOVE'
  | 'POINT_ADD'
  | 'POINT_REMOVE'
  | 'POINT_REDEEM'
  | 'REWARD_CLAIM'
  | 'MANUAL_ADJUST'
  | 'PASS_ISSUED'
  | 'REFERRAL_BONUS';

export interface AuditLogEntry {
  id: string;
  shopId: string;
  locationId?: string;
  locationName?: string;
  timestamp: string;
  operatorName: string;
  operatorRole: 'admin' | 'employee';
  customerId: string;
  customerName: string;
  actionType: AuditActionType;
  amount: number;
  previousBalance: number;
  newBalance: number;
  idempotencyKey: string;
  note?: string;
}

export interface ShopLocation {
  id: string;
  shopId: string;
  name: string;
  address: string;
  city: string;
  isActive: boolean;
}

export type DashboardPeriod = '7d' | '30d' | '90d' | 'custom';

export interface DashboardKPIs {
  newCardsCount: number;
  loyaltyVisitsCount: number;
  rewardsClaimedCount: number;
  activeCustomersCount: number;
  referralsCount: number;
  totalPointsOrStampsIssued: number;
}

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Lun 12" ou "12 Oct"
  visits: number;
  rewards: number;
  newCards: number;
}

export interface Campaign {
  id: string;
  shopId: string;
  title: string;
  message: string;
  target: 'all' | 'inactive' | 'vip';
  dateSent: string;
  opensCount: number;
  active: boolean;
  type: 'push_wallet' | 'promo' | 'event';
}

export interface StaffMember {
  id: string;
  shopId: string;
  name: string;
  role: 'admin' | 'employee';
  pinCode: string;
  active: boolean;
}

export type ActiveRole = 'merchant' | 'staff' | 'customer';

