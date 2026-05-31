"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useLoader } from "@/components/providers/LoaderProvider";
import { createClient } from "@/utils/supabase/client";
import { toast } from "react-hot-toast";
import { User, Phone, Shield, CheckCircle, RefreshCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

export default function ProfileClient({ initialProfile }) {
  const [profile, setProfile] = useState(initialProfile || {});
  const [fullName, setFullName] = useState(initialProfile?.full_name || "");
  const { isLoading, setLoading } = useLoader();
  const supabase = createClient();
  const router = useRouter();

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error("Full Name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      setProfile((prev) => ({ ...prev, full_name: fullName.trim() }));
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <PageHeader title="My Profile" />

      <div className="p-6 flex-1 overflow-auto flex items-start justify-center">
        <div className="max-w-xl w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <div className="bg-gray-50/50 p-6 border-b border-gray-200 flex flex-col sm:flex-row items-center gap-5">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-sm shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                getInitials(profile?.full_name)
              )}
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h2 className="text-xl font-bold text-gray-900 leading-snug">{profile?.full_name || "Unnamed User"}</h2>
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-1">
                <Badge className="bg-blue-50 text-blue-600 border-0 font-bold text-[10px] tracking-wider uppercase">
                  <Shield size={10} className="mr-0.5 inline" /> {profile?.role || "Member"}
                </Badge>
                <Badge className="bg-green-50 text-green-600 border-0 font-bold text-[10px] tracking-wider uppercase">
                  <CheckCircle size={10} className="mr-0.5 inline" /> {profile?.status || "Active"}
                </Badge>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-phone" className="font-bold text-gray-700 text-xs uppercase tracking-wider block">Phone Number</Label>
                <div className="flex">
                  <div className="flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-400 text-sm rounded-l-lg font-semibold select-none">
                    +91
                  </div>
                  <Input
                    id="profile-phone"
                    value={profile?.phone || ""}
                    disabled
                    className="rounded-l-none bg-gray-50 text-gray-500 font-medium border-gray-200 cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  Your phone number is locked as your secure system login ID.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-name" className="font-bold text-gray-700 text-xs uppercase tracking-wider block">Full Name</Label>
                <Input
                  id="profile-name"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="focus-visible:ring-black border-gray-200 text-sm h-10 font-semibold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
              <Button
                type="submit"
                className="bg-black hover:bg-gray-800 text-white font-semibold flex items-center gap-1.5 h-10 px-5 shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCcw size={15} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={15} /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
