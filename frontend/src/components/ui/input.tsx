import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-8 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-100 transition-all duration-200 placeholder:text-zinc-600 focus-visible:border-white/25 focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40 [color-scheme:dark]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
