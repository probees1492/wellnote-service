import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={clsx(
        "rounded-lg border border-border bg-bg-primary p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
