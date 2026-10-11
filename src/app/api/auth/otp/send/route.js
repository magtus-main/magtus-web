import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendWhatsAppOTP } from "@/lib/whatsapp";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function OPTIONS() {
  return new NextResponse("ok", { headers: corsHeaders });
}

// Hardcoded test phone numbers bypass (uses static OTP: 000000)
const TEST_NUMBERS = [
  "9876543210", "9876543211", // admin
  "9876543212", "9876543213", // dealer
  "9876543214", "9876543215", // member (admin staff)
  "9876543216", "9876543217", // carpenter
  "9876543218", "9876543219", // staff (dealer staff)
];

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawValue = body.phone || body.value;

    if (!rawValue) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Clean phone: strip non-digits and leading country code '91'
    let cleanPhone = String(rawValue).replace(/\D/g, "");
    if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
      cleanPhone = cleanPhone.substring(2);
    }

    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json(
        { success: false, error: "Valid 10-digit phone number required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const SECRET_SALT = process.env.WHATSAPP_SECRET_SALT || "Prabhat_Site_Launch_2026";
    const isTestNumber = TEST_NUMBERS.includes(cleanPhone);
    const exp = Date.now() + 10 * 60 * 1000; // 10 minutes validity

    let otp;

    if (isTestNumber) {
      otp = "000000";
      console.log(`[API send-otp] Test bypass applied for: ${cleanPhone}`);
    } else {
      otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Send OTP via Meta WhatsApp Cloud API
      await sendWhatsAppOTP({
        phone: cleanPhone,
        otp,
      });
      console.log(`[API send-otp] WhatsApp OTP dispatched to 91${cleanPhone}`);
    }

    // HMAC hash for stateless verification
    const dataToSign = `${cleanPhone}:${otp}:${exp}`;
    const signature = crypto.createHmac("sha256", SECRET_SALT).update(dataToSign).digest("hex");
    const otpHash = `${cleanPhone}:${exp}:${signature}`;

    const response = NextResponse.json(
      {
        success: true,
        message: "Code sent successfully via WhatsApp",
        otpHash,
      },
      { headers: corsHeaders }
    );

    // Set cookie for web browser session (matching multitenate)
    response.cookies.set("auth_otp_session", `${dataToSign}:${signature}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[API send-otp] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send OTP" },
      { status: 500, headers: corsHeaders }
    );
  }
}
