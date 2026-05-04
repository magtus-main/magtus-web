"use client";

import React, { useState } from "react";
import {
  Building,
  ShieldCheck,
  CreditCard,
  Bell,
  Settings2,
  Save,
  Star,
  Gift,
  QrCode,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLoader } from "@/components/providers/LoaderProvider";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/layout/PageHeader";

export default function SettingsClient({ initialSettings }) {
  const [activeSection, setActiveSection] = useState("company");
  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();

  // Helper to get a setting value from the key-value map
  const getSetting = (key, fallback = "") => {
    const val = initialSettings?.[key];
    if (val === undefined || val === null) return fallback;
    // value is JSONB — could be a string, number, etc.
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  // Company Info (these are custom keys we'll create)
  const [companyName, setCompanyName] = useState(getSetting("company_name", "Magtus Hardware"));
  const [supportEmail, setSupportEmail] = useState(getSetting("support_email", ""));
  const [supportPhone, setSupportPhone] = useState(getSetting("support_phone", ""));
  const [currency, setCurrency] = useState(getSetting("currency", "INR"));
  const [timezone, setTimezone] = useState(getSetting("timezone", "Asia/Kolkata"));

  // Rewards Policy (these match existing DB keys)
  const [dealerPointsPerRupee, setDealerPointsPerRupee] = useState(
    getSetting("dealer_points_per_rupee", "1")
  );
  const [maxScansPerDay, setMaxScansPerDay] = useState(
    getSetting("max_scans_per_day", "50")
  );
  const [minRedeemPoints, setMinRedeemPoints] = useState(
    getSetting("min_redemption_points", "100")
  );
  const [scanCooldownSeconds, setScanCooldownSeconds] = useState(
    getSetting("scan_cooldown_seconds", "30")
  );

  // Helper to upsert multiple settings as key/value rows
  const upsertSettings = async (entries) => {
    const rows = entries.map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }));
    for (const row of rows) {
      const { error } = await supabase
        .from("app_settings")
        .upsert(row, { onConflict: "key" });
      if (error) throw error;
    }
  };

  const handleSaveCompany = async () => {
    try {
      setLoading(true);
      await upsertSettings([
        ["company_name", companyName],
        ["support_email", supportEmail],
        ["support_phone", supportPhone],
        ["currency", currency],
        ["timezone", timezone],
      ]);
      toast.success("Company settings saved!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRewards = async () => {
    try {
      setLoading(true);
      await upsertSettings([
        ["dealer_points_per_rupee", parseFloat(dealerPointsPerRupee) || 1],
        ["max_scans_per_day", parseInt(maxScansPerDay) || 50],
        ["min_redemption_points", parseInt(minRedeemPoints) || 100],
        ["scan_cooldown_seconds", parseInt(scanCooldownSeconds) || 30],
      ]);
      toast.success("Rewards policy saved!");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  const navItems = [
    { id: "company", icon: Building, label: "Company Info" },
    { id: "rewards", icon: Star, label: "Rewards Policy" },
    { id: "notifications", icon: Bell, label: "Notifications" },
    { id: "preferences", icon: Settings2, label: "Preferences" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      <PageHeader title="Settings">
        <button
          onClick={() => setActiveSection("company")}
          className={`h-full flex items-center border-b-2 transition-colors ${
            activeSection === "company"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveSection("rewards")}
          className={`h-full flex items-center border-b-2 transition-colors ${
            activeSection === "rewards"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-gray-500 hover:text-primary hover:border-primary/30"
          }`}
        >
          Rewards Policy
        </button>
      </PageHeader>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-col flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-8 flex-1 overflow-auto flex">
            {/* Sidebar */}
            <div className="w-56 border-r border-gray-100 pr-6 hidden md:block flex-shrink-0">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors text-left ${
                        activeSection === item.id
                          ? "bg-primary/5 text-primary font-semibold"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 font-medium"
                      }`}
                    >
                      <Icon size={16} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content */}
            <div className="flex-1 md:pl-8 max-w-3xl">
              {/* Company Section */}
              {activeSection === "company" && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900">Company Information</h2>
                    <p className="text-sm text-gray-500 mt-1">Update your company details and platform configuration.</p>
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Company Name</Label>
                        <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-gray-50 focus-visible:bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Support Email</Label>
                        <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="bg-gray-50 focus-visible:bg-white" placeholder="support@magtus.com" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Support Phone</Label>
                        <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} className="bg-gray-50 focus-visible:bg-white" placeholder="+91 9876543210" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-gray-700">Platform Logo</Label>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">M</span>
                          </div>
                          <button className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded bg-white hover:bg-gray-50 transition-colors">Change Logo</button>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900 mb-4">Regional Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="font-semibold text-gray-700">Default Currency</Label>
                          <select
                            className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                          >
                            <option value="INR">INR (₹)</option>
                            <option value="USD">USD ($)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-semibold text-gray-700">Timezone</Label>
                          <select
                            className="w-full h-10 px-3 border border-gray-200 rounded-md text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                          >
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="UTC">UTC</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Rewards Section */}
              {activeSection === "rewards" && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900">Rewards Policy Configuration</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure how reward points are earned, spent, and managed.</p>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-900 mb-1">Hybrid Reward Model</p>
                      <p className="text-xs text-blue-700">
                        <strong>Carpenters</strong> earn points by scanning QR codes inside product boxes. <strong>Dealers</strong> earn points automatically based on purchase order value.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <CreditCard size={18} />
                          <h3 className="font-bold text-sm">Dealer Points</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Points per ₹1 Spent</Label>
                          <Input
                            type="number"
                            value={dealerPointsPerRupee}
                            onChange={(e) => setDealerPointsPerRupee(e.target.value)}
                            className="bg-gray-50 focus-visible:bg-white"
                            placeholder="1"
                          />
                          <p className="text-[11px] text-gray-400">e.g. 1 = ₹50,000 order earns 50,000 pts</p>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <QrCode size={18} />
                          <h3 className="font-bold text-sm">Carpenter Scan Limits</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Max Scans per Day</Label>
                          <Input
                            type="number"
                            value={maxScansPerDay}
                            onChange={(e) => setMaxScansPerDay(e.target.value)}
                            className="bg-gray-50 focus-visible:bg-white"
                            placeholder="10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cooldown Between Scans (seconds)</Label>
                          <Input
                            type="number"
                            value={scanCooldownSeconds}
                            onChange={(e) => setScanCooldownSeconds(e.target.value)}
                            className="bg-gray-50 focus-visible:bg-white"
                            placeholder="30"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Gift size={18} />
                          <h3 className="font-bold text-sm">Redemption Rules</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Minimum Points to Redeem</Label>
                          <Input
                            type="number"
                            value={minRedeemPoints}
                            onChange={(e) => setMinRedeemPoints(e.target.value)}
                            className="bg-gray-50 focus-visible:bg-white"
                            placeholder="500"
                          />
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <Settings2 size={18} />
                          <h3 className="font-bold text-sm">Tax Settings</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">GST Percentage</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">18%</span>
                            <span className="text-xs text-gray-400">(configured in app_settings)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === "notifications" && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure when and how notifications are sent.</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "New Order Placed", desc: "Get notified when a dealer places an order" },
                      { label: "QR Code Scanned", desc: "Get notified when a carpenter scans a QR code" },
                      { label: "Redemption Request", desc: "Get notified when a user requests point redemption" },
                      { label: "Low Stock Alert", desc: "Get notified when product stock falls below threshold" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferences Section */}
              {activeSection === "preferences" && (
                <div>
                  <div className="mb-8">
                    <h2 className="text-lg font-bold text-gray-900">App Preferences</h2>
                    <p className="text-sm text-gray-500 mt-1">Customize the admin dashboard behavior.</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "Dark Mode", desc: "Use dark theme for the admin dashboard" },
                      { label: "Auto-refresh Data", desc: "Automatically refresh dashboard data every 30 seconds" },
                      { label: "Show Hindi Names", desc: "Display Hindi translations alongside English" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                        </div>
                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Save Footer */}
          <div className="border-t border-gray-200 p-4 flex justify-end bg-gray-50/50 flex-shrink-0">
            <Button
              onClick={activeSection === "rewards" ? handleSaveRewards : handleSaveCompany}
              className="bg-primary hover:bg-primary/90 text-white text-xs font-semibold tracking-wider"
              disabled={isLoading}
            >
              <Save size={14} className="mr-2" /> {isLoading ? "SAVING..." : "SAVE CHANGES"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
