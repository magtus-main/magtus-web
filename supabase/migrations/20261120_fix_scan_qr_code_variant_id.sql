-- ==============================================================================
-- Migration: Fix scan_qr_code 'v_qr has no field variant_id' & 'invalid input value for enum offer_type'
-- 1. Ensure qr_codes table has variant_id column (backward & forward compatibility)
-- 2. Convert offers.offer_type to VARCHAR(50) to allow all types (multiplier, bonus_points, milestone_points)
-- 3. Update scan_qr_code RPC to safely compare offer_type as text (offer_type::text)
--    and calculate base points via stored points, SKU priceMatrix, or product default.
-- ==============================================================================

-- 1. Ensure variant_id exists on qr_codes
ALTER TABLE public.qr_codes
  ADD COLUMN IF NOT EXISTS variant_id TEXT DEFAULT NULL;

-- 2. Safely alter offers.offer_type to VARCHAR(50) and extend enum if present
DO $$
BEGIN
  -- If offer_type column is an enum, convert it to VARCHAR(50)
  BEGIN
    ALTER TABLE public.offers ALTER COLUMN offer_type TYPE VARCHAR(50) USING offer_type::text;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Also add enum values in case enum type is still referenced
  BEGIN
    ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'multiplier';
    ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'bonus_points';
    ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'milestone_points';
    ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'free_gift';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- 3. Recreate scan_qr_code RPC
CREATE OR REPLACE FUNCTION scan_qr_code(
  p_qr_code TEXT,
  p_carpenter_id UUID,
  p_location JSONB DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_qr RECORD;
  v_carpenter RECORD;
  v_product RECORD;
  v_base_points INTEGER;
  v_final_points INTEGER;
  v_new_balance INTEGER;
  v_offer RECORD;
  v_multiplier DECIMAL DEFAULT 1;
  v_bonus INTEGER DEFAULT 0;
  v_scan_count INTEGER;
  v_max_scans INTEGER;
  v_cooldown INTEGER;
  v_last_scan TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_month_pts_before INTEGER := 0;
  v_milestone_offer RECORD;
  v_milestone_bonus INTEGER := 0;
  v_applied_offer_title TEXT := NULL;
BEGIN
  -- 1. Rate limit: max scans per day
  SELECT (value #>> '{}')::INTEGER INTO v_max_scans
  FROM app_settings WHERE key = 'max_scans_per_day';
  v_max_scans := COALESCE(v_max_scans, 50);

  SELECT COUNT(*) INTO v_scan_count
  FROM qr_scan_attempts
  WHERE scanned_by = p_carpenter_id
    AND success = TRUE
    AND created_at >= CURRENT_DATE;

  IF v_scan_count >= v_max_scans THEN
    INSERT INTO qr_scan_attempts (qr_code, scanned_by, success, failure_reason, location, device_info)
    VALUES (p_qr_code, p_carpenter_id, FALSE, 'daily_limit', p_location, p_device_info);
    RETURN jsonb_build_object('success', false, 'error', 'Daily scan limit reached');
  END IF;

  -- 2. Cooldown check
  SELECT (value #>> '{}')::INTEGER INTO v_cooldown
  FROM app_settings WHERE key = 'scan_cooldown_seconds';
  v_cooldown := COALESCE(v_cooldown, 30);

  SELECT MAX(created_at) INTO v_last_scan
  FROM qr_scan_attempts
  WHERE scanned_by = p_carpenter_id AND success = TRUE;

  IF v_last_scan IS NOT NULL AND (NOW() - v_last_scan) < (v_cooldown || ' seconds')::INTERVAL THEN
    INSERT INTO qr_scan_attempts (qr_code, scanned_by, success, failure_reason, location, device_info)
    VALUES (p_qr_code, p_carpenter_id, FALSE, 'cooldown', p_location, p_device_info);
    RETURN jsonb_build_object('success', false, 'error', 'Please wait before scanning again');
  END IF;

  -- 3. Validate QR code
  SELECT * INTO v_qr FROM qr_codes WHERE code = p_qr_code FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO qr_scan_attempts (qr_code, scanned_by, success, failure_reason, location, device_info)
    VALUES (p_qr_code, p_carpenter_id, FALSE, 'invalid_code', p_location, p_device_info);
    RETURN jsonb_build_object('success', false, 'error', 'Invalid QR code');
  END IF;

  IF v_qr.status = 'scanned' THEN
    INSERT INTO qr_scan_attempts (qr_code, scanned_by, success, failure_reason, location, device_info)
    VALUES (p_qr_code, p_carpenter_id, FALSE, 'already_scanned', p_location, p_device_info);
    RETURN jsonb_build_object('success', false, 'error', 'QR code already used');
  END IF;

  -- 4. Validate carpenter
  SELECT * INTO v_carpenter FROM profiles
  WHERE id = p_carpenter_id AND role = 'carpenter' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive account');
  END IF;

  -- 5. Get product info
  SELECT * INTO v_product FROM products WHERE id = v_qr.product_id;

  -- 6. Calculate base points (QR stored points > Variant priceMatrix points > Product default points)
  v_base_points := NULL;

  -- Priority 1: Direct reward_points stored on this QR code (e.g. 6 PTS)
  IF v_qr.reward_points IS NOT NULL AND v_qr.reward_points > 0 THEN
    v_base_points := v_qr.reward_points;
  END IF;

  -- Priority 2: Variant points from product specifications priceMatrix (by SKU)
  IF (v_base_points IS NULL OR v_base_points = 0) AND v_qr.sku IS NOT NULL AND v_product.specifications IS NOT NULL THEN
    BEGIN
      SELECT (elem->>'reward_points')::INTEGER INTO v_base_points
      FROM jsonb_array_elements(COALESCE(v_product.specifications->'priceMatrix', '[]'::jsonb)) AS elem
      WHERE elem->>'sku' = v_qr.sku
        AND elem->>'reward_points' IS NOT NULL
        AND (elem->>'reward_points')::NUMERIC > 0
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_base_points := NULL;
    END;
  END IF;

  -- Priority 3: Product-level default reward points
  IF v_base_points IS NULL OR v_base_points = 0 THEN
    v_base_points := COALESCE(v_product.reward_points, 0);
  END IF;

  v_base_points := COALESCE(v_base_points, 0);

  -- 7. Check active offers with Subcategory & Scan Points threshold support
  -- Check Multiplier offer (cast to text to prevent enum mismatch errors)
  SELECT * INTO v_offer FROM offers
  WHERE is_active = TRUE
    AND NOW() BETWEEN starts_at AND ends_at
    AND offer_type::text = 'multiplier'
    AND (target = 'all' OR target = 'carpenter' OR target_role = 'all' OR target_role = 'carpenter')
    AND (product_id IS NULL OR product_id = v_qr.product_id)
    AND (category_id IS NULL OR category_id = v_product.category_id)
    AND (subcategory_id IS NULL OR subcategory_id = v_product.subcategory_id)
    AND (min_purchase = 0 OR v_base_points >= min_purchase)
    AND (usage_limit IS NULL OR used_count < usage_limit)
  ORDER BY value DESC LIMIT 1;

  IF FOUND THEN
    v_multiplier := v_offer.value;
    v_applied_offer_title := v_offer.title;
    UPDATE offers SET used_count = used_count + 1 WHERE id = v_offer.id;
  END IF;

  -- Check Bonus points offer (cast to text to prevent enum mismatch errors)
  SELECT * INTO v_offer FROM offers
  WHERE is_active = TRUE
    AND NOW() BETWEEN starts_at AND ends_at
    AND offer_type::text = 'bonus_points'
    AND (target = 'all' OR target = 'carpenter' OR target_role = 'all' OR target_role = 'carpenter')
    AND (product_id IS NULL OR product_id = v_qr.product_id)
    AND (category_id IS NULL OR category_id = v_product.category_id)
    AND (subcategory_id IS NULL OR subcategory_id = v_product.subcategory_id)
    AND (min_purchase = 0 OR v_base_points >= min_purchase)
    AND (usage_limit IS NULL OR used_count < usage_limit)
  ORDER BY value DESC LIMIT 1;

  IF FOUND THEN
    v_bonus := v_offer.value::INTEGER;
    IF v_offer.max_bonus_points IS NOT NULL AND v_bonus > v_offer.max_bonus_points THEN
      v_bonus := v_offer.max_bonus_points;
    END IF;
    IF v_applied_offer_title IS NULL THEN
      v_applied_offer_title := v_offer.title;
    END IF;
    UPDATE offers SET used_count = used_count + 1 WHERE id = v_offer.id;
  END IF;

  -- 8. Final points for this scan
  v_final_points := CEIL(v_base_points * v_multiplier) + v_bonus;

  -- 9. Check Periodic Milestone Offer (cast to text to prevent enum mismatch errors)
  v_month_start := date_trunc('month', NOW());
  SELECT COALESCE(SUM(points), 0) INTO v_month_pts_before
  FROM reward_points_ledger
  WHERE user_id = p_carpenter_id
    AND txn_type = 'earn_scan'
    AND created_at >= v_month_start;

  SELECT * INTO v_milestone_offer FROM offers
  WHERE is_active = TRUE
    AND NOW() BETWEEN starts_at AND ends_at
    AND (target_scope = 'carpenter_milestone' OR offer_type::text = 'milestone_points')
    AND (target = 'all' OR target = 'carpenter' OR target_role = 'all' OR target_role = 'carpenter')
    AND min_purchase > 0
    AND (usage_limit IS NULL OR used_count < usage_limit)
  ORDER BY min_purchase ASC LIMIT 1;

  IF FOUND THEN
    -- Check if this scan crossed the milestone threshold
    IF v_month_pts_before < v_milestone_offer.min_purchase AND (v_month_pts_before + v_final_points) >= v_milestone_offer.min_purchase THEN
      -- Award milestone bonus
      IF v_milestone_offer.offer_type::text = 'tiered_discount' OR v_milestone_offer.value <= 100 THEN
        v_milestone_bonus := CEIL((v_milestone_offer.min_purchase * v_milestone_offer.value) / 100);
      ELSE
        v_milestone_bonus := v_milestone_offer.value::INTEGER;
      END IF;

      IF v_milestone_offer.max_bonus_points IS NOT NULL AND v_milestone_bonus > v_milestone_offer.max_bonus_points THEN
        v_milestone_bonus := v_milestone_offer.max_bonus_points;
      END IF;

      UPDATE offers SET used_count = used_count + 1 WHERE id = v_milestone_offer.id;
    END IF;
  END IF;

  -- 10. Credit carpenter
  v_new_balance := v_carpenter.total_points + v_final_points + v_milestone_bonus;
  UPDATE profiles SET total_points = v_new_balance, updated_at = NOW()
  WHERE id = p_carpenter_id;

  -- Scan ledger entry
  INSERT INTO reward_points_ledger (
    user_id, txn_type, points, balance_after, reference_type, reference_id, description, metadata
  )
  VALUES (
    p_carpenter_id, 'earn_scan', v_final_points, 
    v_carpenter.total_points + v_final_points,
    'qr_code', v_qr.id,
    'Scanned ' || COALESCE(v_product.name, 'Product'),
    jsonb_build_object(
      'product_id', v_product.id,
      'base_points', v_base_points,
      'multiplier', v_multiplier,
      'bonus', v_bonus,
      'offer_applied', v_applied_offer_title
    )
  );

  -- If milestone reached, log additional milestone entry
  IF v_milestone_bonus > 0 THEN
    INSERT INTO reward_points_ledger (
      user_id, txn_type, points, balance_after, reference_type, reference_id, description, metadata
    )
    VALUES (
      p_carpenter_id, 'earn_bonus', v_milestone_bonus, v_new_balance,
      'offer', v_milestone_offer.id,
      'Monthly Milestone Bonus: ' || v_milestone_offer.title,
      jsonb_build_object(
        'offer_id', v_milestone_offer.id,
        'milestone_threshold', v_milestone_offer.min_purchase,
        'bonus_points', v_milestone_bonus
      )
    );
  END IF;

  -- 11. Update QR status
  UPDATE qr_codes
  SET status = 'scanned', scanned_by = p_carpenter_id, scanned_at = NOW(), scan_location = p_location
  WHERE id = v_qr.id;

  -- 12. Log successful scan
  INSERT INTO qr_scan_attempts (qr_code, scanned_by, success, location, device_info)
  VALUES (p_qr_code, p_carpenter_id, TRUE, p_location, p_device_info);

  RETURN jsonb_build_object(
    'success', true,
    'points_earned', v_final_points,
    'milestone_bonus', v_milestone_bonus,
    'new_balance', v_new_balance,
    'product_name', v_product.name,
    'offer_applied', v_applied_offer_title
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
