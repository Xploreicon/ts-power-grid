"use client";

import { useState } from "react";
import {
  PhoneCall,
  MessageSquare,
  AlertTriangle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { useConnections } from "@/lib/hooks/host/useConnections";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

const CATEGORIES = [
  { value: "billing", label: "Billing Issue" },
  { value: "disconnect", label: "Disconnection" },
  { value: "meter_fault", label: "Meter Fault" },
  { value: "pricing", label: "Pricing Dispute" },
  { value: "other", label: "Other" },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]["value"];

const schema = z.object({
  category: z.enum(
    CATEGORIES.map((c) => c.value) as [CategoryValue, ...CategoryValue[]],
  ),
  connectionId: z.string().optional(),
  description: z
    .string()
    .min(20, "Please describe the issue (at least 20 characters)"),
});

type FormValues = z.infer<typeof schema>;

export default function SupportPage() {
  const profile = useUser();
  const { data: connections = [] } = useConnections();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: "other" },
  });

  const selectedCategory = watch("category");

  const onSubmit = async (values: FormValues) => {
    if (!profile?.id) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const connectionId =
        values.connectionId && values.connectionId !== ""
          ? values.connectionId
          : connections[0]?.id;

      if (!connectionId) {
        toast.error(
          "No connection found to link this dispute to. Contact us directly.",
        );
        return;
      }

      const { error } = await supabase.from("disputes").insert({
        raised_by: profile.id,
        connection_id: connectionId,
        category: values.category,
        description: values.description,
      });
      if (error) throw error;

      setSubmitted(true);
      toast.success("Support ticket submitted. We'll respond within 24 hours.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit ticket. Try calling us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-1">
          Help &amp; Support
        </p>
        <h1 className="text-2xl font-display font-bold text-navy-900">
          Support
        </h1>
      </div>

      {/* Contact options */}
      <div className="space-y-2 mb-6">
        <a
          href="tel:+2348000000000"
          className="flex items-center gap-4 bg-white rounded-[12px] p-4 border border-navy-100 hover:border-navy-200 active:scale-[0.98] transition-all"
        >
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <PhoneCall className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900">Call Support</p>
            <p className="text-xs text-navy-400 font-mono mt-0.5">
              Mon–Sat, 8am–6pm WAT
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-navy-300" />
        </a>

        <a
          href="https://wa.me/2348000000000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 bg-white rounded-[12px] p-4 border border-navy-100 hover:border-navy-200 active:scale-[0.98] transition-all"
        >
          <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-navy-900">WhatsApp</p>
            <p className="text-xs text-navy-400 mt-0.5">
              Chat with our support team
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-navy-300" />
        </a>
      </div>

      {/* Dispute form */}
      <div className="mb-4">
        <h2 className="text-[10px] font-bold uppercase tracking-widest font-mono text-navy-400 mb-3">
          Submit a Ticket
        </h2>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-[12px] p-6 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="font-bold text-green-800">Ticket submitted!</p>
            <p className="text-green-700 text-sm mt-1">
              We&apos;ll respond within 24 hours.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => setSubmitted(false)}
            >
              Submit another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setValue("category", cat.value)}
                    className={cn(
                      "py-2.5 px-3 text-sm font-medium rounded-[10px] border transition-colors text-left",
                      selectedCategory === cat.value
                        ? "bg-navy-950 text-white border-navy-950"
                        : "bg-white text-navy-600 border-navy-100 hover:border-navy-200",
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              {errors.category && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.category.message}
                </p>
              )}
            </div>

            {/* Connection (if multiple) */}
            {connections.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-navy-700 mb-1.5">
                  Related Neighbor (optional)
                </label>
                <select
                  className="w-full h-11 px-3 rounded-[12px] border border-navy-200 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900"
                  {...register("connectionId")}
                >
                  <option value="">Select a neighbor</option>
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.neighbor.full_name ?? c.neighbor.phone ?? "Neighbor"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-navy-700 mb-1.5">
                Description
              </label>
              <textarea
                rows={4}
                placeholder="Describe the issue in detail…"
                className={cn(
                  "w-full px-3 py-2.5 rounded-[12px] border border-navy-200 bg-white text-sm text-navy-900",
                  "focus:outline-none focus:ring-2 focus:ring-navy-900 resize-none",
                )}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Submit Ticket
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
