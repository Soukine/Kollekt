-- ==============================================================================
-- KOLLEKT - MIGRATION 03 : AJUSTEMENT CONTRAINTES PROGRAMMES DE FIDÉLITÉ
-- Permet un nombre d'objectifs (tampons / points) entre 1 et 100
-- ==============================================================================

-- Assouplissement de la contrainte max_stamps pour supporter 1 à 100
ALTER TABLE loyalty_programs
DROP CONSTRAINT IF EXISTS loyalty_programs_max_stamps_check;

ALTER TABLE loyalty_programs
ADD CONSTRAINT loyalty_programs_max_stamps_check
CHECK (type != 'stamps' OR (max_stamps IS NOT NULL AND max_stamps BETWEEN 1 AND 100));

ALTER TABLE loyalty_programs
DROP CONSTRAINT IF EXISTS loyalty_programs_reward_threshold_points_check;

ALTER TABLE loyalty_programs
ADD CONSTRAINT loyalty_programs_reward_threshold_points_check
CHECK (type != 'points' OR (reward_threshold_points IS NOT NULL AND reward_threshold_points BETWEEN 1 AND 10000));
