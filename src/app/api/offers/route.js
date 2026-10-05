import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const scope = searchParams.get("scope");
    const offerType = searchParams.get("type");

    let query = supabase
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (role && role !== "all") {
      query = query.or(`target_role.eq.all,target_role.eq.${role},target.eq.all,target.eq.${role}`);
    }

    if (scope && scope !== "all") {
      query = query.eq("target_scope", scope);
    }

    if (offerType && offerType !== "all") {
      query = query.eq("offer_type", offerType);
    }

    const { data: offers, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }

    // Filter by time window safely handling starts_at/start_date and ends_at/end_date
    const checkTime = new Date().getTime();
    const activeOffers = (offers || []).filter((offer) => {
      const start = new Date(offer.starts_at || offer.start_date).getTime();
      const end = new Date(offer.ends_at || offer.end_date).getTime();
      if (!isNaN(start) && checkTime < start) return false;
      if (!isNaN(end) && checkTime > end) return false;
      return true;
    });

    return NextResponse.json({ success: true, offers: activeOffers });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
