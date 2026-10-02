import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import OrdersClient from "./OrdersClient";
import { verifyServerPageAccess } from "@/utils/permissions";

export const dynamic = 'force-dynamic';

export default async function OrdersPage({ searchParams }) {
  const sp = await searchParams;
  const initialOrderId = sp?.id || sp?.orderId || null;

  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);

  // Verify access
  await verifyServerPageAccess(supabase, "orders", "view");

  let initialSelectedOrder = null;
  if (initialOrderId) {
    const { data: orderDetail } = await supabase
      .from("orders")
      .select(
        `*, 
        dealer:profiles!dealer_id(id, full_name, phone),
        organization:organizations!organization_id(id, name, city, state, address),
        order_items(
          id, quantity, unit_price, total_price, product_name, variant_details,
          product:products(id, name, name_hi)
        )`
      )
      .eq("id", initialOrderId)
      .maybeSingle();

    if (orderDetail) {
      initialSelectedOrder = orderDetail;
    }
  }

  const { data: orders, count } = await supabase
    .from("orders")
    .select(
      `*, dealer:profiles!dealer_id(id, full_name, phone), organization:organizations!organization_id(id, name, city, state)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(0, 14);

  return (
    <OrdersClient
      initialOrders={orders || []}
      initialCount={count || 0}
      initialSelectedOrder={initialSelectedOrder}
    />
  );
}
