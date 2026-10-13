-- ==============================================================================
-- KOLLEKT - MIGRATION 02 : ONBOARDING COMMERÇANT & STORAGE LOGOS
-- ==============================================================================

-- 1. NOUVEAU TYPE BUSINESS_TYPE
DO $$ BEGIN
  CREATE TYPE business_type AS ENUM (
    'food_truck',
    'restaurant',
    'cafe',
    'snack',
    'local_shop',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. AJOUT DES COLONNES ONBOARDING SUR MERCHANTS
ALTER TABLE merchants
ADD COLUMN IF NOT EXISTS business_type business_type DEFAULT 'restaurant',
ADD COLUMN IF NOT EXISTS onboarding_step INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

-- 3. TRIGGER AUTOMATIQUE DE CRÉATION DE PROFIL À L'INSCRIPTION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. BUCKET SUPABASE STORAGE POUR LES LOGOS COMMERÇANTS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merchant-logos',
  'merchant-logos',
  true,
  2097152, -- 2 Mo max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- Politiques RLS Storage
CREATE POLICY "Public read for merchant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'merchant-logos');

CREATE POLICY "Merchant members can upload logos to their folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'merchant-logos'
  AND (storage.foldername(name))[1] IN (SELECT get_user_merchant_ids()::text)
);

CREATE POLICY "Merchant members can update/delete their logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'merchant-logos'
  AND (storage.foldername(name))[1] IN (SELECT get_user_merchant_ids()::text)
);
