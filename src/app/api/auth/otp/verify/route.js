import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { createAdminClient } from "@/utils/supabase/admin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function OPTIONS() {
  return new NextResponse("ok", { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawPhone = body.phone || body.value;
    const otp = String(body.otp || "").trim();
    let otpHash = body.otpHash;

    if (!rawPhone || !otp) {
      return NextResponse.json(
        { success: false, error: "Phone number and OTP are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Clean phone: strip non-digits and leading country code '91'
    let cleanPhone = String(rawPhone).replace(/\D/g, "");
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

    // If otpHash not in body, check cookie (multitenate web support)
    if (!otpHash) {
      const cookieStore = await cookies();
      const cookieVal = cookieStore.get("auth_otp_session")?.value;
      if (cookieVal) {
        const parts = cookieVal.split(":");
        // Format from send: `${cleanPhone}:${otp}:${exp}:${signature}`
        if (parts.length === 4) {
          otpHash = `${parts[0]}:${parts[2]}:${parts[3]}`;
        }
      }
    }

    if (!otpHash) {
      return NextResponse.json(
        { success: false, error: "Verification session expired. Please request a new code." },
        { status: 400, headers: corsHeaders }
      );
    }

    // Parse hash: "cleanPhone:expiry:signature"
    const hashParts = otpHash.split(":");
    if (hashParts.length !== 3) {
      return NextResponse.json(
        { success: false, error: "Invalid verification data format" },
        { status: 400, headers: corsHeaders }
      );
    }

    const [hashPhone, expStr, receivedSignature] = hashParts;
    const exp = parseInt(expStr, 10);

    if (cleanPhone !== hashPhone) {
      return NextResponse.json(
        { success: false, error: "Phone number mismatch" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check expiry
    if (Date.now() > exp) {
      const resp = NextResponse.json(
        { success: false, error: "OTP expired. Please request a new one." },
        { status: 400, headers: corsHeaders }
      );
      resp.cookies.delete("auth_otp_session");
      return resp;
    }

    // Validate signature
    const dataToSign = `${cleanPhone}:${otp}:${expStr}`;
    const calculatedSignature = crypto.createHmac("sha256", SECRET_SALT).update(dataToSign).digest("hex");

    if (calculatedSignature !== receivedSignature) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP" },
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ OTP verified! Create/find user via Supabase Admin
    const supabaseAdmin = createAdminClient();
    const fakeEmail = `${cleanPhone}@magtus.app`;

    // Check if user exists
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
    let existingUser = userList?.users?.find((u) => u.email === fakeEmail);

    let userId;
    let isNewUser = false;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        email_confirm: true,
        phone: `+91${cleanPhone}`,
        phone_confirm: true,
        user_metadata: { phone: cleanPhone },
      });

      if (createError) throw createError;
      userId = newUser.user.id;
      isNewUser = true;
    }

    // Check if profile exists and status
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, status")
      .eq("id", userId)
      .maybeSingle();

    if (profile && (profile.status === "suspended" || profile.status === "deleted")) {
      return NextResponse.json(
        {
          success: false,
          error:
            profile.status === "deleted"
              ? "This account has been deleted. Please contact support if you need assistance."
              : "Account is blocked, contact admin.",
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Generate magic link token for client-side Supabase Auth session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: fakeEmail,
    });

    if (linkError) throw linkError;

    const response = NextResponse.json(
      {
        success: true,
        isNewUser: isNewUser || !profile,
        email: fakeEmail,
        token_hash: linkData?.properties?.hashed_token,
      },
      { headers: corsHeaders }
    );

    response.cookies.delete("auth_otp_session");

    return response;
  } catch (error) {
    console.error("[API verify-otp] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Verification failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
