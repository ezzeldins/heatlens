import * as React from "react";
import * as P from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const AlertDialog = P.Root;

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof P.Content>,
  React.ComponentPropsWithoutRef<typeof P.Content>
>(({ className, ...props }, ref) => (
  <P.Portal>
    <P.Overlay className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 duration-200" />
    <P.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[2001] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950/90 p-6 shadow-2xl backdrop-blur-2xl duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </P.Portal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof P.Title>,
  React.ComponentPropsWithoutRef<typeof P.Title>
>(({ className, ...props }, ref) => (
  <P.Title ref={ref} className={cn("font-impact text-lg tracking-wide text-white", className)} {...props} />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof P.Description>,
  React.ComponentPropsWithoutRef<typeof P.Description>
>(({ className, ...props }, ref) => (
  <P.Description ref={ref} className={cn("mt-2 text-xs leading-relaxed text-zinc-400", className)} {...props} />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

export const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-5 flex justify-end gap-2 border-t border-white/[0.06] pt-4", className)} {...props} />
);

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof P.Action>,
  React.ComponentPropsWithoutRef<typeof P.Action>
>(({ className, ...props }, ref) => (
  <P.Action ref={ref} className={cn(buttonVariants({ variant: "default" }), className)} {...props} />
));
AlertDialogAction.displayName = "AlertDialogAction";

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof P.Cancel>,
  React.ComponentPropsWithoutRef<typeof P.Cancel>
>(({ className, ...props }, ref) => (
  <P.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />
));
AlertDialogCancel.displayName = "AlertDialogCancel";
