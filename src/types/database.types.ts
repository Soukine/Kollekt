/**
 * Database types representing the PostgreSQL/Supabase schema for Kollekt SaaS.
 */

export type MerchantRole = 'owner' | 'admin' | 'staff';
export type LoyaltyProgramType = 'stamps' | 'points';
export type TransactionType =
  | 'stamp_credit'
  | 'stamp_debit'
  | 'points_credit'
  | 'points_debit'
  | 'reward_redemption'
  | 'welcome_bonus'
  | 'referral_bonus'
  | 'manual_adjustment';

export type WalletPlatform = 'apple_passkit' | 'google_wallet' | 'web_only';
export type WalletPassStatus = 'active' | 'revoked' | 'expired';
export type ReferralStatus = 'pending' | 'validated' | 'rewarded' | 'cancelled';
export type CampaignTarget = 'all_customers' | 'inactive_30d' | 'vip_frequent' | 'ready_for_reward';
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'opened';
export type SubscriptionStatus =
  | 'incomplete'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid';

export interface DbProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type BusinessType =
  | 'food_truck'
  | 'restaurant'
  | 'cafe'
  | 'snack'
  | 'local_shop'
  | 'other';

export interface DbMerchant {
  id: string;
  name: string;
  slug: string;
  business_type?: BusinessType;
  onboarding_step?: number;
  onboarding_completed_at?: string | null;
  legal_name: string | null;
  siren: string | null;
  logo_url: string | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface DbLocation {
  id: string;
  merchant_id: string;
  name: string;
  slug: string;
  address_line1: string;
  postal_code: string;
  city: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbMerchantMember {
  id: string;
  merchant_id: string;
  profile_id: string;
  role: MerchantRole;
  pin_code_hash: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbLoyaltyProgram {
  id: string;
  merchant_id: string;
  location_id: string | null; // 2A / 2B extension
  name: string;
  type: LoyaltyProgramType;
  max_stamps: number | null;
  points_ratio: number | null;
  reward_threshold_points: number | null;
  welcome_bonus: number;
  primary_color: string;
  accent_color: string;
  stamp_icon: string;
  back_notice: string;
  inactivity_expiration_days: number | null; // 3B
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbLoyaltyReward {
  id: string;
  loyalty_program_id: string;
  title: string;
  description: string;
  cost_stamps: number | null;
  cost_points: number | null;
  estimated_monetary_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbCustomer {
  id: string;
  merchant_id: string; // 1A isolation
  phone: string;
  phone_normalized: string;
  first_name: string;
  last_name: string;
  email: string | null;
  optin_marketing: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbLoyaltyCard {
  id: string;
  merchant_id: string;
  loyalty_program_id: string;
  customer_id: string;
  qr_token: string;
  pass_code: string;
  current_stamps: number;
  current_points: number;
  total_lifetime_stamps: number;
  total_lifetime_points: number;
  total_rewards_claimed: number;
  total_visits: number;
  expires_at: string | null; // 3B
  last_activity_at: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface DbLoyaltyTransaction {
  id: string;
  merchant_id: string;
  loyalty_card_id: string;
  location_id: string | null;
  operator_member_id: string | null;
  reward_id: string | null;
  transaction_type: TransactionType;
  delta_stamps: number;
  delta_points: number;
  previous_balance_stamps: number;
  new_balance_stamps: number;
  previous_balance_points: number;
  new_balance_points: number;
  purchase_amount_eur: number | null;
  idempotency_key: string;
  note: string | null;
  created_at: string;
}

export interface DbWalletPass {
  id: string;
  merchant_id: string;
  loyalty_card_id: string;
  platform: WalletPlatform;
  serial_number: string;
  authentication_token: string;
  push_token: string | null;
  status: WalletPassStatus;
  last_synced_at: string | null;
  installed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbReferral {
  id: string;
  merchant_id: string;
  referrer_card_id: string;
  referee_customer_id: string;
  referral_code_used: string;
  status: ReferralStatus;
  rewarded_transaction_id: string | null;
  created_at: string;
  validated_at: string | null;
}

export interface DbCampaign {
  id: string;
  merchant_id: string;
  created_by_member_id: string | null;
  title: string;
  message: string;
  target: CampaignTarget;
  scheduled_at: string;
  sent_at: string | null;
  is_completed: boolean;
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  merchant_id: string;
  performed_by_profile_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DbSubscription {
  id: string;
  merchant_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}
