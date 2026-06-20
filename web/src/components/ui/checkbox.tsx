// Minimal shadcn-style checkbox built on the native input element so we don't
// need to add @radix-ui/react-checkbox for this single use case.
"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange"
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    { className, checked, defaultChecked, onCheckedChange, disabled, id, ...props },
    ref,
  ) => {
    return (
      <span
        className={cn(
          "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input bg-background ring-offset-background transition-colors",
          "has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          className,
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.currentTarget.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <Check
          aria-hidden="true"
          className="pointer-events-none h-3 w-3 opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
