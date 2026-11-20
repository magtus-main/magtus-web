-- ==============================================================================
-- Migration: Add PAN verification fields to profiles
-- Replaces Aadhaar with PAN + Bank verification for carpenters
-- ==============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pan_number text,
ADD COLUMN IF NOT EXISTS pan_verified boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS pan_data text;

-- Index for searching/auditing PAN
CREATE INDEX IF NOT EXISTS idx_profiles_pan_number ON public.profiles (pan_number);
CREATE INDEX IF NOT EXISTS idx_profiles_pan_verified ON public.profiles (pan_verified);

COMMENT ON COLUMN public.profiles.pan_number IS '10-character PAN number of verified carpenter';
COMMENT ON COLUMN public.profiles.pan_verified IS 'Whether PAN has been verified via Sandbox API';
COMMENT ON COLUMN public.profiles.pan_data IS 'Symmetrically encrypted PAN verification response details';
