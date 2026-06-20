"use client";

import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function Input({
  label,
  helper,
  error,
  className,
  id,
  ...rest
}: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="text-[13px] leading-[18px] font-medium text-text-secondary"
        >
          {label}
        </label>
      ) : null}
      <input
        id={id}
        {...rest}
        className={clsx(
          "h-10 w-full rounded-sm border bg-bg-primary px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:shadow-focus",
          error
            ? "border-danger focus:border-danger"
            : "border-border focus:border-edge-blue",
          className,
        )}
      />
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : helper ? (
        <span className="text-xs text-text-muted">{helper}</span>
      ) : null}
    </div>
  );
}
