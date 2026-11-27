import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        {icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-muted">{icon}</div> : null}
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-ink-muted">{body}</p>
        {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
