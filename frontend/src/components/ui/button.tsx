import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black shadow-xs hover:bg-white/90",
        impact:
          "font-impact text-sm tracking-wide bg-white text-black shadow-md hover:bg-zinc-200",
        outline:
          "border border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08] hover:text-white hover:border-white/20",
        secondary:
          "border border-white/[0.06] bg-white/[0.07] text-zinc-200 hover:bg-white/[0.12] hover:text-white",
        ghost:
          "text-zinc-400 hover:bg-white/[0.06] hover:text-white",
        destructive:
          "border border-rose-500/30 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25",
        link:
          "text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4 text-sm",
        icon: "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
