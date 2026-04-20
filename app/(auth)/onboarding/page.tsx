"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ProgressSteps } from "@/components/ui/progress-steps";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";
import { CheckCircle2, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ─── Data ──────────────────────────────────────────────────────────────────

const LAGOS_AREAS = [
  "Victoria Island", "Lekki Phase 1", "Lekki Phase 2", "Ajah", "Ibeju-Lekki",
  "Ikeja", "Maryland", "Gbagada", "Ojota", "Ketu", "Mile 12",
  "Yaba", "Surulere", "Festac", "Apapa", "Ikoyi", "Oniru",
  "Sangotedo", "Lagos Island", "Other",
];

const BANKS = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank",
  "First Bank of Nigeria", "First City Monument Bank (FCMB)",
  "Guaranty Trust Bank (GTB)", "Heritage Bank", "Keystone Bank",
  "Polaris Bank", "Providus Bank", "Stanbic IBTC Bank",
  "Sterling Bank", "UBA (United Bank for Africa)", "Union Bank",
  "Unity Bank", "Wema Bank", "Zenith Bank",
  "Kuda Bank", "Moniepoint", "Opay", "PalmPay", "VFD Microfinance Bank",
];

const STEPS = ["Basic info", "Site details", "Bank details", "KYC upload"];

// ─── Step 1: Basic Info ───────────────────────────────────────────────────

function StepBasic({ onNext }: { onNext: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (!email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) e.email = "Enter a valid email";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not signed in"); return; }
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), email: email.trim() })
        .eq("id", user.id);
      if (error) { toast.error("Update failed", error.message); return; }
      onNext();
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Full Name"
        placeholder="Tunde Adeyemi"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        error={errors.fullName}
        hint="As it appears on your government ID"
        disabled={loading}
      />
      <Input
        label="Email Address"
        type="email"
        placeholder="tunde@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        hint="For receipts and important notices"
        disabled={loading}
      />
      <Button type="submit" size="lg" className="w-full h-12 font-bold" loading={loading}>
        Continue
      </Button>
    </form>
  );
}

// ─── Step 2: Site Details ─────────────────────────────────────────────────

function StepSite({ onNext }: { onNext: () => void }) {
  const [address, setAddress] = useState("");
  const [lagosArea, setLagosArea] = useState("");
  const [hasSolar, setHasSolar] = useState<boolean | null>(null);
  const [capacity, setCapacity] = useState("");
  const [batteryKwh, setBatteryKwh] = useState("");
  const [neighborCount, setNeighborCount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!address.trim() || address.trim().length < 10) e.address = "Enter your full address";
    if (!lagosArea) e.lagosArea = "Select your area";
    if (hasSolar === null) e.hasSolar = "Select your current solar status";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          lagosArea,
          hasSolar: hasSolar!,
          solarCapacityKw: capacity ? parseFloat(capacity) : undefined,
          batteryCapacityKwh: batteryKwh ? parseFloat(batteryKwh) : undefined,
          estimatedNeighborCount: neighborCount ? parseInt(neighborCount) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error("Site save failed", data.error); return; }
      onNext();
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-navy-900 font-sans">Lagos Area</label>
        <select
          value={lagosArea}
          onChange={(e) => setLagosArea(e.target.value)}
          disabled={loading}
          className={cn(
            "h-11 w-full rounded-[12px] border bg-white px-4 text-sm font-sans text-navy-900",
            "focus:outline-none focus:ring-2 focus:ring-navy-900 transition-all",
            errors.lagosArea ? "border-red-500" : "border-navy-100",
          )}
        >
          <option value="">Select area…</option>
          {LAGOS_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {errors.lagosArea && <p className="text-xs text-red-500">{errors.lagosArea}</p>}
      </div>

      <Input
        label="Full Address"
        placeholder="12 Admiralty Way, Lekki Phase 1, Lagos"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        error={errors.address}
        disabled={loading}
      />

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-navy-900 font-sans">
          Do you already have solar installed?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setHasSolar(v)}
              className={cn(
                "h-11 rounded-[12px] border text-sm font-medium transition-all",
                hasSolar === v
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-white text-navy-900 border-navy-100 hover:bg-navy-50",
                errors.hasSolar && hasSolar === null && "border-red-500",
              )}
            >
              {v ? "Yes, I have solar" : "No, I need full install"}
            </button>
          ))}
        </div>
        {errors.hasSolar && <p className="text-xs text-red-500">{errors.hasSolar}</p>}
      </div>

      {hasSolar && (
        <div className="grid grid-cols-2 gap-4 pt-2">
          <Input
            label="Solar Capacity (kW)"
            placeholder="8"
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            hint="Optional estimate"
            disabled={loading}
          />
          <Input
            label="Battery (kWh)"
            placeholder="10"
            type="number"
            value={batteryKwh}
            onChange={(e) => setBatteryKwh(e.target.value)}
            hint="Optional estimate"
            disabled={loading}
          />
        </div>
      )}

      <Input
        label="Estimated Neighbors to Power"
        placeholder="3"
        type="number"
        value={neighborCount}
        onChange={(e) => setNeighborCount(e.target.value)}
        hint="How many nearby units could you power?"
        disabled={loading}
      />

      <Button type="submit" size="lg" className="w-full h-12 font-bold" loading={loading}>
        Continue
      </Button>
    </form>
  );
}

// ─── Step 3: Bank Details ─────────────────────────────────────────────────

function StepBank({ onNext }: { onNext: () => void }) {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!bankName) e.bankName = "Select your bank";
    if (!/^\d{10}$/.test(accountNumber)) e.accountNumber = "Must be a 10-digit NUBAN number";
    if (!accountName.trim()) e.accountName = "Enter account name as on your bank card";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not signed in"); return; }
      const { error } = await supabase.from("profiles").update({
        bank_name: bankName,
        bank_account_number: accountNumber,
        bank_account_name: accountName.trim(),
      }).eq("id", user.id);
      if (error) { toast.error("Update failed", error.message); return; }
      onNext();
    } catch { toast.error("Something went wrong"); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-navy-600 font-sans bg-yellow-50 border border-yellow-200 rounded-xl p-3">
        Earnings are paid out to this account weekly. Account validation (Paystack) coming in a future update.
      </p>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-navy-900 font-sans">Bank</label>
        <select
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          disabled={loading}
          className={cn(
            "h-11 w-full rounded-[12px] border bg-white px-4 text-sm font-sans text-navy-900",
            "focus:outline-none focus:ring-2 focus:ring-navy-900 transition-all",
            errors.bankName ? "border-red-500" : "border-navy-100",
          )}
        >
          <option value="">Select bank…</option>
          {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {errors.bankName && <p className="text-xs text-red-500">{errors.bankName}</p>}
      </div>

      <Input
        label="Account Number"
        placeholder="0123456789"
        inputMode="numeric"
        maxLength={10}
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
        error={errors.accountNumber}
        hint="10-digit NUBAN"
        disabled={loading}
      />

      <Input
        label="Account Name"
        placeholder="ADEYEMI OLUWATUNDE"
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
        error={errors.accountName}
        hint="Exactly as it appears on your bank account"
        disabled={loading}
      />

      <Button type="submit" size="lg" className="w-full h-12 font-bold" loading={loading}>
        Continue
      </Button>
    </form>
  );
}

// ─── Step 4: KYC Upload ───────────────────────────────────────────────────

type UploadState = { file: File | null; url: string | null; uploading: boolean; error: string };

const defaultUpload = (): UploadState => ({ file: null, url: null, uploading: false, error: "" });

function FileUploadField({
  label,
  hint,
  state,
  onFileChange,
}: {
  label: string;
  hint: string;
  state: UploadState;
  onFileChange: (f: File) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-navy-900 font-sans">{label}</label>
      <label
        className={cn(
          "flex flex-col items-center justify-center gap-2 h-28",
          "rounded-2xl border-2 border-dashed cursor-pointer transition-all",
          state.url
            ? "border-green-400 bg-green-50"
            : state.error
              ? "border-red-400 bg-red-50"
              : "border-navy-100 bg-navy-50/50 hover:bg-yellow-50 hover:border-yellow-300",
        )}
      >
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }}
          disabled={state.uploading}
        />
        {state.uploading ? (
          <div className="text-xs text-navy-500 animate-pulse">Uploading…</div>
        ) : state.url ? (
          <>
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <span className="text-xs text-green-700 font-medium">{state.file?.name}</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-navy-400" />
            <span className="text-xs text-navy-500">Tap to upload · JPG, PNG or PDF</span>
            <span className="text-[10px] text-navy-400">{hint}</span>
          </>
        )}
      </label>
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}
    </div>
  );
}

function StepKyc({ onNext }: { onNext: () => void }) {
  const [govId, setGovId] = useState<UploadState>(defaultUpload());
  const [utilityBill, setUtilityBill] = useState<UploadState>(defaultUpload());
  const [submitting, setSubmitting] = useState(false);

  const uploadFile = useCallback(
    async (
      file: File,
      field: "gov_id" | "utility_bill",
      setState: React.Dispatch<React.SetStateAction<UploadState>>,
    ) => {
      setState((s) => ({ ...s, file, uploading: true, error: "" }));
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setState((s) => ({ ...s, uploading: false, error: "Not signed in" })); return; }

        const ext = file.name.split(".").pop();
        const path = `${user.id}/${field}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("kyc-documents")
          .upload(path, file, { upsert: true });

        if (uploadErr) {
          setState((s) => ({ ...s, uploading: false, error: uploadErr.message }));
          return;
        }
        setState((s) => ({ ...s, uploading: false, url: path }));
      } catch {
        setState((s) => ({ ...s, uploading: false, error: "Upload failed" }));
      }
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!govId.url || !utilityBill.url) {
      if (!govId.url) setGovId((s) => ({ ...s, error: "Required" }));
      if (!utilityBill.url) setUtilityBill((s) => ({ ...s, error: "Required" }));
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not signed in"); return; }
      await supabase.from("profiles").update({
        kyc_documents: { gov_id: govId.url, utility_bill: utilityBill.url },
        kyc_status: "pending",
      }).eq("id", user.id);
      onNext();
    } catch { toast.error("Something went wrong"); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-navy-600 font-sans">
        KYC is required to receive payouts. Documents are reviewed by our team within 24 hours.
      </p>

      <FileUploadField
        label="Government-issued ID"
        hint="NIN slip, Int'l passport, Driver's license or Voter's card"
        state={govId}
        onFileChange={(f) => uploadFile(f, "gov_id", setGovId)}
      />
      <FileUploadField
        label="Utility Bill"
        hint="EKEDC / IKEDC bill from the last 3 months"
        state={utilityBill}
        onFileChange={(f) => uploadFile(f, "utility_bill", setUtilityBill)}
      />

      <Button
        type="submit"
        size="lg"
        className="w-full h-12 font-bold"
        loading={submitting}
        disabled={govId.uploading || utilityBill.uploading}
      >
        Submit for review
      </Button>
    </form>
  );
}

// ─── Completion ──────────────────────────────────────────────────────────

function StepComplete() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center text-center space-y-6 py-4">
      <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-display font-bold text-navy-950">
          You&apos;re all set!
        </h2>
        <p className="text-navy-600 font-sans max-w-xs text-sm">
          Your application is under review. We&apos;ll contact you within 24 hours to schedule your grid consultation.
        </p>
      </div>
      <Button
        size="lg"
        className="w-full h-12 font-bold"
        onClick={() => router.replace("/host/home")}
      >
        Go to my dashboard
      </Button>
    </div>
  );
}

// ─── Main Onboarding Page ────────────────────────────────────────────────

function OnboardingContent() {
  const router = useRouter();
  const params = useSearchParams();
  const currentStep = Math.max(1, Math.min(5, parseInt(params.get("step") ?? "1", 10)));

  const goToStep = (step: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(step));
    router.push(url.pathname + url.search);
  };

  // Verify the user is actually signed in.
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/sign-in");
    });
  }, [router]);

  const isComplete = currentStep === 5;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-display font-bold text-navy-950">
          {isComplete ? "Application submitted" : "Let's set up your grid"}
        </h1>
        {!isComplete && (
          <p className="text-sm text-navy-500 font-sans">
            Step {currentStep} of {STEPS.length}
          </p>
        )}
      </div>

      {!isComplete && (
        <ProgressSteps steps={STEPS} current={currentStep} />
      )}

      {currentStep === 1 && <StepBasic onNext={() => goToStep(2)} />}
      {currentStep === 2 && <StepSite onNext={() => goToStep(3)} />}
      {currentStep === 3 && <StepBank onNext={() => goToStep(4)} />}
      {currentStep === 4 && <StepKyc onNext={() => goToStep(5)} />}
      {currentStep === 5 && <StepComplete />}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse bg-navy-50 rounded-2xl" />}>
      <OnboardingContent />
    </Suspense>
  );
}
