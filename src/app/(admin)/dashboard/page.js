import { Users, ShoppingBag, CreditCard, Activity, TrendingUp, Package, QrCode, ArrowUpRight, Gift, Megaphone, Star } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import PageHeader from "@/components/layout/PageHeader";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getDashboardData() {
  const cookieStore = await cookies();
  const supabase = await createClient(cookieStore);
  const [
    { count: totalUsers },
    { count: totalDealers },
    { count: totalCarpenters },
    { count: totalProducts },
    { count: totalOrders },
    { count: pendingOrders },
    { count: totalQRCodes },
    { count: scannedQRCodes },
    { count: activeOffers },
    { count: pendingRedemptions },
    revenueData,
    pointsData,
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'dealer'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'carpenter'),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('qr_codes').select('*', { count: 'exact', head: true }),
    supabase.from('qr_codes').select('*', { count: 'exact', head: true }).eq('status', 'scanned'),
    supabase.from('offers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('redemption_requests').select('*', { count: 'exact', head: true }).eq('status', 'requested'),
    supabase.from('orders').select('total').in('status', ['confirmed', 'processing', 'shipped', 'delivered']),
    supabase.from('profiles').select('total_points'),
    supabase.from('orders')
      .select('id, order_number, status, total, created_at, dealer:profiles!dealer_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const totalRevenue = (revenueData.data || []).reduce((sum, o) => sum + (o.total || 0), 0);
  const totalPointsIssued = (pointsData.data || []).reduce((sum, p) => sum + (p.total_points || 0), 0);

  return {
    stats: {
      totalUsers: totalUsers || 0,
      totalDealers: totalDealers || 0,
      totalCarpenters: totalCarpenters || 0,
      totalProducts: totalProducts || 0,
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      totalRevenue: totalRevenue || 0,
      totalPointsIssued: totalPointsIssued || 0,
      totalQRCodes: totalQRCodes || 0,
      scannedQRCodes: scannedQRCodes || 0,
      activeOffers: activeOffers || 0,
      pendingRedemptions: pendingRedemptions || 0,
    },
    recentOrders: recentOrders || [],
  };
}

export default async function Dashboard() {
  const { stats, recentOrders } = await getDashboardData();

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, detail: `${stats.totalDealers} dealers · ${stats.totalCarpenters} carpenters`, icon: Users },
    { label: "Products", value: stats.totalProducts, detail: "", icon: Package },
    { label: "Total Orders", value: stats.totalOrders, detail: `${stats.pendingOrders} pending`, icon: ShoppingBag },
    { label: "Revenue", value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, detail: "", icon: CreditCard },
    { label: "QR Codes", value: stats.totalQRCodes, detail: `${stats.scannedQRCodes} scanned`, icon: QrCode },
    { label: "Points Issued", value: stats.totalPointsIssued.toLocaleString('en-IN'), detail: "", icon: Star },
    { label: "Active Offers", value: stats.activeOffers, detail: "", icon: Megaphone },
    { label: "Pending Redeems", value: stats.pendingRedemptions, detail: "", icon: Gift },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        tabs={[{ label: "Stats & Analytics", href: "/" }]}
      />
      <div className="p-6 space-y-6 flex-1 overflow-auto">


        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white p-6 rounded-lg border border-gray-200 flex flex-col justify-between shadow-sm min-h-[120px]">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-gray-50 rounded-md border border-gray-100">
                    <Icon size={20} className="text-black" />
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold leading-none">{stat.value}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">{stat.label}</p>
                  {stat.detail && <p className="text-[10px] text-gray-400 mt-1">{stat.detail}</p>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 flex-1 min-h-0">
          {/* Recent Orders */}
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col shadow-sm">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-bold text-sm tracking-wide text-gray-900">Recent Orders</h2>
              <button className="text-[10px] font-bold text-gray-400 uppercase tracking-wider hover:text-black flex items-center gap-1">
                View All <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="flex-1 p-5 overflow-auto">
              <div className="space-y-4">
                {recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No recent orders found.</p>
                ) : (
                  recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded border border-gray-100 flex items-center justify-center">
                          <Package size={18} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{order.dealer?.full_name || '—'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">₹{order.total?.toLocaleString('en-IN')}</p>
                        <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded mt-1 inline-block uppercase
                        ${order.status === 'pending' ? 'text-yellow-600 bg-yellow-50' :
                            order.status === 'confirmed' ? 'text-blue-600 bg-blue-50' :
                              'text-gray-600 bg-gray-50'}`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
