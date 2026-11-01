-- ==============================================================================
-- Migration: App Configuration & Remote Version Enforcement
-- Used by Mobile App to check version, enforce updates & maintenance mode
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.app_config (
  id VARCHAR(50) PRIMARY KEY,                         -- 'android' or 'ios'
  min_version_code INTEGER NOT NULL DEFAULT 1,         -- Minimum allowed versionCode (below this = FORCE UPDATE)
  latest_version_code INTEGER NOT NULL DEFAULT 1,      -- Latest available versionCode (below this = SOFT UPDATE)
  min_version_name VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  latest_version_name VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  update_title VARCHAR(150) DEFAULT 'App Update Available',
  update_message TEXT DEFAULT 'A new version of Magtus is available with important updates and bug fixes. Please update to continue enjoying the app.',
  play_store_url TEXT DEFAULT 'market://details?id=com.magtus.self',
  app_store_url TEXT,
  force_update BOOLEAN DEFAULT FALSE,                  -- Global emergency force-update switch
  is_maintenance BOOLEAN DEFAULT FALSE,                -- Maintenance mode switch
  maintenance_message TEXT DEFAULT 'Magtus is currently under scheduled maintenance. Please check back shortly.',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access (any app can check version on launch without logging in)
DROP POLICY IF EXISTS "Allow public read access to app_config" ON public.app_config;
CREATE POLICY "Allow public read access to app_config"
  ON public.app_config
  FOR SELECT
  USING (true);

-- Allow admins to update version config
DROP POLICY IF EXISTS "Allow admin to update app_config" ON public.app_config;
CREATE POLICY "Allow admin to update app_config"
  ON public.app_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert default row for Android
INSERT INTO public.app_config (
  id,
  min_version_code,
  latest_version_code,
  min_version_name,
  latest_version_name,
  update_title,
  update_message,
  play_store_url
) VALUES (
  'android',
  1,
  1,
  '1.0.0',
  '1.0.0',
  'App Update Available',
  'A new version of Magtus is available with important updates and bug fixes. Please update to continue enjoying the app.',
  'market://details?id=com.magtus.self'
)
ON CONFLICT (id) DO NOTHING;

