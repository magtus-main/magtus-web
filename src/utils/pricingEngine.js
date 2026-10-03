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
  activeOffers = [],
  orderDate = new Date(),
}) {
  const isBox = orderedUnit === "box";
  const effectivePcsPerBox = isBox ? Math.max(1, parseInt(pcsPerBox) || 1) : 1;
  const totalPieces = orderedQty * effectivePcsPerBox;

  // Single unit price according to selected unit (Box vs Piece)
  const lineUnitPrice = isBox ? (unitPrice * effectivePcsPerBox) : unitPrice;
  const grossTotal = Math.round((orderedQty * lineUnitPrice) * 100) / 100;

  // Filter eligible offers
  const checkTime = new Date(orderDate).getTime();
  const eligibleOffers = (activeOffers || []).filter((offer) => {
    if (!offer || !offer.is_active) return false;

    // Check validity window
    const start = new Date(offer.start_date).getTime();
    const end = new Date(offer.end_date).getTime();
    if (checkTime < start || checkTime > end) return false;

    // Check unit applicability
    if (offer.applicable_unit !== "any" && offer.applicable_unit !== orderedUnit) {
      return false;
    }

    // Check target scope
    if (offer.target_type === "category") {
      if (!categoryId || !offer.target_ids?.includes(categoryId)) return false;
    } else if (offer.target_type === "product") {
      if (!productId || !offer.target_ids?.includes(productId)) return false;
    }

    return true;
  });

  // Evaluate All-Unit Bracket Rule across eligible offers
  let bestDiscountPercentage = 0;
  let appliedOffer = null;
  let appliedTier = null;

  for (const offer of eligibleOffers) {
    if (!Array.isArray(offer.tiers) || offer.tiers.length === 0) continue;

    // Filter qualifying tiers where orderedQty >= min_qty
    const qualifyingTiers = offer.tiers
      .filter((tier) => orderedQty >= Number(tier.min_qty))
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
  }

  // Bracket rule: Applied to ALL units directly
  const discountAmount = Math.round(((grossTotal * bestDiscountPercentage) / 100) * 100) / 100;
  const netTotal = Math.max(0, Math.round((grossTotal - discountAmount) * 100) / 100);

  return {
    orderedQty,
    orderedUnit,
    pcsPerBox: effectivePcsPerBox,
    totalPieces,
    unitPrice: lineUnitPrice,
    pieceUnitPrice: unitPrice,
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
  const calculatedItems = items.map((item) => {
    const pricing = calculateLineItemPricing({
      unitPrice: item.unitPrice || item.dealer_price || 0,
      pcsPerBox: item.pcsPerBox || item.pcs_per_box || 1,
      orderedUnit: item.orderedUnit || item.ordered_unit || "piece",
      orderedQty: item.orderedQty || item.quantity || 1,
      productId: item.productId || item.product_id,
      categoryId: item.categoryId || item.category_id,
      activeOffers,
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
