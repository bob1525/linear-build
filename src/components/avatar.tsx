import { cn } from "@/lib/cn";
import { colorFromName, initials } from "@/lib/format";

export function Avatar({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      title={name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white", className)}
      style={{
        width: size,
        height: size,
        background: colorFromName(name),
        fontSize: size < 22 ? 9 : 11,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function LabelPill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-ink-muted">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{name}</span>
    </span>
  );
}
