/**
 * WhatsApp Business Cloud API — Server-side wrapper
 * Uses Meta's Cloud API (v21.0 / v25.0)
 * Adapted from multitenate implementation
 */

// WhatsApp Configuration Constants (non-secret constants)
export const WHATSAPP_CONFIG = {
  TEMPLATE_NAME: "yoursites_auth",
  TEMPLATE_LANG: "en",
  BUTTON_TYPE: "url",
  API_VERSION: "v21.0",
};

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || WHATSAPP_CONFIG.API_VERSION;
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Format phone number: ensure it starts with country code (91 for India) and has no non-digits
 */
export function formatPhoneNumber(phone) {
  if (!phone) return "";
  let cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "91" + cleaned.slice(1);
  }
  if (cleaned.length === 10) {
    cleaned = "91" + cleaned;
  }
  return cleaned;
}

/**
 * Send a template message to a single recipient
 * @param {string} to - Phone number with or without country code
 * @param {string} templateName - Pre-approved template name (e.g. 'yoursites_auth')
 * @param {string} languageCode - e.g. 'en'
 * @param {Array} components - Template components (body, button params)
 * @returns {Promise<object>} - { messageId, status }
 */
export async function sendTemplateMessage(to, templateName, languageCode = "en", components = []) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_TOKEN || ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    throw new Error("WhatsApp API credentials not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID)");
  }

  const formattedTo = formatPhoneNumber(to);
  const body = {
    messaging_product: "whatsapp",
    to: formattedTo,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };

  if (components && components.length > 0) {
    body.template.components = components;
  }

  const response = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.error) {
    const errMsg = data?.error?.message || data?.error?.error_data?.details || response.statusText;
    console.error("[whatsapp.js] Meta API error:", JSON.stringify(data));
    throw new Error(`WhatsApp API Error: ${errMsg}`);
  }

  return {
    messageId: data.messages?.[0]?.id || null,
    status: data.messages?.[0]?.message_status || "sent",
    contacts: data.contacts || [],
  };
}

/**
 * Send WhatsApp OTP using template (default: 'yoursites_auth')
 * Format matches the multitenate sample: body text parameter + url button parameter
 */
export async function sendWhatsAppOTP({ phone, otp, templateName, languageCode }) {
  const tpl = templateName || process.env.WHATSAPP_TEMPLATE_NAME || WHATSAPP_CONFIG.TEMPLATE_NAME;
  const lang = languageCode || process.env.WHATSAPP_TEMPLATE_LANG || WHATSAPP_CONFIG.TEMPLATE_LANG;
  const btnType = process.env.WHATSAPP_BUTTON_TYPE || WHATSAPP_CONFIG.BUTTON_TYPE;

  const components = [
    {
      type: "body",
      parameters: [{ type: "text", text: String(otp) }],
    },
  ];

  if (btnType === "url") {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: String(otp) }],
    });
  } else if (btnType === "copy_code") {
    components.push({
      type: "button",
      sub_type: "copy_code",
      index: "0",
      parameters: [{ type: "coupon_code", coupon_code: String(otp) }],
    });
  }

  return sendTemplateMessage(phone, tpl, lang, components);
}
