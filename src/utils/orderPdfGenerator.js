import { jsPDF } from "jspdf";

/**
 * Loads an image from a URL and returns an HTMLImageElement
 */
function loadImage(src) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Format currency values cleanly for PDF without Unicode encoding issues
 */
function formatCurrency(amount) {
  const num = Number(amount || 0);
  return "Rs. " + num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format date string
 */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateStr);
  }
}

/**
 * Generates and triggers print/download for an order PDF
 * @param {Object} order - Full order object including dealer, organization, and order_items
 * @returns {Promise<{success: boolean, blobUrl?: string}>}
 */
export async function generateOrderPdf(order) {
  if (!order) {
    throw new Error("No order data provided for PDF generation");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Brand Palette
  const PRIMARY = [79, 58, 48]; // #4f3a30
  const TEXT_DARK = [30, 41, 59]; // slate-800
  const TEXT_MUTED = [100, 116, 139]; // slate-500
  const BORDER_COLOR = [226, 232, 240]; // slate-200
  const BG_LIGHT = [248, 250, 252]; // slate-50

  // Pre-load assets
  const logoImg = await loadImage("/magtus_logo.png");

  let currentY = 0;

  // Function to render top header
  const renderHeader = (isFirstPage = true) => {
    // Top colored brand bar
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, pageWidth, 5, "F");

    if (isFirstPage) {
      currentY = 12;

      // Brand Logo / Title
      if (logoImg) {
        try {
          const logoW = 38;
          const logoH = (logoImg.height / logoImg.width) * logoW;
          const finalH = Math.min(logoH, 14);
          doc.addImage(logoImg, "PNG", margin, currentY, logoW, finalH);
          currentY += finalH + 5; // Generous breathing space below logo
        } catch {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
          doc.setTextColor(...PRIMARY);
          doc.text("MAGTUS HARDWARE", margin, currentY + 6);
          currentY += 12;
        }
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(...PRIMARY);
        doc.text("MAGTUS HARDWARE", margin, currentY + 6);
        currentY += 12;
      }

      // Company info subtext
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text("Premium Architectural Hardware & Fittings", margin, currentY);
      currentY += 4.5;
      doc.text("Email: info@magtus.co.in  |  Website: www.magtus.co.in", margin, currentY);

      // Top Right: Document Title & Details
      const detailsRightX = pageWidth - margin;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...PRIMARY);
      doc.text("ORDER INVOICE / DISPATCH SLIP", detailsRightX, 15, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...TEXT_DARK);
      const orderNumText = `Order #: ${order.order_number || order.id?.slice(0, 8) || "—"}`;
      doc.text(orderNumText, detailsRightX, 22, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`Date: ${formatDate(order.created_at)}`, detailsRightX, 28, { align: "right" });

      // Dynamically position divider below whichever column is taller
      currentY = Math.max(currentY + 5, 36);

      // Divider line
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.4);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 5;
    } else {
      // Continuation Header for Subsequent Pages
      currentY = 12;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...PRIMARY);
      doc.text("MAGTUS HARDWARE — Order #" + (order.order_number || order.id?.slice(0, 8)), margin, currentY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(`Order Date: ${formatDate(order.created_at)} | Dispatch Slip (Cont.)`, pageWidth - margin, currentY, { align: "right" });

      currentY += 4;
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.3);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 6;
    }
  };

  // Render initial page header
  renderHeader(true);

  // Customer & Shipping Info Box (2 columns)
  const cardWidth = (contentWidth - 6) / 2;
  const cardY = currentY;
  const cardHeight = 36;

  // Box 1: Billed / Customer Details
  doc.setFillColor(...BG_LIGHT);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text("CUSTOMER & DEALER DETAILS", margin + 4, cardY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  const dealerName = order.dealer?.full_name || "—";
  doc.text(dealerName, margin + 4, cardY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  const orgName = order.organization?.name ? `Firm: ${order.organization.name}` : "";
  if (orgName) {
    doc.text(orgName, margin + 4, cardY + 17);
  }

  const phone = order.dealer?.phone ? `Phone: ${order.dealer.phone}` : "";
  doc.text(phone || "Phone: —", margin + 4, cardY + 22);

  const orgCityState = [order.organization?.city, order.organization?.state].filter(Boolean).join(", ");
  const billingAddr = order.organization?.address || orgCityState || "—";
  const wrappedBilling = doc.splitTextToSize(`Address: ${billingAddr}`, cardWidth - 8);
  doc.text(wrappedBilling.slice(0, 2), margin + 4, cardY + 27);

  // Box 2: Shipping & Destination Details
  const box2X = margin + cardWidth + 6;
  doc.setFillColor(...BG_LIGHT);
  doc.roundedRect(box2X, cardY, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text("SHIPPING & DESTINATION DETAILS", box2X + 4, cardY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Shipping Address:", box2X + 4, cardY + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT_DARK);
  const shipAddr = order.shipping_address || (billingAddr !== "—" ? billingAddr : "Same as customer billing address");
  const wrappedShipping = doc.splitTextToSize(shipAddr, cardWidth - 8);
  doc.text(wrappedShipping.slice(0, 3), box2X + 4, cardY + 17);

  currentY = cardY + cardHeight + 8;

  // Table Column Definitions
  const colWidths = {
    index: 10,
    desc: 78,
    variant: 38,
    qty: 16,
    rate: 20,
    amount: 20,
  };

  const colX = {
    index: margin,
    desc: margin + colWidths.index,
    variant: margin + colWidths.index + colWidths.desc,
    qty: margin + colWidths.index + colWidths.desc + colWidths.variant,
    rate: margin + colWidths.index + colWidths.desc + colWidths.variant + colWidths.qty,
    amount: margin + colWidths.index + colWidths.desc + colWidths.variant + colWidths.qty + colWidths.rate,
  };

  // Function to render table header
  const renderTableHeader = () => {
    const thHeight = 8;
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(margin, currentY, contentWidth, thHeight, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);

    doc.text("#", colX.index + colWidths.index / 2, currentY + 5.2, { align: "center" });
    doc.text("ITEM DESCRIPTION", colX.desc + 3, currentY + 5.2);
    doc.text("VARIANT / SKU", colX.variant + 2, currentY + 5.2);
    doc.text("QTY", colX.qty + colWidths.qty / 2, currentY + 5.2, { align: "center" });
    doc.text("RATE", colX.rate + colWidths.rate - 3, currentY + 5.2, { align: "right" });
    doc.text("TOTAL", colX.amount + colWidths.amount - 3, currentY + 5.2, { align: "right" });

    currentY += thHeight;
  };

  renderTableHeader();

  // Render Order Items
  const items = order.order_items || [];
  let totalQuantity = 0;

  if (items.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("No specific items listed for this order.", margin + contentWidth / 2, currentY + 10, { align: "center" });
    currentY += 18;
  } else {
    items.forEach((item, idx) => {
      totalQuantity += Number(item.quantity || 0);

      // Clean item description (avoid non-Latin Unicode for standard jsPDF fonts)
      const productName = item.product?.name || item.product_name || "Hardware Product";
      const variantText = item.variant_label ||
        item.variant_details?.variant_label ||
        (item.variant_details?.finish && item.variant_details?.size
          ? `${item.variant_details.finish} - ${item.variant_details.size}`
          : item.variant_details?.finish || item.variant_details?.size || "—");

      const skuText = item.sku || item.variant_details?.sku || "";

      let variantDisplay = variantText;
      if (skuText) variantDisplay += ` (SKU: ${skuText})`;
      if (item.discount_percentage > 0 || item.applied_offer_details) {
        const offerLabel = item.applied_offer_details?.tierLabel || `${item.discount_percentage}% Off`;
        variantDisplay += `\n[Promo: ${offerLabel}]`;
      }

      // Format Qty label
      const isBox = item.ordered_unit === "box" || item.ordered_unit === "boxes";
      const totalPcs = item.total_pcs || (isBox ? (item.quantity * (item.pcs_per_box || 1)) : item.quantity);
      const qtyText = isBox 
        ? `${item.quantity || 1} Box${item.quantity > 1 ? 'es' : ''}\n(${totalPcs} pcs)`
        : `${item.quantity || 1} pcs`;

      // Calculate wrapped text to determine dynamic row height
      const descLines = doc.splitTextToSize(productName, colWidths.desc - 6);
      const variantLines = doc.splitTextToSize(variantDisplay, colWidths.variant - 4);
      const qtyLines = doc.splitTextToSize(qtyText, colWidths.qty - 2);

      const maxTextLines = Math.max(descLines.length, variantLines.length, qtyLines.length, 1);
      const rowHeight = Math.max(9, maxTextLines * 4.2 + 4);

      // Check for Page Overflow
      if (currentY + rowHeight > pageHeight - 32) {
        doc.addPage();
        renderHeader(false);
        renderTableHeader();
      }

      // Alternate Row Background
      if (idx % 2 === 1) {
        doc.setFillColor(...BG_LIGHT);
        doc.rect(margin, currentY, contentWidth, rowHeight, "F");
      }

      // Draw Row Border
      doc.setDrawColor(...BORDER_COLOR);
      doc.setLineWidth(0.2);
      doc.line(margin, currentY + rowHeight, margin + contentWidth, currentY + rowHeight);

      // #
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(String(idx + 1), colX.index + colWidths.index / 2, currentY + 5.5, { align: "center" });

      // Product Description
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_DARK);
      doc.text(descLines, colX.desc + 3, currentY + 5.5);

      // Variant / SKU
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(variantLines, colX.variant + 2, currentY + 5.5);

      // Qty
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_DARK);
      doc.text(qtyLines, colX.qty + colWidths.qty / 2, currentY + 5.5, { align: "center" });

      // Unit Rate
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXT_DARK);
      doc.text(formatCurrency(item.unit_price), colX.rate + colWidths.rate - 3, currentY + 5.5, { align: "right" });

      // Amount
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PRIMARY);
      doc.text(formatCurrency(item.total_price), colX.amount + colWidths.amount - 3, currentY + 5.5, { align: "right" });

      currentY += rowHeight;
    });
  }

  // Check if summary fits on current page
  const summaryBoxHeight = 45;
  if (currentY + summaryBoxHeight > pageHeight - 25) {
    doc.addPage();
    renderHeader(false);
  }

  currentY += 4;

  // Bottom Summary Section: Notes on left, Totals on right
  const summaryStartY = currentY;
  const leftNotesWidth = contentWidth - 75;
  const rightTotalsWidth = 70;
  const rightTotalsX = margin + contentWidth - rightTotalsWidth;

  // Left Side: Notes
  if (order.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PRIMARY);
    doc.text("ORDER INSTRUCTIONS & NOTES:", margin, summaryStartY + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_DARK);
    const wrappedNotes = doc.splitTextToSize(order.notes, leftNotesWidth - 6);
    doc.text(wrappedNotes.slice(0, 4), margin, summaryStartY + 9);
  }

  // Financial Breakdown
  const orderSubtotal = Number(order.subtotal) || (items.reduce((s, it) => s + (Number(it.total_price) || 0), 0)) || Number(order.total) || 0;
  const orderDiscount = Number(order.discount) || (items.reduce((s, it) => s + (Number(it.discount_amount) || 0), 0)) || 0;
  const taxableSubtotal = Math.max(0, orderSubtotal - orderDiscount);
  const taxPercent = order.tax_percent != null ? Number(order.tax_percent) : 18;
  const taxAmount = order.tax_amount != null ? Number(order.tax_amount) : Math.round(taxableSubtotal * (taxPercent / 100) * 100) / 100;
  const grandTotal = Number(order.total) || Math.round((taxableSubtotal + taxAmount) * 100) / 100;
  const hasDiscount = orderDiscount > 0;
  const totalsCardHeight = hasDiscount ? 42 : 35;

  // Right Side: Totals Card
  doc.setFillColor(...BG_LIGHT);
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightTotalsX, summaryStartY, rightTotalsWidth, totalsCardHeight, 2, 2, "FD");

  let lineY = summaryStartY + 5.5;

  // Total Quantity row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Total Items:", rightTotalsX + 4, lineY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(`${totalQuantity || items.length} pcs`, rightTotalsX + rightTotalsWidth - 4, lineY, { align: "right" });

  // Subtotal row
  lineY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Subtotal:", rightTotalsX + 4, lineY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  doc.text(formatCurrency(orderSubtotal), rightTotalsX + rightTotalsWidth - 4, lineY, { align: "right" });

  // Discount row (if any)
  if (hasDiscount) {
    lineY += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(16, 149, 93); // Emerald green
    doc.text("Discount (Promo):", rightTotalsX + 4, lineY);
    doc.setFont("helvetica", "bold");
    doc.text(`-${formatCurrency(orderDiscount)}`, rightTotalsX + rightTotalsWidth - 4, lineY, { align: "right" });
  }

  // Taxes (GST)
  lineY += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`GST (${taxPercent}%):`, rightTotalsX + 4, lineY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  doc.text(`+${formatCurrency(taxAmount)}`, rightTotalsX + rightTotalsWidth - 4, lineY, { align: "right" });

  // Grand Total highlight bar
  lineY += 4.5;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(rightTotalsX + 2, lineY, rightTotalsWidth - 4, 9, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("GRAND TOTAL:", rightTotalsX + 5, lineY + 6);
  doc.setFontSize(10);
  doc.text(formatCurrency(grandTotal), rightTotalsX + rightTotalsWidth - 5, lineY + 6, { align: "right" });

  currentY = summaryStartY + totalsCardHeight + 5;

  // Signatures & Declaration Box
  if (currentY + 22 > pageHeight - 15) {
    doc.addPage();
    renderHeader(false);
  }

  // Terms & Signatory
  const signY = currentY + 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Terms & Conditions:", margin, signY);
  doc.text("1. All disputes subject to local jurisdiction.", margin, signY + 3.5);
  doc.text("2. Goods once dispatched in good order are subject to company policy.", margin, signY + 7);
  doc.text("3. This is a computer-generated dispatch document requiring no physical seal.", margin, signY + 10.5);

  // Authorized Signatory
  const authX = pageWidth - margin - 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PRIMARY);
  doc.text("For MAGTUS HARDWARE", authX + 25, signY + 1, { align: "center" });

  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.line(authX, signY + 12, authX + 50, signY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Authorized Signatory", authX + 25, signY + 15.5, { align: "center" });

  // Add Page Numbers and Footer to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer line
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Magtus Hardware | Premium Fittings & Hardware | www.magtus.co.in", margin, pageHeight - 6);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
  }

  // Auto-print configuration
  doc.autoPrint();

  // Output as Blob URL
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const fileName = `Order_${order.order_number || order.id?.slice(0, 8) || "slip"}.pdf`;

  // Attempt to open in a new window for immediate printing and viewing
  let printWindow = null;
  try {
    printWindow = window.open(blobUrl, "_blank");
  } catch (err) {
    console.warn("Could not open new window:", err);
  }

  // If popup blocked or failed, trigger save download directly
  if (!printWindow || printWindow.closed || typeof printWindow.closed === "undefined") {
    doc.save(fileName);
  }

  return { success: true, blobUrl, fileName, doc };
}
