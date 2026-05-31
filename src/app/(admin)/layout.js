import TopNav from "@/components/layout/TopNav";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Check admin portal authorization
  const { data: accessData, error: accessError } = await supabase.rpc('can_access_admin_portal', { p_user_id: user.id });
  if (accessError || !accessData?.allowed) {
    // Clear session & redirect
    await supabase.auth.signOut();
    redirect('/login');
  }
  
  let profile = null;
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  profile = profileData;

  let orgMember = null;
  if (profile && profile.role === 'member') {
    const { data: memberData } = await supabase
      .from('organization_members')
      .select('*')
      .eq('member_id', user.id)
      .eq('is_active', true)
      .maybeSingle();
    orgMember = memberData;
  }

  return (
    <div className="flex h-screen overflow-hidden w-full bg-gray-50">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <TopNav profile={profile} orgMember={orgMember} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
