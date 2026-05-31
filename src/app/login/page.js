"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpHash, setOtpHash] = useState("");
  const [step, setStep] = useState(1); // 1: Phone, 2: OTP, 3: Invite Code
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit number");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send OTP.");

      setOtpHash(data.otpHash);
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let isSuccess = false;

    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, otp, otpHash },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Verification failed");

      // Complete sign-in using magic link token
      if (data.token_hash && data.email) {
        const { error: signInError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });

        if (signInError) throw new Error("Failed to create session");

        // Verify admin or admin team member access
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User session not found.");

        const { data: accessData } = await supabase.rpc('can_access_admin_portal', { p_user_id: user.id });
        
        if (accessData?.allowed) {
          isSuccess = true;
          router.push("/");
          router.refresh();
          return;
        }

        // If the account is suspended/blocked, throw the specific block error directly!
        if (accessData?.error && (accessData.error.toLowerCase().includes("blocked") || accessData.error.toLowerCase().includes("suspended"))) {
          await supabase.auth.signOut();
          throw new Error(accessData.error);
        }

        // Access not allowed yet — check if there is a pending admin invitation (organization_id IS NULL) for this phone using secure RPC
        const { data: hasInvite, error: inviteError } = await supabase.rpc('has_pending_admin_invitation', {
          p_user_id: user.id,
          p_phone: phone
        });

        if (!inviteError && hasInvite) {
          // Go to Step 3 to let them input their invite code
          setStep(3);
          setLoading(false);
          return;
        }

        // If no pending invite, deny access and sign out
        await supabase.auth.signOut();
        throw new Error("Access denied. Admin privileges or pending admin invitation required.");
      } else {
        throw new Error("Invalid verification response.");
      }
    } catch (err) {
      setError(err.message || "Failed to verify OTP.");
    } finally {
      if (!isSuccess) {
        setLoading(false);
      }
    }
  };

  const handleAcceptInvite = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    let isSuccess = false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User session not found. Please log in again.");

      // Accept invitation
      const { data, error: acceptError } = await supabase.rpc('accept_invitation', {
        p_invite_code: inviteCode,
        p_user_id: user.id
      });

      if (acceptError) throw acceptError;
      if (data && !data.success) throw new Error(data.error || "Invalid or expired invite code.");

      // Re-verify admin team access
      const { data: accessData } = await supabase.rpc('can_access_admin_portal', { p_user_id: user.id });
      
      if (!accessData?.allowed) {
        await supabase.auth.signOut();
        throw new Error(accessData?.error || "Access denied after accepting invitation.");
      }

      isSuccess = true;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Failed to verify invite code.");
    } finally {
      if (!isSuccess) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="space-y-2 text-center pb-8 pt-8">
          <div className="mx-auto w-12 h-12 bg-black rounded-xl flex items-center justify-center mb-2">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Magtus Admin</CardTitle>
          <CardDescription className="text-sm text-gray-500">
            {step === 1 && "Sign in via WhatsApp OTP to manage the platform"}
            {step === 2 && "Enter the 6-digit code sent to your WhatsApp"}
            {step === 3 && "You have a pending admin team invitation! Enter your invite code below to join."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-md text-center">
              {error}
            </div>
          )}
          
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex">
                  <div className="flex items-center px-3 border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm rounded-l-md font-medium">
                    +91
                  </div>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="9876543210" 
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
                      setError("");
                    }}
                    className="rounded-l-none focus-visible:ring-black"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white mt-6" disabled={phone.length !== 10 || loading}>
                {loading ? "Sending..." : "Send WhatsApp OTP"}
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input 
                  id="otp" 
                  type="text" 
                  placeholder="000000" 
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                    setError("");
                  }}
                  className="text-center tracking-widest text-lg font-mono focus-visible:ring-black"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white mt-6" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full mt-2 text-sm text-gray-500 hover:text-black" 
                onClick={() => { setStep(1); setOtp(""); }}
                disabled={loading}
              >
                Use a different number
              </Button>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleAcceptInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <Input 
                  id="inviteCode" 
                  type="text" 
                  placeholder="INV-XXXXXXXX" 
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.trim().toUpperCase());
                    setError("");
                  }}
                  className="text-center tracking-widest text-lg font-mono focus-visible:ring-black uppercase"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-black hover:bg-gray-800 text-white mt-6" disabled={loading}>
                {loading ? "Joining Team..." : "Verify Invite Code"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full mt-2 text-sm text-gray-500 hover:text-black" 
                onClick={() => { setStep(1); setInviteCode(""); }}
                disabled={loading}
              >
                Go Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
