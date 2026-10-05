/**
 * Magtus Pricing & Promotional Offers Calculation Engine
 * 
 * Rules:
 * 1. Variant-Level Pack Size: Each variant has its own `pcs_per_box` (e.g. 5, 6, 2).
 * 2. All-Unit Bracket Rule: When ordered quantity reaches a higher tier (e.g. 10+ boxes),
 *    the higher tier discount (e.g. 11%) applies to ALL units in that line item.
 * 3. Line-Item Isolation: Multiple products in the same cart are evaluated independently.
 */

/**
 * Calculates pricing and applies the highest qualifying bracket discount for a single line item.
 *
 * @param {Object} params
 * @param {number} params.unitPrice - Base price per loose piece
 * @param {number} [params.pcsPerBox=1] - Number of pieces packed in 1 box for this variant
 * @param {string} [params.orderedUnit='piece'] - 'box' or 'piece'
 * @param {number} params.orderedQty - Quantity of boxes or pieces ordered
 * @param {string} [params.productId] - Product UUID
 * @param {string} [params.categoryId] - Category UUID
 * @param {Array} [params.activeOffers=[]] - List of active offers fetched from Supabase
 * @param {Date} [params.orderDate=new Date()] - Date of the order (for validity check)
 * @returns {Object} Complete calculation breakdown
 */
export function calculateLineItemPricing({
  unitPrice = 0,
  pcsPerBox = 1,
  orderedUnit = "piece",
  orderedQty = 1,
  productId = null,
  categoryId = null,
  subcategoryId = null,
  activeOffers = [],
  orderDate = new Date(),
  cartSubtotal = null,
}) {
  const normalizedUnit = (orderedUnit || "piece").toLowerCase().trim();
  const isExplicitBox = normalizedUnit === "box" || normalizedUnit === "boxes" || normalizedUnit === "bx";
  const packSize = Math.max(1, parseInt(pcsPerBox) || 1);

  // Total loose pieces ordered
  const totalPieces = isExplicitBox ? (orderedQty * packSize) : orderedQty;

  // Unit and line totals
  const pieceUnitPrice = unitPrice;
  const lineUnitPrice = isExplicitBox ? (unitPrice * packSize) : unitPrice;
  const grossTotal = Math.round((orderedQty * lineUnitPrice) * 100) / 100;

  // Filter eligible offers
  const checkTime = new Date(orderDate).getTime();
  const eligibleOffers = (activeOffers || []).filter((offer) => {
    if (!offer || !offer.is_active) return false;

    // Check validity window
    const start = new Date(offer.start_date || offer.starts_at).getTime();
    const end = new Date(offer.end_date || offer.ends_at).getTime();
    if (checkTime < start || checkTime > end) return false;

    // Audience filter: dealer vs carpenter (cart engine is dealer-focused)
    const target = offer.target_role || offer.target || "all";
    if (target === "carpenter") return false;

    // Check minimum purchase / cart threshold
    const minPurch = parseFloat(offer.min_purchase) || 0;
    const compareAmount = cartSubtotal != null ? cartSubtotal : grossTotal;
    if (minPurch > 0 && compareAmount < minPurch) return false;

    // Check unit applicability ('boxes'/'box'/'bx', 'pcs'/'piece', 'amount', 'any')
    const offerUnit = (offer.applicable_unit || "any").toLowerCase().trim();
    const isBoxOffer = offerUnit === "box" || offerUnit === "boxes" || offerUnit === "bx";
    const isPieceOffer = offerUnit === "piece" || offerUnit === "pcs" || offerUnit === "pieces";

    if (isBoxOffer) {
      // Box offer only applies directly if dealer ordered in boxes
      if (!isExplicitBox) return false;
    } else if (isPieceOffer) {
      // Piece offer only applies directly if dealer ordered in loose pieces
      if (isExplicitBox) return false;
    }

    // Check target scope & IDs
    const scope = (offer.target_scope || offer.target_type || "all_products").toLowerCase();
    if (scope === "category") {
      const catMatch = (offer.category_id && offer.category_id === categoryId) ||
                       (offer.target_ids && categoryId && offer.target_ids.includes(categoryId));
      if (!catMatch) return false;
    } else if (scope === "subcategory") {
      const subMatch = (offer.subcategory_id && offer.subcategory_id === subcategoryId) ||
                       (offer.target_ids && subcategoryId && offer.target_ids.includes(subcategoryId));
      if (!subMatch) return false;
    } else if (scope === "product") {
      const prodMatch = (offer.product_id && offer.product_id === productId) ||
                        (offer.target_ids && productId && offer.target_ids.includes(productId));
      if (!prodMatch) return false;
    } else {
      // all_products or general fallback
      if (offer.product_id && offer.product_id !== productId) return false;
      if (offer.subcategory_id && subcategoryId && offer.subcategory_id !== subcategoryId) return false;
      if (offer.category_id && categoryId && offer.category_id !== categoryId) return false;
    }

    return true;
  });

  // Evaluate All-Unit Bracket Rule across eligible offers
  let bestDiscountPercentage = 0;
  let appliedOffer = null;
  let appliedTier = null;

  for (const offer of eligibleOffers) {
    // Quantity matches directly against orderedQty in the chosen unit
    const qtyToCompare = orderedQty;

    if (offer.offer_type === "tiered_discount" || Array.isArray(offer.tiers)) {
      if (!Array.isArray(offer.tiers) || offer.tiers.length === 0) continue;

      // Filter qualifying tiers where qualifying quantity >= min_qty
      const qualifyingTiers = offer.tiers
        .filter((tier) => qtyToCompare >= Number(tier.min_qty))
        .sort((a, b) => Number(b.min_qty) - Number(a.min_qty)); // Highest min_qty first

      if (qualifyingTiers.length > 0) {
        const topTier = qualifyingTiers[0];
        const tierDiscount = parseFloat(topTier.discount_percentage) || 0;

        if (tierDiscount > bestDiscountPercentage) {
          bestDiscountPercentage = tierDiscount;
          appliedOffer = offer;
          appliedTier = topTier;
        }
      }
    } else if (offer.offer_type === "flat_discount") {
      const flatDiscount = parseFloat(offer.value) || 0;
      if (flatDiscount > bestDiscountPercentage) {
        bestDiscountPercentage = flatDiscount;
        appliedOffer = offer;
        appliedTier = { label: `${flatDiscount}% Flat Off`, min_qty: 1, discount_percentage: flatDiscount };
      }
    }
  }

  // Calculate discount directly on line item gross total
  let discountAmount = Math.round(((grossTotal * bestDiscountPercentage) / 100) * 100) / 100;

  // Margin protection cap (max_discount_amount in ₹)
  if (appliedOffer && appliedOffer.max_discount_amount != null && Number(appliedOffer.max_discount_amount) > 0) {
    discountAmount = Math.min(discountAmount, Number(appliedOffer.max_discount_amount));
  }

  const netTotal = Math.max(0, Math.round((grossTotal - discountAmount) * 100) / 100);

  return {
    orderedQty,
    orderedUnit: isExplicitBox ? "box" : "piece",
    pcsPerBox: packSize,
    totalPieces,
    unitPrice: lineUnitPrice,
    pieceUnitPrice,
    grossTotal,
    discountPercentage: bestDiscountPercentage,
    discountAmount,
    netTotal,
    appliedOffer: appliedOffer
      ? {
          id: appliedOffer.id,
          title: appliedOffer.title,
          tierLabel: appliedTier?.label || `${bestDiscountPercentage}% Off`,
          minQtyMet: appliedTier?.min_qty,
          discountPercentage: bestDiscountPercentage,
          maxCapApplied: appliedOffer.max_discount_amount ? discountAmount >= Number(appliedOffer.max_discount_amount) : false,
        }
      : null,
  };
}

/**
 * Calculates cart / order totals across multiple items.
 *
 * @param {Array} items - List of items with { unitPrice, pcsPerBox, orderedUnit, orderedQty, productId, categoryId }
 * @param {Array} activeOffers - Active offers
 * @returns {Object} Cart pricing summary with items breakdown
 */
export function calculateCartPricing(items = [], activeOffers = []) {
  const initialGross = items.reduce((sum, item) => {
    const unit = (item.orderedUnit || item.ordered_unit || "piece").toLowerCase().trim();
    const isBox = unit === "box" || unit === "boxes" || unit === "bx";
    const pack = Math.max(1, parseInt(item.pcsPerBox || item.pcs_per_box) || 1);
    const price = (parseFloat(item.unitPrice || item.dealer_price) || 0) * (isBox ? pack : 1);
    const qty = parseInt(item.orderedQty || item.quantity) || 1;
    return sum + (price * qty);
  }, 0);

  const calculatedItems = items.map((item) => {
    const pricing = calculateLineItemPricing({
      unitPrice: item.unitPrice || item.dealer_price || 0,
      pcsPerBox: item.pcsPerBox || item.pcs_per_box || 1,
      orderedUnit: item.orderedUnit || item.ordered_unit || "piece",
      orderedQty: item.orderedQty || item.quantity || 1,
      productId: item.productId || item.product_id,
      categoryId: item.categoryId || item.category_id,
      subcategoryId: item.subcategoryId || item.subcategory_id,
      activeOffers,
      cartSubtotal: initialGross,
    });

    return {
      ...item,
      pricing,
    };
  });

  const totalGross = calculatedItems.reduce((sum, item) => sum + item.pricing.grossTotal, 0);
  const totalDiscount = calculatedItems.reduce((sum, item) => sum + item.pricing.discountAmount, 0);
  const totalNet = calculatedItems.reduce((sum, item) => sum + item.pricing.netTotal, 0);
  const totalPieces = calculatedItems.reduce((sum, item) => sum + item.pricing.totalPieces, 0);

  return {
    items: calculatedItems,
    totalGross: Math.round(totalGross * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    totalPieces,
  };
}
