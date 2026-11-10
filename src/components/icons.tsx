import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#5e6ad2" />
      <path d="M16 6.5 18.1 13.2 25 15.2 18.1 17.2 16 24 13.9 17.2 7 15.2 13.9 13.2Z" fill="white" />
    </svg>
  );
}

export function StatusIcon({ status, className }: { status: string; className?: string }) {
  const common = cn("h-3.5 w-3.5 shrink-0", className);
  if (status === "done") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="#5e6ad2" />
        <path d="M5.1 8.15 7.05 10.1 11 6.2" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "in_progress") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="#f2c94c" strokeWidth="1.5" />
        <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4Z" fill="#f2c94c" />
      </svg>
    );
  }
  if (status === "todo") {
    return (
      <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="#d5d8e0" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className={common} aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="#8a8f98" strokeWidth="1.5" strokeDasharray="2.2 2.15" />
    </svg>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#e5484d",
  high: "#f2994a",
  medium: "#f2c94c",
  low: "#5e6ad2",
  none: "#6d717a",
};

export function PriorityIcon({ priority, className }: { priority: string; className?: string }) {
  const color = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.none;
  const level = priority === "urgent" || priority === "high" ? 3 : priority === "medium" ? 2 : priority === "low" ? 1 : 0;
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden="true">
      {[5, 8, 11].map((height, index) => (
        <rect
          key={height}
          x={2.2 + index * 4.2}
          y={13.2 - height}
          width="2.5"
          height={height}
          rx="0.6"
          fill={index < level ? color : "rgba(255,255,255,0.16)"}
        />
      ))}
    </svg>
  );
}

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.4 10.4 13.2 13.2" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-4 w-4", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}

export function BoardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2.5" width="3.4" height="11" rx="0.8" />
      <rect x="6.3" y="2.5" width="3.4" height="7.5" rx="0.8" />
      <rect x="10.6" y="2.5" width="3.4" height="9.2" rx="0.8" />
    </svg>
  );
}

export function ListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 4h8M6 8h8M6 12h8" />
      <circle cx="3.2" cy="4" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="3.2" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="3.2" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.2 6.4 11 12.5 4.8" />
    </svg>
  );
}

export function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3.5H4.2A1.2 1.2 0 0 0 3 4.7v6.6a1.2 1.2 0 0 0 1.2 1.2h2.3M7 8h6.2" />
      <path d="M10.8 5.4 13.4 8l-2.6 2.6" />
    </svg>
  );
}

export function GripIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3.5 w-3.5", className)} aria-hidden="true" fill="currentColor">
      <circle cx="6" cy="4" r="1" />
      <circle cx="10" cy="4" r="1" />
      <circle cx="6" cy="8" r="1" />
      <circle cx="10" cy="8" r="1" />
      <circle cx="6" cy="12" r="1" />
      <circle cx="10" cy="12" r="1" />
    </svg>
  );
}

export function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("h-3 w-3", className)} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.4" y="3.2" width="11.2" height="10" rx="1.4" />
      <path d="M2.4 6.4h11.2M5.2 2.4v2M10.8 2.4v2" strokeLinecap="round" />
    </svg>
  );
}
