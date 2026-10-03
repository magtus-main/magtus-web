import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateCartPricing } from "@/utils/pricingEngine";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const { items = [] } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    // Fetch active offers
    const { data: offers } = await supabase
      .from("offers")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now);

    const calculation = calculateCartPricing(items, offers || []);

    return NextResponse.json({
      success: true,
      calculation,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
