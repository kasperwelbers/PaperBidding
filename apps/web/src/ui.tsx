// Small UI primitives. To be replaced by shadcn/ui components later

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-700",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      className={`rounded px-3 py-1.5 text-sm disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded border border-slate-300 px-2 py-1.5 text-sm ${className}`}
      {...props}
    />
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <p className="text-sm text-red-700">{message}</p>;
}
