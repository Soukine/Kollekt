-- ==============================================================================
-- KOLLEKT - MIGRATION INITIALE COMPLÈTE (Multi-Tenant SaaS Loyalty Platform)
-- Options d'arbitrage validées :
--   1A : Isolation stricte des clients par commerçant (RGPD / étanchéité)
--   2A/2B : Programme mutualisé par défaut (location_id NULL) avec extension par établissement
--   3B : Expiration par inactivité désactivée par défaut (inactivity_expiration_days NULL)
--   4 Hybride : Comptes nominatifs Supabase Auth + Déverrouillage rapide par code PIN caisse
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
CREATE TYPE merchant_role AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE loyalty_program_type AS ENUM ('stamps', 'points');
CREATE TYPE transaction_type AS ENUM (
  'stamp_credit',
  'stamp_debit',
  'points_credit',
  'points_debit',
  'reward_redemption',
  'welcome_bonus',
  'referral_bonus',
  'manual_adjustment'
);
CREATE TYPE wallet_platform AS ENUM ('apple_passkit', 'google_wallet', 'web_only');
CREATE TYPE wallet_pass_status AS ENUM ('active', 'revoked', 'expired');
CREATE TYPE referral_status AS ENUM ('pending', 'validated', 'rewarded', 'cancelled');
CREATE TYPE campaign_target AS ENUM ('all_customers', 'inactive_30d', 'vip_frequent', 'ready_for_reward');
CREATE TYPE delivery_status AS ENUM ('queued', 'sent', 'failed', 'opened');
CREATE TYPE subscription_status AS ENUM ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid');

-- 3. PROFILES (Extension auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. MERCHANTS (Organisations / Tenants racine)
CREATE TABLE merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) >= 2),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  legal_name TEXT,
  siren VARCHAR(9) CHECK (siren IS NULL OR char_length(siren) = 9),
  logo_url TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. LOCATIONS (Établissements / Points de vente physiques ou food trucks)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  city TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_locations_merchant_slug UNIQUE (merchant_id, slug)
);

-- 6. MERCHANT_MEMBERS (Collaborateurs nominatifs avec déverrouillage caisse par PIN)
CREATE TABLE merchant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role merchant_role NOT NULL DEFAULT 'staff',
  pin_code_hash TEXT, -- Hash bcrypt/argon2 pour le déverrouillage rapide caisse
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_merchant_members_org_profile UNIQUE (merchant_id, profile_id)
);

-- 7. MERCHANT_MEMBER_LOCATIONS (Rattachement strict des collaborateurs de rôle 'staff')
CREATE TABLE merchant_member_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_member_id UUID NOT NULL REFERENCES merchant_members(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_locations UNIQUE (merchant_member_id, location_id)
);

-- 8. LOYALTY_PROGRAMS (Mutualisé par défaut avec location_id NULL, ou dédié à un établissement)
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE, -- NULL = tout le réseau (2A), non-NULL = établissement dédié (2B)
  name TEXT NOT NULL,
  type loyalty_program_type NOT NULL DEFAULT 'stamps',
  max_stamps INT CHECK (type != 'stamps' OR (max_stamps IS NOT NULL AND max_stamps BETWEEN 4 AND 24)),
  points_ratio NUMERIC(6,2) CHECK (type != 'points' OR (points_ratio IS NOT NULL AND points_ratio > 0)),
  reward_threshold_points INT CHECK (type != 'points' OR (reward_threshold_points IS NOT NULL AND reward_threshold_points > 0)),
  welcome_bonus INT NOT NULL DEFAULT 1,
  primary_color VARCHAR(7) NOT NULL DEFAULT '#2C2825' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color VARCHAR(7) NOT NULL DEFAULT '#FF765F' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  stamp_icon TEXT NOT NULL DEFAULT 'burger',
  back_notice TEXT NOT NULL,
  inactivity_expiration_days INT DEFAULT NULL CHECK (inactivity_expiration_days IS NULL OR inactivity_expiration_days > 0), -- Option 3B (NULL = pas d'expiration)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. LOYALTY_REWARDS (Catalogue des récompenses du programme)
CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cost_stamps INT DEFAULT 8 CHECK (cost_stamps IS NULL OR cost_stamps > 0),
  cost_points INT CHECK (cost_points IS NULL OR cost_points > 0),
  estimated_monetary_value NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (estimated_monetary_value >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. CUSTOMERS (Clients finaux partitionnés strictement par commerçant - Option 1A)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL, -- E.164 (+336...)
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  optin_marketing BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_customers_merchant_phone UNIQUE (merchant_id, phone_normalized)
);

-- 11. LOYALTY_CARDS (Carte de fidélité individuelle avec jeton QR non incrémental)
CREATE TABLE loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'), -- Jeton cryptographique aléatoire 32 hex
  pass_code VARCHAR(12) NOT NULL UNIQUE, -- Ex: KOL-78942
  current_stamps INT NOT NULL DEFAULT 0 CHECK (current_stamps >= 0),
  current_points INT NOT NULL DEFAULT 0 CHECK (current_points >= 0),
  total_lifetime_stamps INT NOT NULL DEFAULT 0 CHECK (total_lifetime_stamps >= 0),
  total_lifetime_points INT NOT NULL DEFAULT 0 CHECK (total_lifetime_points >= 0),
  total_rewards_claimed INT NOT NULL DEFAULT 0 CHECK (total_rewards_claimed >= 0),
  total_visits INT NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  expires_at TIMESTAMPTZ DEFAULT NULL, -- Option 3B (recalculé si inactivity_expiration_days est configuré)
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_loyalty_cards_program_customer UNIQUE (loyalty_program_id, customer_id)
);

-- 12. LOYALTY_TRANSACTIONS (Ledger immuable comptable & traçabilité stricte)
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  loyalty_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE RESTRICT,
  location_id UUID REFERENCES locations(id) ON DELETE RESTRICT,
  operator_member_id UUID REFERENCES merchant_members(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE RESTRICT,
  transaction_type transaction_type NOT NULL,
  delta_stamps INT NOT NULL DEFAULT 0,
  delta_points INT NOT NULL DEFAULT 0,
  previous_balance_stamps INT NOT NULL CHECK (previous_balance_stamps >= 0),
  new_balance_stamps INT NOT NULL CHECK (new_balance_stamps >= 0),
  previous_balance_points INT NOT NULL CHECK (previous_balance_points >= 0),
  new_balance_points INT NOT NULL CHECK (new_balance_points >= 0),
  purchase_amount_eur NUMERIC(10,2) CHECK (purchase_amount_eur IS NULL OR purchase_amount_eur >= 0),
  idempotency_key TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_transactions_card_idempotency UNIQUE (loyalty_card_id, idempotency_key)
);

-- 13. WALLET_PASSES (Pass Apple Wallet .pkpass & Google Wallet)
CREATE TABLE wallet_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  loyalty_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  platform wallet_platform NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  authentication_token TEXT NOT NULL,
  push_token TEXT,
  status wallet_pass_status NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. REFERRALS (Système de parrainage client)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  referrer_card_id UUID NOT NULL REFERENCES loyalty_cards(id) ON DELETE CASCADE,
  referee_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,
  status referral_status NOT NULL DEFAULT 'pending',
  rewarded_transaction_id UUID REFERENCES loyalty_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at TIMESTAMPTZ,
  CONSTRAINT uq_referrals_merchant_referee UNIQUE (merchant_id, referee_customer_id)
);

-- 15. CAMPAIGNS (Campagnes et push Wallet géolocalisés ou programmés)
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_by_member_id UUID REFERENCES merchant_members(id) ON DELETE SET NULL,
  title VARCHAR(100) NOT NULL,
  message VARCHAR(255) NOT NULL,
  target campaign_target NOT NULL DEFAULT 'all_customers',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. CAMPAIGN_DELIVERIES (Suivi des livraisons de push par terminal)
CREATE TABLE campaign_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  wallet_pass_id UUID NOT NULL REFERENCES wallet_passes(id) ON DELETE CASCADE,
  status delivery_status NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  CONSTRAINT uq_campaign_deliveries UNIQUE (campaign_id, wallet_pass_id)
);

-- 17. AUDIT_LOGS (Journalisation des actions d'administration et de sécurité)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  performed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 18. SUBSCRIPTIONS (Abonnements Stripe en prévision)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES merchants(id) ON DELETE RESTRICT,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- INDEX STRATÉGIQUES
-- ==============================================================================
CREATE INDEX idx_merchant_members_profile ON merchant_members(profile_id, is_active);
CREATE INDEX idx_merchant_member_loc_member ON merchant_member_locations(merchant_member_id);
CREATE INDEX idx_locations_merchant ON locations(merchant_id);
CREATE INDEX idx_loyalty_programs_merchant ON loyalty_programs(merchant_id);
CREATE INDEX idx_loyalty_programs_location ON loyalty_programs(location_id) WHERE location_id IS NOT NULL;
CREATE INDEX idx_customers_merchant ON customers(merchant_id);
CREATE INDEX idx_customers_phone_merchant ON customers(merchant_id, phone_normalized);
CREATE INDEX idx_loyalty_cards_customer ON loyalty_cards(customer_id);
CREATE INDEX idx_loyalty_cards_program ON loyalty_cards(loyalty_program_id);
CREATE INDEX idx_loyalty_transactions_card ON loyalty_transactions(loyalty_card_id, created_at DESC);
CREATE INDEX idx_loyalty_transactions_location ON loyalty_transactions(location_id, created_at DESC);
CREATE INDEX idx_wallet_passes_card ON wallet_passes(loyalty_card_id);
CREATE INDEX idx_wallet_passes_push ON wallet_passes(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX idx_campaign_deliveries_campaign ON campaign_deliveries(campaign_id);
CREATE INDEX idx_audit_logs_merchant_date ON audit_logs(merchant_id, created_at DESC);

-- ==============================================================================
-- FONCTIONS DE SÉCURITÉ & HELPER RLS (Security Definer)
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_user_merchant_ids()
RETURNS SETOF UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT merchant_id FROM merchant_members
  WHERE profile_id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION is_merchant_admin(target_merchant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM merchant_members
    WHERE profile_id = auth.uid()
      AND merchant_id = target_merchant_id
      AND role IN ('owner', 'admin')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION can_staff_access_location(target_location_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role merchant_role;
  v_member_id UUID;
BEGIN
  SELECT id, role INTO v_member_id, v_role
  FROM merchant_members
  WHERE profile_id = auth.uid()
    AND merchant_id = (SELECT merchant_id FROM locations WHERE id = target_location_id)
    AND is_active = true;

  IF v_role IN ('owner', 'admin') THEN
    RETURN TRUE;
  ELSIF v_role = 'staff' THEN
    RETURN EXISTS (
      SELECT 1 FROM merchant_member_locations
      WHERE merchant_member_id = v_member_id AND location_id = target_location_id
    );
  END IF;
  RETURN FALSE;
END;
$$;

-- ==============================================================================
-- TRANSACTION ATOMIQUE LEDGER : execute_loyalty_transaction
-- Garantit l'absence de race condition (FOR UPDATE) et l'idempotence totale
-- ==============================================================================

CREATE OR REPLACE FUNCTION execute_loyalty_transaction(
  p_qr_token TEXT,
  p_location_id UUID,
  p_transaction_type transaction_type,
  p_delta_stamps INT,
  p_delta_points INT,
  p_purchase_amount_eur NUMERIC,
  p_reward_id UUID,
  p_idempotency_key TEXT,
  p_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card RECORD;
  v_program RECORD;
  v_operator_id UUID;
  v_new_stamps INT;
  v_new_points INT;
  v_reward RECORD;
  v_transaction_id UUID;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Vérification d'idempotence
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE loyalty_card_id = (SELECT id FROM loyalty_cards WHERE qr_token = p_qr_token)
      AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'message', 'Opération déjà enregistrée (idempotente)'
    );
  END IF;

  -- 2. Résolution et autorisation de l'opérateur caisse
  SELECT id INTO v_operator_id
  FROM merchant_members
  WHERE profile_id = auth.uid() AND is_active = true;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Opérateur non authentifié ou inactif';
  END IF;

  IF NOT can_staff_access_location(p_location_id) THEN
    RAISE EXCEPTION 'Accès refusé pour cet établissement';
  END IF;

  -- 3. Verrouillage de la carte client (ROW LOCK) pour éliminer les doubles scans simultanés
  SELECT * INTO v_card
  FROM loyalty_cards
  WHERE qr_token = p_qr_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carte de fidélité introuvable';
  END IF;

  -- 4. Programme de fidélité associé
  SELECT * INTO v_program
  FROM loyalty_programs
  WHERE id = v_card.loyalty_program_id;

  -- 5. Calcul des soldes selon la transaction
  IF p_transaction_type = 'reward_redemption' THEN
    SELECT * INTO v_reward FROM loyalty_rewards WHERE id = p_reward_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Récompense introuvable';
    END IF;

    IF v_program.type = 'stamps' THEN
      IF v_card.current_stamps < v_reward.cost_stamps THEN
        RAISE EXCEPTION 'Solde insuffisant (% / % tampons)', v_card.current_stamps, v_reward.cost_stamps;
      END IF;
      v_new_stamps := v_card.current_stamps - v_reward.cost_stamps;
      v_new_points := v_card.current_points;
    ELSE
      IF v_card.current_points < v_reward.cost_points THEN
        RAISE EXCEPTION 'Solde insuffisant (% / % points)', v_card.current_points, v_reward.cost_points;
      END IF;
      v_new_points := v_card.current_points - v_reward.cost_points;
      v_new_stamps := v_card.current_stamps;
    END IF;
  ELSE
    v_new_stamps := v_card.current_stamps + p_delta_stamps;
    v_new_points := v_card.current_points + p_delta_points;

    IF v_new_stamps < 0 OR v_new_points < 0 THEN
      RAISE EXCEPTION 'Solde négatif interdit';
    END IF;
  END IF;

  -- Recalcul de l'expiration si configurée dans le programme (Option 3B)
  IF v_program.inactivity_expiration_days IS NOT NULL THEN
    v_new_expires_at := now() + (v_program.inactivity_expiration_days || ' days')::INTERVAL;
  ELSE
    v_new_expires_at := NULL;
  END IF;

  -- 6. Insertion dans la table ledger immuable
  INSERT INTO loyalty_transactions (
    merchant_id,
    loyalty_card_id,
    location_id,
    operator_member_id,
    reward_id,
    transaction_type,
    delta_stamps,
    delta_points,
    previous_balance_stamps,
    new_balance_stamps,
    previous_balance_points,
    new_balance_points,
    purchase_amount_eur,
    idempotency_key,
    note
  ) VALUES (
    v_card.merchant_id,
    v_card.id,
    p_location_id,
    v_operator_id,
    p_reward_id,
    p_transaction_type,
    p_delta_stamps,
    p_delta_points,
    v_card.current_stamps,
    v_new_stamps,
    v_card.current_points,
    v_new_points,
    p_purchase_amount_eur,
    p_idempotency_key,
    p_note
  ) RETURNING id INTO v_transaction_id;

  -- 7. Mise à jour de la carte
  UPDATE loyalty_cards
  SET
    current_stamps = v_new_stamps,
    current_points = v_new_points,
    total_lifetime_stamps = total_lifetime_stamps + GREATEST(p_delta_stamps, 0),
    total_lifetime_points = total_lifetime_points + GREATEST(p_delta_points, 0),
    total_rewards_claimed = total_rewards_claimed + CASE WHEN p_transaction_type = 'reward_redemption' THEN 1 ELSE 0 END,
    total_visits = total_visits + CASE WHEN p_transaction_type IN ('stamp_credit', 'points_credit') THEN 1 ELSE 0 END,
    expires_at = v_new_expires_at,
    last_activity_at = now(),
    version = version + 1,
    updated_at = now()
  WHERE id = v_card.id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'previous_stamps', v_card.current_stamps,
    'new_stamps', v_new_stamps,
    'previous_points', v_card.current_points,
    'new_points', v_new_points
  );
END;
$$;

-- ==============================================================================
-- ACTIVATION RLS & POLITIQUES
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_member_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Exemples de politiques restrictives essentielles
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "merchants_select_members" ON merchants FOR SELECT
  USING (id IN (SELECT get_user_merchant_ids()));

CREATE POLICY "locations_select_staff" ON locations FOR SELECT
  USING (can_staff_access_location(id));

CREATE POLICY "customers_select_merchant" ON customers FOR SELECT
  USING (merchant_id IN (SELECT get_user_merchant_ids()));

CREATE POLICY "cards_select_merchant" ON loyalty_cards FOR SELECT
  USING (merchant_id IN (SELECT get_user_merchant_ids()));

-- Immutabilité stricte des transactions
CREATE POLICY "transactions_select_members" ON loyalty_transactions FOR SELECT
  USING (merchant_id IN (SELECT get_user_merchant_ids()));
-- Les INSERT direct sur loyalty_transactions sont bloqués ; seule execute_loyalty_transaction (SECURITY DEFINER) insère.
