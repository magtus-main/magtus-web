'use server';

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export async function decryptRedemptionKyc(requestId) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // 1. Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Admin authorization required");
  }

  // 2. Double check if they are indeed an admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error("Forbidden: Admin privileges required");
  }

  // 3. Call the secure RPC function with the server secret key
  const secretKey = process.env.WHATSAPP_SECRET_SALT || 'magtus_default_salt';
  const { data, error } = await supabase.rpc('get_redemption_details_with_kyc', {
    p_request_id: requestId,
    p_secret_key: secretKey
  });

  if (error) {
    console.error("RPC Error decrypting redemption KYC:", error);
    throw new Error("Failed to decrypt KYC and bank details: " + error.message);
  }

  return data?.[0] || null;
}

export async function approveRedemption(requestId) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Admin authorization required");
  }

  // Double check if admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error("Forbidden: Admin privileges required");
  }

  // Update status to approved
  const { data, error } = await supabase
    .from("redemption_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    console.error("Error approving redemption:", error);
    throw new Error("Failed to approve redemption request: " + error.message);
  }

  return { success: true, data };
}

export async function rejectRedemption(requestId, reason) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Admin authorization required");
  }

  // Double check if admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error("Forbidden: Admin privileges required");
  }

  // Fetch the redemption request to get the user_id and points spent
  const { data: reqItem, error: reqError } = await supabase
    .from("redemption_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (reqError || !reqItem) {
    throw new Error("Redemption request not found");
  }

  // Update request to rejected
  const { data, error } = await supabase
    .from("redemption_requests")
    .update({
      status: "rejected",
      rejected_reason: reason || "Rejected by administrator",
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    console.error("Error rejecting redemption:", error);
    throw new Error("Failed to reject redemption request: " + error.message);
  }

  // Refund points to user profile
  const { data: userProfile, error: userError } = await supabase
    .from("profiles")
    .select("redeemed_points, total_points")
    .eq("id", reqItem.user_id)
    .single();

  if (!userError && userProfile) {
    const updatedRedeemed = Math.max(0, (userProfile.redeemed_points || 0) - reqItem.points_spent);
    await supabase
      .from("profiles")
      .update({ redeemed_points: updatedRedeemed })
      .eq("id", reqItem.user_id);

    const available = (userProfile.total_points || 0) - updatedRedeemed;

    // Add adjustment transaction to points ledger
    await supabase.from("reward_points_ledger").insert({
      user_id: reqItem.user_id,
      txn_type: "adjustment",
      points: reqItem.points_spent,
      balance_after: available,
      reference_type: "redemption",
      reference_id: reqItem.id,
      description: `Redemption rejected — ${reqItem.points_spent} points refunded`,
    });
  }

  return { success: true, data };
}

export async function fulfillRedemption(requestId) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Authenticate user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized: Admin authorization required");
  }

  // Double check if admin
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new Error("Forbidden: Admin privileges required");
  }

  // Update status to fulfilled
  const { data, error } = await supabase
    .from("redemption_requests")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) {
    console.error("Error fulfilling redemption:", error);
    throw new Error("Failed to fulfill redemption request: " + error.message);
  }

  return { success: true, data };
}

