"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        props.className
      )}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  const isTextSubtitle =
    typeof subtitle === "string" || typeof subtitle === "number";

  return (
    <div className={cn("flex items-start justify-between gap-4 p-5", className)}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>

        {subtitle ? (
          isTextSubtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : (
            // ✅ prevents <p><div/></p> invalid nesting and hydration mismatch
            <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
          )
        ) : null}
      </div>

      {right}
    </div>
  );
}

export function Button({
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "destructive";
}) {
  const styles =
    variant === "primary"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : variant === "secondary"
      ? "bg-slate-100 text-slate-900 hover:bg-slate-200"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : "bg-transparent text-slate-700 hover:bg-slate-100";

  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50",
        styles,
        props.className
      )}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-slate-300 placeholder:text-slate-400 focus:ring-2",
        props.className
      )}
    />
  );
}

/**
 * ✅ Supports both:
 *  - <Select options={[{value,label}]} ... />
 *  - <Select> <option/> ... </Select>
 */
export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options?: { value: string; label: string; disabled?: boolean }[];
  }
) {
  const { options, children, ...rest } = props;

  return (
    <select
      {...rest}
      className={cn(
        "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-slate-300 focus:ring-2",
        props.className
      )}
    >
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
}

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn("text-sm font-semibold text-slate-700", props.className)}
    />
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700",
        className
      )}
    >
      {children}
    </span>
  );
}
