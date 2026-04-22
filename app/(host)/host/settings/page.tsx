"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/host/useSite";
import { Button, Input, Badge } from "@/components/ui";
import { mutate } from "swr";

const NIGERIAN_BANKS = [
  "Access Bank",
  "First Bank",
  "GTBank",
  "Zenith Bank",
  "UBA",
  "FCMB",
  "Stanbic IBTC",
  "Fidelity Bank",
  "Union Bank",
  "Wema Bank",
  "Sterling Bank",
  "Polaris Bank",
  "Keystone Bank",
  "Citibank",
  "Ecobank",
  "Heritage Bank",
  "Providus Bank",
  "SunTrust Bank",
  "Titan Trust Bank",
  "Unity Bank",
  "Jaiz Bank",
  "Kuda Bank",
  "OPay",
  "PalmPay",
] as const;

const profileSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

const bankSchema = z.object({
  bank_name: z.string().min(1, "Select a bank"),
  bank_account_number: z
    .string()
    .regex(/^\d{10}$/, "Account number must be 10 digits"),
  bank_account_name: z.string().min(2, "Enter the account name"),
});

type ProfileValues = z.infer<typeof profileSchema>;
type BankValues = z.infer<typeof bankSchema>;

export default function SettingsPage() {
  const router = useRouter();
  const profile = useUser();
  const { data: site } = useSite();
  const [profileSaving, setProfileSaving] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      email: profile?.email ?? "",
    },
  });

  const bankForm = useForm<BankValues>({
    resolver: zodResolver(bankSchema),
    values: {
      bank_name: profile?.bank_name ?? "",
      bank_account_number: profile?.bank_account_number ?? "",
      bank_account_name: profile?.bank_account_name ?? "",
    },
  });

  const saveProfile = async (values: ProfileValues) => {
    if (!profile?.id) return;
    setProfileSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name, email: values.email || null })
        .eq("id", profile.id);
      if (error) throw error;
      mutate(["profile", profile.id]);
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const saveBank = async (values: BankValues) => {
    if (!profile?.id) return;
    setBankSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          bank_name: values.bank_name,
          bank_account_number: values.bank_account_number,
          bank_account_name: values.bank_account_name,
        })
        .eq("id", profile.id);
      if (error) throw error;
      mutate(["profile", profile.id]);
      toast.success("Bank details saved");
    } catch {
      toast.error("Failed to save bank details");
    } finally {
      setBankSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/sign-in");
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
          Account
        </p>
        <h1 className="text-2xl font-display font-bold text-navy-900">
          Settings
        </h1>
      </div>

      {/* Account overview */}
      <div className="bg-navy-950 rounded-2xl p-5 mb-6 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-yellow-500 flex items-center justify-center text-navy-950 font-bold text-xl flex-shrink-0">
          {profile?.full_name?.[0]?.toUpperCase() ?? "H"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white truncate">
            {profile?.full_name ?? "Host"}
          </p>
          <p className="text-navy-400 text-xs font-mono mt-0.5">
            {profile?.phone ?? ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant="yellow">{profile?.role ?? "host"}</Badge>
          {profile?.kyc_status && (
            <Badge
              variant={
                profile.kyc_status === "verified"
                  ? "success"
                  : profile.kyc_status === "rejected"
                    ? "danger"
                    : "warning"
              }
            >
              KYC {profile.kyc_status}
            </Badge>
          )}
        </div>
      </div>

      {/* Site summary */}
      {site && (
        <div className="bg-white rounded-[12px] border border-navy-100 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-navy-400 mb-0.5">
              Installation
            </p>
            <p className="text-sm font-medium text-navy-900">{site.address}</p>
            <p className="text-xs text-navy-400 font-mono mt-0.5">
              {site.solar_capacity_kw} kW solar ·{" "}
              {site.battery_capacity_kwh} kWh battery
            </p>
          </div>
          <Badge
            variant={site.status === "active" ? "success" : "warning"}
            dot={site.status === "active"}
          >
            {site.status}
          </Badge>
        </div>
      )}

      {/* Profile form */}
      <section className="mb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-3">
          Personal Info
        </h2>
        <form
          onSubmit={profileForm.handleSubmit(saveProfile)}
          className="bg-white rounded-[12px] border border-navy-100 p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Full Name
            </label>
            <Input {...profileForm.register("full_name")} />
            {profileForm.formState.errors.full_name && (
              <p className="text-red-500 text-xs mt-1">
                {profileForm.formState.errors.full_name.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Email (optional)
            </label>
            <Input
              type="email"
              placeholder="you@example.com"
              {...profileForm.register("email")}
            />
          </div>
          <Button type="submit" size="sm" disabled={profileSaving}>
            {profileSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </form>
      </section>

      {/* Bank details form */}
      <section className="mb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-3">
          Bank Details
        </h2>
        <form
          onSubmit={bankForm.handleSubmit(saveBank)}
          className="bg-white rounded-[12px] border border-navy-100 p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Bank
            </label>
            <select
              className="w-full h-11 px-3 rounded-[12px] border border-navy-200 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
              {...bankForm.register("bank_name")}
            >
              <option value="">Select bank</option>
              {NIGERIAN_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {bankForm.formState.errors.bank_name && (
              <p className="text-red-500 text-xs mt-1">
                {bankForm.formState.errors.bank_name.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Account Number
            </label>
            <Input
              className="font-mono"
              placeholder="0123456789"
              maxLength={10}
              {...bankForm.register("bank_account_number")}
            />
            {bankForm.formState.errors.bank_account_number && (
              <p className="text-red-500 text-xs mt-1">
                {bankForm.formState.errors.bank_account_number.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-navy-700 mb-1.5">
              Account Name
            </label>
            <Input
              placeholder="As it appears on the account"
              {...bankForm.register("bank_account_name")}
            />
            {bankForm.formState.errors.bank_account_name && (
              <p className="text-red-500 text-xs mt-1">
                {bankForm.formState.errors.bank_account_name.message}
              </p>
            )}
          </div>
          <Button type="submit" size="sm" disabled={bankSaving}>
            {bankSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save Bank Details"
            )}
          </Button>
        </form>
      </section>

      {/* Other links */}
      <div className="space-y-2 mb-6">
        <button
          onClick={() => router.push("/host/support")}
          className="w-full flex items-center justify-between bg-white rounded-[12px] border border-navy-100 p-4 hover:border-navy-200 transition-colors"
        >
          <span className="text-sm font-medium text-navy-900">
            Help &amp; Support
          </span>
          <ChevronRight className="h-4 w-4 text-navy-300" />
        </button>
        <button
          onClick={() => router.push("/host/settings/notifications")}
          className="w-full flex items-center justify-between bg-white rounded-[12px] border border-navy-100 p-4 hover:border-navy-200 transition-colors"
        >
          <span className="text-sm font-medium text-navy-900">
            Notification Preferences
          </span>
          <ChevronRight className="h-4 w-4 text-navy-300" />
        </button>
      </div>

      {/* Sign out */}
      <Button
        variant="secondary"
        className="w-full border-red-200 text-red-600 hover:bg-red-50"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4 mr-2" />
        )}
        Sign Out
      </Button>
    </div>
  );
}
