-- ==============================================================================
-- KOLLEKT - MIGRATION 04 : ENRÔLEMENT PUBLIC CLIENT & SÉCURISATION RGPD
-- ==============================================================================

-- 1. ADAPTATION DE LA TABLE CUSTOMERS (Minimisation RGPD & Flexibilité contact)
ALTER TABLE customers
ALTER COLUMN last_name DROP NOT NULL,
ALTER COLUMN phone DROP NOT NULL,
ALTER COLUMN phone_normalized DROP NOT NULL,
ALTER COLUMN optin_marketing SET DEFAULT false;

ALTER TABLE customers
ADD COLUMN IF NOT EXISTS email_normalized TEXT;

-- Suppression de l'ancienne contrainte unique stricte sur phone
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS uq_customers_merchant_phone;

-- Index partiels conditionnels sur téléphone et email par merchant
DROP INDEX IF EXISTS idx_customers_merchant_phone;
CREATE UNIQUE INDEX idx_customers_merchant_phone 
ON customers(merchant_id, phone_normalized) 
WHERE phone_normalized IS NOT NULL;

DROP INDEX IF EXISTS idx_customers_merchant_email;
CREATE UNIQUE INDEX idx_customers_merchant_email 
ON customers(merchant_id, email_normalized) 
WHERE email_normalized IS NOT NULL;

-- 2. FONCTION RPC SÉCURISÉE : LECTURE DU PROGRAMME PUBLIC
CREATE OR REPLACE FUNCTION get_public_merchant_program(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant RECORD;
  v_program RECORD;
  v_reward RECORD;
BEGIN
  -- Récupérer le commerçant par son slug opaque
  SELECT id, name, slug, logo_url, currency
  INTO v_merchant
  FROM merchants
  WHERE slug = p_slug;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'message', 'Commerce introuvable');
  END IF;

  -- Récupérer son programme actif mutualisé
  SELECT id, name, type, max_stamps, points_ratio, reward_threshold_points,
         primary_color, accent_color, stamp_icon, back_notice, is_active
  INTO v_program
  FROM loyalty_programs
  WHERE merchant_id = v_merchant.id AND location_id IS NULL;

  IF NOT FOUND OR NOT v_program.is_active THEN
    RETURN jsonb_build_object(
      'found', true,
      'is_active', false,
      'merchant_name', v_merchant.name,
      'merchant_slug', v_merchant.slug,
      'logo_url', v_merchant.logo_url,
      'message', 'Ce programme de fidélité n’est pas encore actif.'
    );
  END IF;

  -- Récupérer la récompense principale
  SELECT title, description, cost_stamps, cost_points
  INTO v_reward
  FROM loyalty_rewards
  WHERE loyalty_program_id = v_program.id AND is_active = true
  LIMIT 1;

  RETURN jsonb_build_object(
    'found', true,
    'is_active', true,
    'merchant_id', v_merchant.id,
    'merchant_name', v_merchant.name,
    'merchant_slug', v_merchant.slug,
    'logo_url', v_merchant.logo_url,
    'currency', v_merchant.currency,
    'program_name', v_program.name,
    'program_type', v_program.type,
    'max_stamps', v_program.max_stamps,
    'reward_threshold_points', v_program.reward_threshold_points,
    'primary_color', v_program.primary_color,
    'stamp_icon', v_program.stamp_icon,
    'back_notice', v_program.back_notice,
    'reward_title', COALESCE(v_reward.title, 'Récompense fidélité')
  );
END;
$$;

-- 3. FONCTION RPC SÉCURISÉE : ENRÔLEMENT OU DÉDUPLICATION ATOMIQUE
CREATE OR REPLACE FUNCTION enroll_or_retrieve_public_card(
  p_merchant_slug TEXT,
  p_first_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_optin_marketing BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant RECORD;
  v_program RECORD;
  v_reward RECORD;
  v_customer_id UUID;
  v_card RECORD;
  v_phone_norm TEXT := NULL;
  v_email_norm TEXT := NULL;
  v_is_existing BOOLEAN := false;
  v_pass_code TEXT;
  v_qr_token TEXT;
  v_welcome_stamps INT := 0;
  v_welcome_points INT := 0;
BEGIN
  -- 1. Résolution du merchant
  SELECT id, name INTO v_merchant FROM merchants WHERE slug = p_merchant_slug;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commerce introuvable';
  END IF;

  -- 2. Résolution du programme actif
  SELECT id, type, max_stamps, reward_threshold_points, welcome_bonus, is_active
  INTO v_program
  FROM loyalty_programs
  WHERE merchant_id = v_merchant.id AND location_id IS NULL;

  IF NOT FOUND OR NOT v_program.is_active THEN
    RAISE EXCEPTION 'Le programme de fidélité n’est pas actif';
  END IF;

  -- Normalisation
  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_phone_norm := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  END IF;
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_email_norm := lower(trim(p_email));
  END IF;

  IF v_phone_norm IS NULL AND v_email_norm IS NULL THEN
    RAISE EXCEPTION 'Au moins un moyen de contact (téléphone ou email) est requis';
  END IF;

  -- 3. Recherche client existant pour CE merchant uniquement (Isolation stricte)
  SELECT id INTO v_customer_id
  FROM customers
  WHERE merchant_id = v_merchant.id
    AND (
      (v_phone_norm IS NOT NULL AND phone_normalized = v_phone_norm)
      OR (v_email_norm IS NOT NULL AND email_normalized = v_email_norm)
    )
  LIMIT 1;

  IF v_customer_id IS NOT NULL THEN
    v_is_existing := true;
  ELSE
    -- Création du nouveau client
    INSERT INTO customers (
      merchant_id,
      first_name,
      phone,
      phone_normalized,
      email,
      email_normalized,
      optin_marketing
    ) VALUES (
      v_merchant.id,
      trim(p_first_name),
      p_phone,
      v_phone_norm,
      p_email,
      v_email_norm,
      COALESCE(p_optin_marketing, false)
    ) RETURNING id INTO v_customer_id;
  END IF;

  -- 4. Recherche ou création de la carte de fidélité
  SELECT * INTO v_card
  FROM loyalty_cards
  WHERE loyalty_program_id = v_program.id AND customer_id = v_customer_id;

  IF NOT FOUND THEN
    v_pass_code := 'KOL-' || floor(10000 + random() * 90000)::text;
    v_qr_token := encode(gen_random_bytes(16), 'hex');
    
    IF v_program.type = 'stamps' THEN
      v_welcome_stamps := COALESCE(v_program.welcome_bonus, 1);
    ELSE
      v_welcome_points := COALESCE(v_program.welcome_bonus, 10);
    END IF;

    INSERT INTO loyalty_cards (
      merchant_id,
      loyalty_program_id,
      customer_id,
      qr_token,
      pass_code,
      current_stamps,
      current_points,
      total_lifetime_stamps,
      total_lifetime_points,
      total_visits
    ) VALUES (
      v_merchant.id,
      v_program.id,
      v_customer_id,
      v_qr_token,
      v_pass_code,
      v_welcome_stamps,
      v_welcome_points,
      v_welcome_stamps,
      v_welcome_points,
      1
    ) RETURNING * INTO v_card;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_existing', v_is_existing,
    'card_id', v_card.id,
    'qr_token', v_card.qr_token,
    'pass_code', v_card.pass_code,
    'current_stamps', v_card.current_stamps,
    'current_points', v_card.current_points,
    'first_name', trim(p_first_name)
  );
END;
$$;
