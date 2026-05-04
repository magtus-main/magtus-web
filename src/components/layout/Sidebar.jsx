import Link from "next/link";
import { LayoutDashboard, Package, ShoppingCart, Settings, Users, Image as ImageIcon, Box, Phone, MessageSquare, BarChart2 } from "lucide-react";

export default function Sidebar() {
  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Package, label: "Products", href: "/products" },
    { icon: ShoppingCart, label: "Orders", href: "/orders" },
    { icon: Users, label: "Users", href: "/users" },
    { icon: Box, label: "QR Codes", href: "/qrcodes" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <aside className="w-16 flex flex-col items-center py-6 bg-white border-r border-gray-200">
      <div className="mb-8">
        <div className="w-10 h-10 bg-black rounded-md flex items-center justify-center">
          <span className="text-white font-bold text-xl">M</span>
        </div>
      </div>

      <nav className="flex-1 w-full flex flex-col items-center gap-6">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <Link 
              key={index} 
              href={item.href}
              className="text-gray-400 hover:text-black transition-colors p-2 rounded-lg hover:bg-gray-50"
              title={item.label}
            >
              <Icon size={22} strokeWidth={1.5} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
