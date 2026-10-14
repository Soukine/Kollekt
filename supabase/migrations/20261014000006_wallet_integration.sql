-- ==============================================================================
-- KOLLEKT - MIGRATION 06 : INTÉGRATION WALLETWALLET & GESTION DES PASSES
-- ==============================================================================

-- 1. Création du type sync_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_sync_status') THEN
    CREATE TYPE wallet_sync_status AS ENUM ('pending', 'synced', 'failed', 'retrying');
  END IF;
END$$;

-- 2. Enrichissement de la table wallet_passes
ALTER TABLE wallet_passes
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'walletwallet',
  ADD COLUMN IF NOT EXISTS provider_pass_id TEXT,
  ADD COLUMN IF NOT EXISTS apple_pass_url TEXT,
  ADD COLUMN IF NOT EXISTS google_wallet_url TEXT,
  ADD COLUMN IF NOT EXISTS universal_install_url TEXT,
  ADD COLUMN IF NOT EXISTS sync_status wallet_sync_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snapshot_payload JSONB;

-- 3. Contrainte d'unicité stricte sur loyalty_card_id pour éviter tout doublon
ALTER TABLE wallet_passes
  DROP CONSTRAINT IF EXISTS uq_wallet_passes_card_unique;

ALTER TABLE wallet_passes
  ADD CONSTRAINT uq_wallet_passes_card_unique UNIQUE (loyalty_card_id);

-- 4. Index de performance
CREATE INDEX IF NOT EXISTS idx_wallet_passes_card_id ON wallet_passes(loyalty_card_id);
CREATE INDEX IF NOT EXISTS idx_wallet_passes_sync_status ON wallet_passes(sync_status) WHERE sync_status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_wallet_passes_provider_id ON wallet_passes(provider_pass_id) WHERE provider_pass_id IS NOT NULL;

-- 5. RLS policies pour wallet_passes
ALTER TABLE wallet_passes ENABLE ROW LEVEL SECURITY;

-- Les membres du commerce peuvent consulter les passes de leur organisation
DROP POLICY IF EXISTS "merchant_members_read_wallet_passes" ON wallet_passes;
CREATE POLICY "merchant_members_read_wallet_passes"
ON wallet_passes FOR SELECT
TO authenticated
USING (
  merchant_id IN (
    SELECT merchant_id FROM merchant_members WHERE profile_id = auth.uid() AND is_active = true
  )
);

-- Le service backend (service_role ou fonctions SECURITY DEFINER) peut insérer/mettre à jour
DROP POLICY IF EXISTS "service_role_all_wallet_passes" ON wallet_passes;
CREATE POLICY "service_role_all_wallet_passes"
ON wallet_passes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
