import { toast as sonnerToast } from "sonner";

/**
 * T&S Power Grid Toast wrapper for Sonner.
 * Provides consistent styling and variants.
 */
export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      className: "rounded-[12px] bg-white border-green-100 text-navy-900 font-sans",
    });
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      className: "rounded-[12px] bg-white border-red-100 text-navy-900 font-sans",
    });
  },
  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      className: "rounded-[12px] bg-white border-navy-100 text-navy-900 font-sans",
    });
  },
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      className: "rounded-[12px] bg-white border-amber-100 text-navy-900 font-sans",
    });
  },
};
