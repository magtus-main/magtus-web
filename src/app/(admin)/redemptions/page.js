import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import RedemptionsClient from "./RedemptionsClient";
import { verifyServerPageAccess } from "@/utils/permissions";

export const dynamic = 'force-dynamic';

export default async function RedemptionsPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Verify access
  const { profile, orgMember } = await verifyServerPageAccess(supabase, "redemptions", "view");

  // Fetch initial redemptions
  const { data: requests, count } = await supabase
    .from("redemption_requests")
    .select(`
      *,
      user:profiles!redemption_requests_user_id_fkey(id, full_name, phone),
      catalog_item:redemption_catalog(name, image_url, points_required)
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, 19);

  return (
    <RedemptionsClient
      initialRequests={requests || []}
      initialCount={count || 0}
      profile={profile}
      orgMember={orgMember}
    />
  );
}
