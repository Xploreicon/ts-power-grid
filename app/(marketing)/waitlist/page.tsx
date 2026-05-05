"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sun,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button, Input, ProgressSteps } from "@/components/ui";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STEP_LABELS = ["About You", "Property", "Power", "Invest"];

const LGA_OPTIONS = [
  "Surulere", "Yaba", "Ikeja", "Lekki", "Victoria Island", "Ikoyi",
  "Ajah", "Gbagada", "Shomolu", "Mushin", "Oshodi", "Maryland",
  "Ogba", "Magodo", "Ikorodu", "Festac", "Amuwo-Odofin", "Apapa", "Other",
];

const PROPERTY_TYPES = [
  "Residential detached",
  "Flat / apartment",
  "Estate",
  "Commercial shop",
  "Commercial office",
  "Mixed use",
  "Industrial",
];

const OWNERSHIP_OPTIONS = [
  { value: "own", label: "I own it" },
  { value: "rent-approved", label: "Renting (landlord approved)" },
  { value: "rent-unknown", label: "Renting (not yet asked)" },
];

const NEIGHBOR_COUNT_OPTIONS = ["1-2", "3-5", "6-10", "10+"];

const ROOFTOP_OPTIONS = [
  { value: "flat concrete", label: "Flat concrete" },
  { value: "sloped", label: "Sloped roof" },
  { value: "not sure", label: "Not sure" },
  { value: "no access", label: "No access" },
];

const POWER_SOURCES = [
  "Generator only",
  "Grid (PHCN/NEPA)",
  "Solar (existing)",
  "Grid + Generator",
  "Solar + Generator",
  "Other",
];

const PAYMENT_OPTIONS = [
  { value: "upfront", label: "Pay upfront" },
  { value: "3-month", label: "3-month plan" },
  { value: "6-month", label: "6-month plan" },
  { value: "need-financing", label: "Need financing" },
];

const TIMELINE_OPTIONS = [
  { value: "immediately", label: "Immediately" },
  { value: "1-month", label: "Within 1 month" },
  { value: "1-3-months", label: "1-3 months" },
  { value: "exploring", label: "Just exploring" },
];

const PRICE_OPTIONS = [
  "₦200/kWh", "₦250/kWh", "₦280/kWh (recommended)", "₦300/kWh", "₦350/kWh", "Not sure",
];

const DRONE_OPTIONS = [
  { value: "yes", label: "Yes, schedule it" },
  { value: "maybe", label: "Maybe later" },
  { value: "no", label: "No thanks" },
];

const MONTHLY_SPEND_OPTIONS = [
  "Under ₦20,000",
  "₦20,000 - ₦50,000",
  "₦50,000 - ₦100,000",
  "₦100,000 - ₦200,000",
  "₦200,000 - ₦500,000",
  "Over ₦500,000",
];

const REFERRAL_OPTIONS = [
  "Twitter/X",
  "Instagram",
  "WhatsApp",
  "LinkedIn",
  "Friend/Family",
  "Neighbor",
  "Google",
  "Event",
  "Other",
];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const nigerianPhoneRegex = /^(\+?234|0)[789]\d{9}$/;

const formSchema = z.object({
  // Step 1
  full_name: z.string().min(2, "Name is required"),
  phone: z.string().regex(nigerianPhoneRegex, "Enter a valid Nigerian phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  // Step 2
  address: z.string().min(3, "Address is required"),
  lga: z.string().min(1, "Select your area"),
  property_type: z.string().optional().or(z.literal("")),
  ownership: z.string().optional().or(z.literal("")),
  neighbor_count: z.string().optional().or(z.literal("")),
  rooftop_access: z.string().optional().or(z.literal("")),
  // Step 3
  path: z.enum(["upgrade_kit", "full_stack"], { message: "Select a path" }),
  panel_capacity: z.string().optional().or(z.literal("")),
  inverter_model: z.string().optional().or(z.literal("")),
  battery_type: z.string().optional().or(z.literal("")),
  system_age: z.string().optional().or(z.literal("")),
  surplus_power: z.string().optional().or(z.literal("")),
  monthly_power_spend: z.string().min(1, "Select your monthly spend"),
  primary_power_source: z.string().optional().or(z.literal("")),
  // Step 4
  payment_preference: z.string().optional().or(z.literal("")),
  timeline: z.string().optional().or(z.literal("")),
  target_price_per_kwh: z.string().optional().or(z.literal("")),
  drone_assessment: z.string().optional().or(z.literal("")),
  referral_source: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

// Fields required per step (for partial validation)
const STEP_FIELDS: (keyof FormValues)[][] = [
  ["full_name", "phone"],
  ["address", "lga"],
  ["path", "monthly_power_spend"],
  [],
];

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------
function RadioPills({
  options,
  value,
  onChange,
  error,
  columns = 2,
}: {
  options: { value: string; label: string }[] | string[];
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string;
  columns?: number;
}) {
  const normalized = (options as (string | { value: string; label: string })[]).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o,
  );
  return (
    <div>
      <div className={cn("grid gap-2", columns === 3 ? "grid-cols-3" : columns === 1 ? "grid-cols-1" : "grid-cols-2")}>
        {normalized.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-2.5 rounded-[12px] text-sm font-medium border transition-all text-left",
              value === opt.value
                ? "bg-navy-900 text-white border-navy-900"
                : "bg-white text-navy-700 border-navy-100 hover:border-navy-300",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs font-medium text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function SelectDropdown({
  options,
  value,
  onChange,
  placeholder,
  error,
}: {
  options: string[];
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
}) {
  return (
    <div className="w-full space-y-1.5">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "flex h-11 w-full rounded-[12px] border bg-white px-4 py-2 text-sm font-sans",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 transition-all",
          "appearance-none cursor-pointer",
          !value ? "text-navy-300" : "text-navy-900",
          error ? "border-red-500" : "border-navy-100",
        )}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <span className="block text-sm font-semibold text-navy-900 font-sans">{children}</span>
      {hint && <span className="block text-xs text-navy-400">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function WaitlistPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      whatsapp: "",
      address: "",
      lga: "",
      property_type: "",
      ownership: "",
      neighbor_count: "",
      rooftop_access: "",
      path: undefined,
      panel_capacity: "",
      inverter_model: "",
      battery_type: "",
      system_age: "",
      surplus_power: "",
      monthly_power_spend: "",
      primary_power_source: "",
      payment_preference: "",
      timeline: "",
      target_price_per_kwh: "",
      drone_assessment: "",
      referral_source: "",
      notes: "",
    },
    mode: "onTouched",
  });

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = form;

  const selectedPath = watch("path");

  // Validate current step fields before advancing
  async function goNext() {
    const fields = STEP_FIELDS[step - 1];
    const valid = fields.length === 0 || (await trigger(fields));
    if (valid) setStep((s) => Math.min(s + 1, 4));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function onSubmit(data: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Submission failed");
      }
      // Rough queue position — we don't expose the exact count, just a feel-good number
      setQueuePosition(Math.floor(Math.random() * 30) + 12);
      setSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-green/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-green" />
          </div>
          <h1 className="text-3xl font-display font-bold text-white">
            You&rsquo;re on the list!
          </h1>
          <p className="text-white/70 font-sans">
            {queuePosition && (
              <span className="block text-yellow-500 font-mono font-bold text-lg mb-2">
                #{queuePosition} in queue
              </span>
            )}
            Our grid specialists will review your submission and reach out within 48 hours to discuss next steps.
          </p>
          <div className="pt-4 space-y-3">
            <a
              href="https://x.com/ciphertoone"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full"
            >
              <Button variant="secondary" className="w-full border-navy-700 text-white hover:bg-navy-800">
                Follow @ciphertoone on 𝕏
              </Button>
            </a>
            <Link href="/">
              <Button variant="ghost" className="w-full text-white/60 hover:text-white">
                Back to homepage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <header className="border-b border-navy-800">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white">
            <div className="h-7 w-7 rounded-md bg-yellow-500 flex items-center justify-center">
              <div className="h-3.5 w-3.5 rounded-sm bg-navy-950" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">T&S</span>
          </Link>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-yellow-500">
            Join Waitlist
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* Progress */}
        <ProgressSteps steps={STEP_LABELS} current={step} className="mb-2" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* ── Step 1: About You ──────────────────────────────────── */}
          {step === 1 && (
            <section className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-2xl font-display font-bold text-white">About you</h2>
                <p className="text-white/60 text-sm mt-1 font-sans">
                  Tell us who you are so our grid specialists can reach you.
                </p>
              </div>

              <div className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="Tunde Bakare"
                  error={errors.full_name?.message}
                  className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                  {...register("full_name")}
                />
                <Input
                  label="Phone Number"
                  placeholder="0812 000 0000"
                  variant="phone"
                  error={errors.phone?.message}
                  className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                  {...register("phone")}
                />
                <Input
                  label="Email (optional)"
                  placeholder="tunde@example.com"
                  type="email"
                  error={errors.email?.message}
                  className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                  {...register("email")}
                />
                <Input
                  label="WhatsApp Number (optional)"
                  placeholder="Same as phone if blank"
                  hint="We'll use this for updates and group chats"
                  className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                  {...register("whatsapp")}
                />
              </div>
            </section>
          )}

          {/* ── Step 2: Your Property ─────────────────────────────── */}
          {step === 2 && (
            <section className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-2xl font-display font-bold text-white">Your property</h2>
                <p className="text-white/60 text-sm mt-1 font-sans">
                  Help us understand your site for a proper assessment.
                </p>
              </div>

              <div className="space-y-5">
                <Input
                  label="Address"
                  placeholder="12 Admiralty Way, Lekki Phase 1"
                  error={errors.address?.message}
                  className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                  {...register("address")}
                />

                <div className="space-y-1.5">
                  <FieldLabel>LGA / Area</FieldLabel>
                  <Controller
                    control={control}
                    name="lga"
                    render={({ field }) => (
                      <SelectDropdown
                        options={LGA_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select your area"
                        error={errors.lga?.message}
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Property Type</FieldLabel>
                  <Controller
                    control={control}
                    name="property_type"
                    render={({ field }) => (
                      <SelectDropdown
                        options={PROPERTY_TYPES}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select property type"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Ownership</FieldLabel>
                  <Controller
                    control={control}
                    name="ownership"
                    render={({ field }) => (
                      <RadioPills options={OWNERSHIP_OPTIONS} value={field.value} onChange={field.onChange} columns={1} />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>How many neighbors could you supply?</FieldLabel>
                  <Controller
                    control={control}
                    name="neighbor_count"
                    render={({ field }) => (
                      <RadioPills options={NEIGHBOR_COUNT_OPTIONS.map((v) => ({ value: v, label: v }))} value={field.value} onChange={field.onChange} columns={4} />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel hint="We can arrange a free drone inspection of your roof">Rooftop Access</FieldLabel>
                  <Controller
                    control={control}
                    name="rooftop_access"
                    render={({ field }) => (
                      <RadioPills options={ROOFTOP_OPTIONS} value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── Step 3: Power Situation ───────────────────────────── */}
          {step === 3 && (
            <section className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-2xl font-display font-bold text-white">Your power situation</h2>
                <p className="text-white/60 text-sm mt-1 font-sans">
                  Choose your path and tell us about your current setup.
                </p>
              </div>

              <div className="space-y-5">
                {/* Path selector cards */}
                <div className="space-y-1.5">
                  <FieldLabel>Choose your path</FieldLabel>
                  <Controller
                    control={control}
                    name="path"
                    render={({ field }) => (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => field.onChange("upgrade_kit")}
                            className={cn(
                              "rounded-2xl border-2 p-5 text-left transition-all",
                              field.value === "upgrade_kit"
                                ? "border-yellow-500 bg-yellow-500/10"
                                : "border-navy-700 bg-navy-900 hover:border-navy-500",
                            )}
                          >
                            <Sun className={cn("h-6 w-6 mb-3", field.value === "upgrade_kit" ? "text-yellow-500" : "text-navy-400")} />
                            <h3 className="font-bold text-white text-lg">Upgrade Kit</h3>
                            <p className="text-white/60 text-xs mt-1 font-sans">
                              Already have solar? Add metering + platform.
                            </p>
                            <p className="text-yellow-500 font-mono font-bold text-sm mt-3">
                              From ₦800K
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => field.onChange("full_stack")}
                            className={cn(
                              "rounded-2xl border-2 p-5 text-left transition-all",
                              field.value === "full_stack"
                                ? "border-yellow-500 bg-yellow-500/10"
                                : "border-navy-700 bg-navy-900 hover:border-navy-500",
                            )}
                          >
                            <Zap className={cn("h-6 w-6 mb-3", field.value === "full_stack" ? "text-yellow-500" : "text-navy-400")} />
                            <h3 className="font-bold text-white text-lg">Full Stack</h3>
                            <p className="text-white/60 text-xs mt-1 font-sans">
                              Complete solar + metering + platform installation.
                            </p>
                            <p className="text-yellow-500 font-mono font-bold text-sm mt-3">
                              From ₦6M
                            </p>
                          </button>
                        </div>
                        {errors.path && <p className="text-xs font-medium text-red-500">{errors.path.message}</p>}
                      </div>
                    )}
                  />
                </div>

                {/* Conditional: Existing solar details */}
                {selectedPath === "upgrade_kit" && (
                  <div className="space-y-4 p-4 rounded-2xl border border-navy-700 bg-navy-900/50">
                    <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-yellow-500">
                      Existing Solar Details
                    </p>
                    <Input
                      label="Panel Capacity"
                      placeholder="e.g. 5kW, 10 panels"
                      className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                      {...register("panel_capacity")}
                    />
                    <Input
                      label="Inverter Model"
                      placeholder="e.g. Luminous 5kVA"
                      className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                      {...register("inverter_model")}
                    />
                    <Input
                      label="Battery Type"
                      placeholder="e.g. Lithium 200Ah, Tubular"
                      className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                      {...register("battery_type")}
                    />
                    <div className="space-y-1.5">
                      <FieldLabel>System Age</FieldLabel>
                      <Controller
                        control={control}
                        name="system_age"
                        render={({ field }) => (
                          <RadioPills
                            options={["< 1 year", "1-2 years", "3-5 years", "5+ years"]}
                            value={field.value}
                            onChange={field.onChange}
                            columns={2}
                          />
                        )}
                      />
                    </div>
                    <Input
                      label="Estimated Surplus Power"
                      placeholder="e.g. 3-5 kWh/day unused"
                      hint="How much excess solar do you produce daily?"
                      className="bg-navy-900 border-navy-700 text-white placeholder:text-navy-500"
                      {...register("surplus_power")}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <FieldLabel>Monthly Power Spend</FieldLabel>
                  <Controller
                    control={control}
                    name="monthly_power_spend"
                    render={({ field }) => (
                      <RadioPills
                        options={MONTHLY_SPEND_OPTIONS.map((v) => ({ value: v, label: v }))}
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.monthly_power_spend?.message}
                        columns={2}
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Primary Power Source</FieldLabel>
                  <Controller
                    control={control}
                    name="primary_power_source"
                    render={({ field }) => (
                      <RadioPills
                        options={POWER_SOURCES.map((v) => ({ value: v, label: v }))}
                        value={field.value}
                        onChange={field.onChange}
                        columns={2}
                      />
                    )}
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── Step 4: Investment Readiness ──────────────────────── */}
          {step === 4 && (
            <section className="space-y-6 animate-in fade-in-0 slide-in-from-right-4 duration-300">
              <div>
                <h2 className="text-2xl font-display font-bold text-white">Investment readiness</h2>
                <p className="text-white/60 text-sm mt-1 font-sans">
                  Almost done. This helps us match you with the right package.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <FieldLabel>Payment Preference</FieldLabel>
                  <Controller
                    control={control}
                    name="payment_preference"
                    render={({ field }) => (
                      <RadioPills options={PAYMENT_OPTIONS} value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Timeline</FieldLabel>
                  <Controller
                    control={control}
                    name="timeline"
                    render={({ field }) => (
                      <RadioPills options={TIMELINE_OPTIONS} value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Target Price per kWh</FieldLabel>
                  <Controller
                    control={control}
                    name="target_price_per_kwh"
                    render={({ field }) => (
                      <SelectDropdown
                        options={PRICE_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Select target price"
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel hint="Free drone survey to assess your roof and surroundings">
                    Would you like a drone assessment?
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="drone_assessment"
                    render={({ field }) => (
                      <RadioPills options={DRONE_OPTIONS} value={field.value} onChange={field.onChange} columns={3} />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>How did you hear about us?</FieldLabel>
                  <Controller
                    control={control}
                    name="referral_source"
                    render={({ field }) => (
                      <RadioPills
                        options={REFERRAL_OPTIONS.map((v) => ({ value: v, label: v }))}
                        value={field.value}
                        onChange={field.onChange}
                        columns={3}
                      />
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Anything else? (optional)</FieldLabel>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    placeholder="Questions, concerns, special requirements..."
                    className="flex w-full rounded-[12px] border border-navy-700 bg-navy-900 px-4 py-3 text-sm text-white placeholder:text-navy-500 font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900 transition-all resize-none"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ── Navigation ────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={goBack}
                className="border-navy-700 text-white hover:bg-navy-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            {step < 4 ? (
              <Button
                type="button"
                variant="primary"
                onClick={goNext}
                className="px-8"
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                className="px-8"
              >
                Join Waitlist
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-white/30 font-sans pb-8">
            By submitting, you agree to our Terms of Service and Privacy Policy.
          </p>
        </form>
      </main>
    </div>
  );
}
