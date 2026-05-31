import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import ProductClient from "./ProductClient";
import { verifyServerPageAccess } from "@/utils/permissions";

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Verify access
  const { profile, orgMember } = await verifyServerPageAccess(supabase, "products", "view");

  // Fetch all products with their primary images
  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      categories (id, name),
      product_images (id, url, is_primary)
    `)
    .order('created_at', { ascending: false });

  // Fetch categories for the form
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  // Fetch subcategories
  const { data: subcategories } = await supabase
    .from('subcategories')
    .select('*, categories (id, name)')
    .order('name');

  return (
    <ProductClient
      initialProducts={products || []}
      initialCategories={categories || []}
      initialSubcategories={subcategories || []}
      profile={profile}
      orgMember={orgMember}
    />
  );
}
