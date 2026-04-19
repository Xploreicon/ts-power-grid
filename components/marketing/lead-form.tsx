"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Invalid email address"),
  address: z.string().min(5, "Lagos area address required"),
  path: z.enum(["Full Stack", "Upgrade", "Either"]),
});

type FormValues = z.infer<typeof formSchema>;

export function LeadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      path: "Either",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("leads").insert([
        {
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          path_interest: data.path,
        },
      ]);

      if (error) throw error;

      setIsSuccess(true);
      toast.success("Consultation booked!", "We'll be in touch within 24 hours.");
      if (onSuccess) setTimeout(onSuccess, 2000);
    } catch (error) {
      console.error("Submission error:", error);
      toast.error("Submission failed", "Please try again later or contact support.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-600">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h3 className="text-2xl font-display font-bold text-navy-950">Thank You!</h3>
        <p className="text-navy-600 max-w-xs font-sans">
          Your details have been received. One of our grid specialists will reach out to you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Input
        label="Full Name"
        placeholder="Divine Ajie"
        error={errors.name?.message}
        {...register("name")}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Phone Number"
          placeholder="812 000 0000"
          prefix="+234"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <Input
          label="Email Address"
          placeholder="hello@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
      </div>
      <Input
        label="Lagos Area Address"
        placeholder="123 Lekki Phase 1, Lagos"
        error={errors.address?.message}
        {...register("address")}
      />
      
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-navy-900 font-sans">
          Preferred Path
        </label>
        <div className="grid grid-cols-3 gap-2">
          {["Full Stack", "Upgrade", "Either"].map((p) => (
            <label
              key={p}
              className={`
                flex items-center justify-center px-3 py-2 border rounded-lg text-sm cursor-pointer transition-all
                ${errors.path ? 'border-red-500' : 'border-navy-100'}
                peer-checked:bg-navy-900 peer-checked:text-white
                hover:bg-navy-50
              `}
            >
              <input
                type="radio"
                value={p}
                className="sr-only peer"
                {...register("path")}
              />
              {p}
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full h-12 text-lg" loading={isSubmitting}>
        Confirm Booking
      </Button>
      <p className="text-center text-xs text-navy-400 font-sans">
        By submitting, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}
