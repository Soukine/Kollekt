-- ==============================================================================
-- KOLLEKT - MIGRATION 7 : INDEX STRATÉGIQUES POUR DASHBOARD COMMERÇANT
-- Optimisation des requêtes d'agrégation, métriques temporelles et filtrage
-- ==============================================================================

-- 1. Index composite haute performance pour les agrégations de dashboard par commerçant, date et type de transaction
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_dashboard 
  ON loyalty_transactions(merchant_id, created_at DESC, transaction_type);

-- 2. Index pour le filtrage par établissement et période
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_location_period 
  ON loyalty_transactions(merchant_id, location_id, created_at DESC) 
  WHERE location_id IS NOT NULL;

-- 3. Index pour le comptage rapide des nouvelles cartes créées par période
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_merchant_created 
  ON loyalty_cards(merchant_id, created_at DESC);

-- 4. Index pour le suivi des parrainages par période
CREATE INDEX IF NOT EXISTS idx_referrals_merchant_period 
  ON referrals(merchant_id, status, created_at DESC);
