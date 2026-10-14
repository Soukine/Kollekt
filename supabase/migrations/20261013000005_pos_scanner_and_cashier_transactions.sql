-- ==============================================================================
-- KOLLEKT - MIGRATION 5 : SCANNER CAISSE, SÉCURITÉ TRANSACTIONS & MULTI-TENANT
-- ==============================================================================

-- 1. FONCTION DE RECHERCHE ET VALIDATION DE SCAN CLIENT EN CAISSE
CREATE OR REPLACE FUNCTION lookup_customer_by_scan(
  p_identifier TEXT,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operator RECORD;
  v_clean_identifier TEXT;
  v_card RECORD;
  v_customer RECORD;
  v_program RECORD;
  v_reward RECORD;
  v_is_eligible BOOLEAN := false;
BEGIN
  -- Nettoyage de l'identifiant (retire URL, query params, hash ou espaces)
  v_clean_identifier := trim(p_identifier);
  
  -- Extraction de token si URL passée
  IF v_clean_identifier LIKE '%token=%' THEN
    v_clean_identifier := substring(v_clean_identifier from 'token=([^&#]+)');
  ELSIF v_clean_identifier LIKE '%/c/%' THEN
    -- URL publique ou pass ID en fin d'URL
    v_clean_identifier := regexp_replace(v_clean_identifier, '^.*/c/', '');
    v_clean_identifier := split_part(v_clean_identifier, '?', 1);
  END IF;

  -- Identification de l'opérateur caisse
  SELECT mm.id, mm.merchant_id, mm.role INTO v_operator
  FROM merchant_members mm
  WHERE mm.profile_id = auth.uid() AND mm.is_active = true;

  IF v_operator.id IS NULL THEN
    RAISE EXCEPTION 'Opérateur de caisse non authentifié ou inactif';
  END IF;

  -- Vérification d'accès à l'établissement si location_id fourni
  IF p_location_id IS NOT NULL AND NOT can_staff_access_location(p_location_id) THEN
    RAISE EXCEPTION 'Accès refusé pour cet établissement';
  END IF;

  -- Recherche de la carte dans toute la base (pour détecter les cartes d'autres commerces)
  SELECT lc.* INTO v_card
  FROM loyalty_cards lc
  LEFT JOIN customers c ON c.id = lc.customer_id
  WHERE lc.qr_token = v_clean_identifier
     OR upper(lc.pass_code) = upper(v_clean_identifier)
     OR c.phone = v_clean_identifier
     OR c.phone_normalized = v_clean_identifier
     OR lower(c.email) = lower(v_clean_identifier)
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune carte trouvée pour cet identifiant (%s)', v_clean_identifier;
  END IF;

  -- CONTRÔLE D'ISOLATION MULTI-TENANT STRICT
  IF v_card.merchant_id != v_operator.merchant_id THEN
    RAISE EXCEPTION 'Carte invalide pour cet établissement : ce client appartient à un autre commerce.';
  END IF;

  -- Récupération du client
  SELECT * INTO v_customer FROM customers WHERE id = v_card.customer_id;

  -- Récupération du programme
  SELECT * INTO v_program FROM loyalty_programs WHERE id = v_card.loyalty_program_id;

  -- Récupération de la récompense principale active
  SELECT * INTO v_reward 
  FROM loyalty_rewards 
  WHERE loyalty_program_id = v_card.loyalty_program_id AND is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1;

  -- Éligibilité à la récompense
  IF v_reward.id IS NOT NULL THEN
    IF v_program.type = 'stamps' THEN
      v_is_eligible := v_card.current_stamps >= coalesce(v_reward.cost_stamps, v_program.max_stamps);
    ELSE
      v_is_eligible := v_card.current_points >= coalesce(v_reward.cost_points, v_program.reward_threshold_points);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card_id', v_card.id,
    'customer_id', v_customer.id,
    'first_name', v_customer.first_name,
    'last_name', v_customer.last_name,
    'phone', v_customer.phone,
    'email', v_customer.email,
    'pass_code', v_card.pass_code,
    'qr_token', v_card.qr_token,
    'current_stamps', v_card.current_stamps,
    'current_points', v_card.current_points,
    'program_type', v_program.type,
    'max_stamps', v_program.max_stamps,
    'reward_threshold_points', v_program.reward_threshold_points,
    'reward_title', coalesce(v_reward.title, 'Récompense fidélité'),
    'reward_id', v_reward.id,
    'is_reward_ready', v_is_eligible,
    'total_visits', v_card.total_visits,
    'total_rewards_claimed', v_card.total_rewards_claimed
  );
END;
$$;

-- 2. ENRICHISSEMENT DE LA FONCTION ATOMIQUE D'EXÉCUTION DE TRANSACTION
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
  v_operator RECORD;
  v_new_stamps INT;
  v_new_points INT;
  v_reward RECORD;
  v_transaction_id UUID;
  v_new_expires_at TIMESTAMPTZ;
  v_clean_identifier TEXT;
BEGIN
  -- Nettoyage de l'identifiant
  v_clean_identifier := trim(p_qr_token);
  IF v_clean_identifier LIKE '%token=%' THEN
    v_clean_identifier := substring(v_clean_identifier from 'token=([^&#]+)');
  END IF;

  -- 1. Résolution et autorisation de l'opérateur caisse
  SELECT mm.id, mm.merchant_id, mm.role INTO v_operator
  FROM merchant_members mm
  WHERE mm.profile_id = auth.uid() AND mm.is_active = true;

  IF v_operator.id IS NULL THEN
    RAISE EXCEPTION 'Opérateur non authentifié ou inactif';
  END IF;

  IF p_location_id IS NOT NULL AND NOT can_staff_access_location(p_location_id) THEN
    RAISE EXCEPTION 'Accès refusé pour cet établissement';
  END IF;

  -- 2. Verrouillage de la carte client (ROW LOCK) pour éliminer les doubles scans simultanés
  SELECT * INTO v_card
  FROM loyalty_cards
  WHERE qr_token = v_clean_identifier OR upper(pass_code) = upper(v_clean_identifier)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carte de fidélité introuvable (%s)', v_clean_identifier;
  END IF;

  -- 3. Vérification de l'isolation du commerce
  IF v_card.merchant_id != v_operator.merchant_id THEN
    RAISE EXCEPTION 'Carte invalide pour cet établissement : ce client appartient à un autre commerce.';
  END IF;

  -- 4. Vérification d'idempotence stricte (anti double-clic et double scan)
  IF EXISTS (
    SELECT 1 FROM loyalty_transactions
    WHERE loyalty_card_id = v_card.id
      AND idempotency_key = p_idempotency_key
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'message', 'Opération déjà enregistrée (protection anti-double-clic / idempotence)',
      'current_stamps', v_card.current_stamps,
      'current_points', v_card.current_points
    );
  END IF;

  -- 5. Règle métier : motif obligatoire pour tout débit ou ajustement manuel
  IF p_transaction_type IN ('stamp_debit', 'points_debit', 'manual_adjustment') 
     OR (p_delta_stamps < 0) 
     OR (p_delta_points < 0) THEN
    IF p_note IS NULL OR length(trim(p_note)) < 3 THEN
      RAISE EXCEPTION 'Un motif justificatif explicite (minimum 3 caractères) est obligatoire pour tout retrait ou correction de solde.';
    END IF;
  END IF;

  -- 6. Programme de fidélité associé
  SELECT * INTO v_program
  FROM loyalty_programs
  WHERE id = v_card.loyalty_program_id;

  -- 7. Calcul des soldes selon la transaction
  IF p_transaction_type = 'reward_redemption' THEN
    SELECT * INTO v_reward FROM loyalty_rewards WHERE id = p_reward_id;
    IF NOT FOUND THEN
      -- Fallback sur la récompense par défaut du programme si ID manquant
      SELECT * INTO v_reward FROM loyalty_rewards WHERE loyalty_program_id = v_card.loyalty_program_id AND is_active = true LIMIT 1;
    END IF;

    IF v_reward.id IS NULL THEN
      RAISE EXCEPTION 'Aucune récompense configurée pour ce programme.';
    END IF;

    IF v_program.type = 'stamps' THEN
      IF v_card.current_stamps < coalesce(v_reward.cost_stamps, v_program.max_stamps) THEN
        RAISE EXCEPTION 'Solde insuffisant (% / % tampons)', v_card.current_stamps, coalesce(v_reward.cost_stamps, v_program.max_stamps);
      END IF;
      v_new_stamps := v_card.current_stamps - coalesce(v_reward.cost_stamps, v_program.max_stamps);
      v_new_points := v_card.current_points;
    ELSE
      IF v_card.current_points < coalesce(v_reward.cost_points, v_program.reward_threshold_points) THEN
        RAISE EXCEPTION 'Solde insuffisant (% / % points)', v_card.current_points, coalesce(v_reward.cost_points, v_program.reward_threshold_points);
      END IF;
      v_new_points := v_card.current_points - coalesce(v_reward.cost_points, v_program.reward_threshold_points);
      v_new_stamps := v_card.current_stamps;
    END IF;
  ELSE
    v_new_stamps := v_card.current_stamps + coalesce(p_delta_stamps, 0);
    v_new_points := v_card.current_points + coalesce(p_delta_points, 0);

    IF v_new_stamps < 0 OR v_new_points < 0 THEN
      RAISE EXCEPTION 'Solde négatif interdit. Solde actuel : %s tampons / %s points.', v_card.current_stamps, v_card.current_points;
    END IF;
  END IF;

  -- Recalcul de l'expiration si configurée
  IF v_program.inactivity_expiration_days IS NOT NULL THEN
    v_new_expires_at := now() + (v_program.inactivity_expiration_days || ' days')::INTERVAL;
  ELSE
    v_new_expires_at := NULL;
  END IF;

  -- 8. Insertion dans le ledger immuable
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
    v_operator.id,
    p_reward_id,
    p_transaction_type,
    coalesce(p_delta_stamps, 0),
    coalesce(p_delta_points, 0),
    v_card.current_stamps,
    v_new_stamps,
    v_card.current_points,
    v_new_points,
    p_purchase_amount_eur,
    p_idempotency_key,
    p_note
  ) RETURNING id INTO v_transaction_id;

  -- 9. Mise à jour de la carte
  UPDATE loyalty_cards
  SET
    current_stamps = v_new_stamps,
    current_points = v_new_points,
    total_lifetime_stamps = total_lifetime_stamps + GREATEST(coalesce(p_delta_stamps, 0), 0),
    total_lifetime_points = total_lifetime_points + GREATEST(coalesce(p_delta_points, 0), 0),
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
    'new_points', v_new_points,
    'reward_claimed', p_transaction_type = 'reward_redemption'
  );
END;
$$;
