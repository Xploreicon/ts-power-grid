import * as React from "react";
import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full bg-navy-950",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-8 w-8 text-xs",
        md: "h-12 w-12 text-sm",
        lg: "h-16 w-16 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

interface AvatarProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarVariants> {
  src?: string;
  alt?: string;
  initials?: string;
  status?: "online" | "offline" | "idle";
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size, src, alt, initials, status, ...props }, ref) => {
    return (
      <div className="relative inline-block">
        <div
          ref={ref}
          className={cn(avatarVariants({ size }), className)}
          {...props}
        >
          {src ? (
            <Image 
              src={src} 
              alt={alt ?? "Avatar"} 
              width={100} 
              height={100} 
              className="h-full w-full object-cover" 
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-bold text-yellow-500">
              {initials?.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        {status && (
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-offwhite",
              size === "xs" ? "h-1.5 w-1.5" : size === "sm" ? "h-2 w-2" : "h-3 w-3",
              status === "online" ? "bg-green-500" :
              status === "offline" ? "bg-red-500" : "bg-amber-500"
            )}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
