import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import QRCodesClient from "./QRCodesClient";
import { verifyServerPageAccess } from "@/utils/permissions";

export const dynamic = 'force-dynamic';

export default async function QRCodesPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Verify access
  const { profile, orgMember } = await verifyServerPageAccess(supabase, "qrcodes", "view");

  // Fetch products for the dropdown
  const { data: products } = await supabase
    .from("products")
    .select("id, name, reward_points, specifications")
    .eq("is_active", true)
    .order("name");

  // Fetch initial QR codes
  const { data: qrCodes, count } = await supabase
    .from("qr_codes")
    .select(
      `*, product:products(id, name, specifications), scanned_by_profile:profiles!scanned_by(id, full_name, phone)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(0, 19);

  return (
    <QRCodesClient
      initialProducts={products || []}
      initialQRCodes={qrCodes || []}
      initialCount={count || 0}
      profile={profile}
      orgMember={orgMember}
    />
  );
}
