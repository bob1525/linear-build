import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" && "h-7 px-2 text-[12px]",
        size === "md" && "h-8 px-2.5 text-[13px]",
        size === "lg" && "h-10 px-3.5 text-[14px]",
        variant === "primary" && "bg-accent text-white shadow-sm hover:bg-accent-hover",
        variant === "ghost" && "text-ink-muted hover:bg-white/5 hover:text-ink",
        variant === "subtle" && "border border-line bg-white/[0.03] text-ink hover:bg-white/[0.06]",
        variant === "danger" && "bg-red-500/10 text-red-200 hover:bg-red-500/15",
        className,
      )}
      {...props}
    />
  );
}

export const fieldClass =
  "w-full rounded-md border border-line bg-black/25 px-3 text-[13px] text-ink outline-none transition placeholder:text-ink-faint focus:border-accent/80";

export function TextField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, "h-9", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, "min-h-28 py-2 leading-5", className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">{label}</span>
        {children}
      </label>
      {hint ? <p className="mt-1 text-[11px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-white/[0.04] px-1.5 py-px font-sans text-[10px] leading-4 text-ink-faint">
      {children}
    </kbd>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-200">
      {children}
    </p>
  );
}
