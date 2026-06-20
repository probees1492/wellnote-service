"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: Props) {
  const sizeCls =
    size === "sm"
      ? "h-8 px-3 text-[13px]"
      : size === "lg"
      ? "h-12 px-5 text-base"
      : "h-10 px-4 text-sm";
  const variantCls =
    variant === "primary"
      ? "bg-edge-blue text-text-on-blue hover:bg-edge-blue-hover"
      : variant === "secondary"
      ? "bg-bg-primary text-text-primary border border-border-strong hover:bg-bg-tertiary hover:border-edge-blue"
      : variant === "danger"
      ? "bg-danger text-text-on-blue hover:bg-danger-hover"
      : "bg-transparent text-text-primary hover:bg-bg-tertiary";
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:shadow-focus focus-visible:outline-none",
        sizeCls,
        variantCls,
        className,
      )}
    >
      {children}
    </button>
  );
}
