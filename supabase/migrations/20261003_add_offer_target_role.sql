-- ==============================================================================
-- Migration: Add target_role (audience) and carousel_image_url to offers
-- Description:
--   1. Adds `target_role` ('all', 'dealer', 'carpenter') to differentiate offer audience.
--   2. Keeps `target` (enum offer_target) in sync safely using explicit casts.
--   3. Adds `carousel_image_url` for mobile app home carousel banners.
-- ==============================================================================

-- 1. Add target_role and carousel_image_url columns safely
ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS target_role VARCHAR(50) DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS carousel_image_url TEXT DEFAULT NULL;

-- 2. Backfill existing offers with default values (cast target::text to prevent enum mismatch)
UPDATE public.offers 
SET 
  target_role = COALESCE(target_role, target::text, 'all'),
  target = COALESCE(target, 'all'),
  carousel_image_url = COALESCE(carousel_image_url, banner_url)
WHERE target_role IS NULL OR target IS NULL;

-- 3. Add Indexes for quick role-based filtering in mobile app & web admin
CREATE INDEX IF NOT EXISTS idx_offers_target_role 
  ON public.offers (target_role);

CREATE INDEX IF NOT EXISTS idx_offers_target 
  ON public.offers (target);

-- 4. Sync trigger: Keep target and target_role synchronized automatically
CREATE OR REPLACE FUNCTION public.sync_offer_target_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync target -> target_role
  IF NEW.target IS NOT NULL AND (NEW.target_role IS NULL OR NEW.target_role = '') THEN
    NEW.target_role = NEW.target::text;
  END IF;

  -- Sync target_role -> target (safely handle offer_target enum)
  IF NEW.target_role IS NOT NULL AND NEW.target IS NULL THEN
    BEGIN
      NEW.target = NEW.target_role::text::offer_target;
    EXCEPTION WHEN OTHERS THEN
      NEW.target = 'all';
    END;
  END IF;

  -- Sync carousel_image_url <-> banner_url
  IF NEW.carousel_image_url IS NOT NULL AND (NEW.banner_url IS NULL OR NEW.banner_url = '') THEN
    NEW.banner_url = NEW.carousel_image_url;
  ELSIF NEW.banner_url IS NOT NULL AND (NEW.carousel_image_url IS NULL OR NEW.carousel_image_url = '') THEN
    NEW.carousel_image_url = NEW.banner_url;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_offer_target ON public.offers;
CREATE TRIGGER tr_sync_offer_target
  BEFORE INSERT OR UPDATE ON public.offers 
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_offer_target_columns();

-- 5. STORAGE BUCKET: Ensure 'offers' or public bucket allows offer banner uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('offers', 'offers', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for offers bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read offers' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow public read offers"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'offers');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated upload offers' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Allow authenticated upload offers"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'offers');
  END IF;
END $$;

