import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import OffersClient from "./OffersClient";
import { verifyServerPageAccess } from "@/utils/permissions";

export const dynamic = 'force-dynamic';

export default async function OffersPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Verify access
  const { profile, orgMember } = await verifyServerPageAccess(supabase, "offers", "view");

  // Fetch offers
  let offers = [];
  try {
    const { data, error } = await supabase
      .from('offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      offers = data;
    }
  } catch (err) {
    console.error("Error fetching offers:", err);
  }

  // Fetch categories for targeting
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');

  // Fetch products for targeting
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, category_id')
    .order('name');

  return (
    <OffersClient
      initialOffers={offers}
      categories={categories || []}
      products={products || []}
      profile={profile}
      orgMember={orgMember}
    />
  );
}
