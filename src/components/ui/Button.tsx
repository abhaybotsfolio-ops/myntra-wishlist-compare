"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "subtle" | "ghost";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  /** Not a native `disabled` — stays focusable and screen-reader announced
   * (myntra-ui skill: "disabled at 45% opacity ... but still screen-reader
   * announced"). Interaction is blocked via aria-disabled + a click guard. */
  disabled?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white active:bg-brand-dark",
  secondary: "bg-surface text-ink border border-line active:bg-canvas",
  subtle: "bg-transparent text-ink-muted active:text-ink underline-offset-2 hover:underline",
  ghost: "bg-transparent text-brand active:bg-brand-tint",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      fullWidth,
      disabled,
      className = "",
      children,
      onClick,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-disabled={disabled || undefined}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        className={[
          "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-4 text-[14px] font-semibold transition-colors duration-150",
          VARIANT_CLASSES[variant],
          fullWidth ? "w-full" : "",
          disabled ? "pointer-events-none opacity-45" : "cursor-pointer",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/** Small caption explaining why an adjacent control is disabled. Never hide
 * the reason — RULES.md and ACCEPTANCE.md both require it to be visible. */
export function Reason({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[11px] leading-snug text-ink-faint ${className}`}>
      {children}
    </p>
  );
}
