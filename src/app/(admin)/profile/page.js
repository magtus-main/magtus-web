import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import ProfileClient from "./ProfileClient";

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { redirect } = require("next/navigation");
    redirect('/magtus-login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return <ProfileClient initialProfile={profile} />;
}
