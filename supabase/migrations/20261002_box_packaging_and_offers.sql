-- ==============================================================================
-- Migration: Box Packaging & Promotional Offers Engine (Self-Healing / Safe)
-- Description:
--   1. Ensures `offers` table exists and adds any missing columns safely.
--   2. Adds packaging & discount tracking columns to `order_items` safely with defaults.
--   3. Sets up RLS (Row Level Security) and indexes.
-- ==============================================================================

-- 1. ENSURE OFFERS TABLE AND ALL REQUIRED COLUMNS EXIST
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Safely add columns if they do not exist already
ALTER TABLE public.offers 
  ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS offer_type VARCHAR(50) DEFAULT 'tiered_discount',
  ADD COLUMN IF NOT EXISTS target_type VARCHAR(50) DEFAULT 'all_products',
  ADD COLUMN IF NOT EXISTS target_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicable_unit VARCHAR(20) DEFAULT 'box',
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_stackable BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure legacy columns do not have blocking NOT NULL constraints
DO $$ 
DECLARE
  rec RECORD;
BEGIN
  -- 1. Specifically ensure offer_type and value are nullable and have defaults
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'offer_type'
  ) THEN
    ALTER TABLE public.offers ALTER COLUMN offer_type DROP NOT NULL;
    ALTER TABLE public.offers ALTER COLUMN offer_type SET DEFAULT 'tiered_discount';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'value'
  ) THEN
    ALTER TABLE public.offers ALTER COLUMN value DROP NOT NULL;
    ALTER TABLE public.offers ALTER COLUMN value SET DEFAULT 0;
  END IF;

  -- 2. Ensure starts_at and ends_at are nullable and have defaults
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'starts_at'
  ) THEN
    ALTER TABLE public.offers ALTER COLUMN starts_at DROP NOT NULL;
    ALTER TABLE public.offers ALTER COLUMN starts_at SET DEFAULT now();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'ends_at'
  ) THEN
    ALTER TABLE public.offers ALTER COLUMN ends_at DROP NOT NULL;
    ALTER TABLE public.offers ALTER COLUMN ends_at SET DEFAULT (now() + interval '30 days');
  END IF;

  -- 3. Ensure usage_limit and used_count are nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'usage_limit'
  ) THEN
    ALTER TABLE public.offers ALTER COLUMN usage_limit DROP NOT NULL;
    ALTER TABLE public.offers ALTER COLUMN usage_limit SET DEFAULT 0;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'offers' AND column_name = 'used_count'
  ) THEN
    ALTER TABLE public.offers ALTER COLUMN used_count DROP NOT NULL;
    ALTER TABLE public.offers ALTER COLUMN used_count SET DEFAULT 0;
  END IF;

  -- 4. Drop NOT NULL on any remaining legacy non-id columns lacking defaults
  FOR rec IN 
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'offers' 
      AND is_nullable = 'NO' 
      AND column_default IS NULL 
      AND column_name NOT IN ('id')
  LOOP
    EXECUTE format('ALTER TABLE public.offers ALTER COLUMN %I DROP NOT NULL;', rec.column_name);
  END LOOP;

  -- 5. Backfill nulls
  UPDATE public.offers SET offer_type = 'tiered_discount' WHERE offer_type IS NULL;
  UPDATE public.offers SET value = 0 WHERE value IS NULL;
  UPDATE public.offers SET starts_at = start_date WHERE starts_at IS NULL AND start_date IS NOT NULL;
  UPDATE public.offers SET ends_at = end_date WHERE ends_at IS NULL AND end_date IS NOT NULL;
END $$;

-- 2. CREATE INDEXES ON OFFERS
CREATE INDEX IF NOT EXISTS idx_offers_active_dates 
  ON public.offers (is_active, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_offers_applicable_unit 
  ON public.offers (applicable_unit);

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.handle_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_offers_updated_at ON public.offers;
CREATE TRIGGER tr_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_offers_updated_at();

-- 3. ENHANCE ORDER_ITEMS TABLE (NON-BREAKING ALTERATIONS)
ALTER TABLE public.order_items 
  ADD COLUMN IF NOT EXISTS ordered_unit VARCHAR(20) DEFAULT 'piece',
  ADD COLUMN IF NOT EXISTS pcs_per_box INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_pcs INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_offer_details JSONB DEFAULT NULL;

-- Backfill existing order_items so historical records remain consistent
UPDATE public.order_items
SET 
  ordered_unit = COALESCE(ordered_unit, 'piece'),
  pcs_per_box = COALESCE(pcs_per_box, 1),
  total_pcs = COALESCE(total_pcs, quantity),
  discount_percentage = COALESCE(discount_percentage, 0),
  discount_amount = COALESCE(discount_amount, 0)
WHERE ordered_unit IS NULL OR total_pcs IS NULL;

-- 4. ROW LEVEL SECURITY (RLS) FOR OFFERS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (Dealers, Staff, Admins) to read active offers
DROP POLICY IF EXISTS "Allow authenticated read offers" ON public.offers;
CREATE POLICY "Allow authenticated read offers" 
  ON public.offers FOR SELECT TO authenticated USING (true);

-- Allow staff and admins to manage offers
DROP POLICY IF EXISTS "Allow staff to insert offers" ON public.offers;
CREATE POLICY "Allow staff to insert offers" 
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'member'))
  );

DROP POLICY IF EXISTS "Allow staff to update offers" ON public.offers;
CREATE POLICY "Allow staff to update offers" 
  ON public.offers FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'member'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'member'))
  );

DROP POLICY IF EXISTS "Allow staff to delete offers" ON public.offers;
CREATE POLICY "Allow staff to delete offers" 
  ON public.offers FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND (profiles.role = 'admin' OR profiles.role = 'member'))
  );
