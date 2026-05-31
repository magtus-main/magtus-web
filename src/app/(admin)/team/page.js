import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import TeamClient from "./TeamClient";
import { verifyServerPageAccess } from "@/utils/permissions";

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Verify access
  const { profile, orgMember } = await verifyServerPageAccess(supabase, "team", "view");

  // Fetch active team members for admin portal (organization_id IS NULL)
  const { data: members, error: membersError } = await supabase
    .from("organization_members")
    .select("*, member:profiles(*)")
    .is("organization_id", null)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (membersError) {
    console.error("Error fetching admin team members:", membersError);
  }

  // Fetch invitations for admin team (organization_id IS NULL)
  const { data: invitations, error: invitationsError } = await supabase
    .from("invitations")
    .select("*, inviter:profiles!invited_by(*)")
    .is("organization_id", null)
    .order("created_at", { ascending: false });

  if (invitationsError) {
    console.error("Error fetching admin invitations:", invitationsError);
  }

  return (
    <TeamClient 
      initialMembers={members || []} 
      initialInvitations={invitations || []} 
      profile={profile}
      orgMember={orgMember}
    />
  );
}
