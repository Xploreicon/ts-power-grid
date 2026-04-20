"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/host/useSite";
import { Button, Input } from "@/components/ui";
import { normalizePhone } from "@/lib/auth/phone";

const schema = z.object({
  phone: z.string().min(7, "Enter a valid phone number"),
  meterSerial: z.string().min(3, "Enter the meter serial number"),
  pricePerKwh: z
    .number()
    .min(10, "Minimum ₦10/kWh")
    .max(1000, "Maximum ₦1,000/kWh"),
});

type FormValues = z.infer<typeof schema>;

export default function AddNeighborPage() {
  const router = useRouter();
  const profile = useUser();
  const { data: site } = useSite();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pricePerKwh: 280 }, // ₦280/kWh (raw NGN)
  });

  const onSubmit = async (values: FormValues) => {
    if (!profile?.id || !site) {
      toast.error("Site not found. Complete onboarding first.");
      return;
    }

    const phone = normalizePhone(values.phone);
    if (!phone) {
      toast.error("Invalid phone number. Use format: 08012345678");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();

      // Find meter via admin-backed API (RLS on meters blocks direct lookup)
      const lookupRes = await fetch(
        `/api/host/meters/lookup?serial=${encodeURIComponent(values.meterSerial)}`,
      );
      if (lookupRes.status === 404) {
        toast.error("Meter serial not found. Check the number and try again.");
        return;
      }
      if (!lookupRes.ok) throw new Error("Meter lookup failed");
      const { meter } = (await lookupRes.json()) as {
        meter: { id: string };
      };

      const { error } = await supabase.rpc("connect_neighbor", {
        p_host_id: profile.id,
        p_neighbor_phone: phone,
        p_meter_id: meter.id,
        p_price_per_kwh: values.pricePerKwh,
      });

      if (error) {
        if (error.message.includes("profile")) {
          toast.error(
            "Neighbor hasn't signed up yet. Ask them to download the T&S app first.",
          );
        } else {
          throw error;
        }
        return;
      }

      toast.success("Neighbor connected successfully!");
      router.push("/host/neighbors");
    } catch (err) {
      console.error(err);
      toast.error("Failed to connect neighbor. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-navy-400 hover:text-navy-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Neighbors
      </button>

      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
          Connect
        </p>
        <h1 className="text-2xl font-display font-bold text-navy-900">
          Add Neighbor
        </h1>
        <p className="text-navy-500 text-sm mt-1">
          Your neighbor must already have a T&amp;S account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1.5">
            Neighbor&apos;s Phone Number
          </label>
          <Input
            variant="phone"
            placeholder="08012345678"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
          )}
        </div>

        {/* Meter serial */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1.5">
            Meter Serial Number
          </label>
          <Input
            placeholder="TS-M-001"
            className="font-mono uppercase"
            {...register("meterSerial")}
          />
          {errors.meterSerial && (
            <p className="text-red-500 text-xs mt-1">
              {errors.meterSerial.message}
            </p>
          )}
          <p className="text-navy-400 text-xs mt-1">
            Found on the smart meter unit installed at your neighbor&apos;s
            property.
          </p>
        </div>

        {/* Price per kWh */}
        <div>
          <label className="block text-sm font-medium text-navy-700 mb-1.5">
            Rate (per kWh)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-400 text-sm font-mono">
              ₦
            </span>
            <Input
              type="number"
              step="100"
              className="pl-7 font-mono"
              placeholder="280"
              {...register("pricePerKwh", { valueAsNumber: true })}
            />
          </div>
          {errors.pricePerKwh && (
            <p className="text-red-500 text-xs mt-1">
              {errors.pricePerKwh.message}
            </p>
          )}
          <p className="text-navy-400 text-xs mt-1">
            T&amp;S recommended rate: ₦280/kWh (~40% below grid).
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting…
            </>
          ) : (
            "Connect Neighbor"
          )}
        </Button>
      </form>
    </div>
  );
}
