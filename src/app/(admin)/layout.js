import TopNav from "@/components/layout/TopNav";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  return (
    <div className="flex h-screen overflow-hidden w-full bg-gray-50">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <TopNav profile={profile} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
