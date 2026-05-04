import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import SettingsClient from "./SettingsClient";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Fetch all key-value settings and convert to a flat map
  const { data: rows } = await supabase
    .from("app_settings")
    .select("key, value");

  const settingsMap = {};
  if (rows) {
    for (const row of rows) {
      // value is JSONB stored as a raw value (e.g. 100, "MGT", etc.)
      try {
        settingsMap[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      } catch {
        settingsMap[row.key] = row.value;
      }
    }
  }

  return <SettingsClient initialSettings={settingsMap} />;
}
