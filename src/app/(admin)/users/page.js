import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import UsersClient from "./UsersClient";

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  const { data: users, count } = await supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(0, 19);

  return <UsersClient initialUsers={users || []} initialCount={count || 0} />;
}
