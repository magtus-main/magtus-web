-- ==============================================================================
-- Migration: Add Soft Delete Flag (is_deleted) to Products Table
-- Description:
--   1. Adds is_deleted column to public.products with default FALSE.
--   2. Adds an index on is_deleted for query performance.
-- ==============================================================================

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON public.products (is_deleted);
