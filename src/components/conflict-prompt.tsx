"use client";

import { useEffect, useId, useRef } from "react";
import { conflictCopy } from "@/lib/concurrency";
import { rememberFocus, trapTabKey } from "@/lib/a11y";
import { Button } from "@/components/ui";

export function ConflictPrompt({
  actorName,
  pending,
  error,
  onReload,
  onOverwrite,
}: {
  actorName: string | null;
  pending: boolean;
  error?: string | null;
  onReload: () => void;
  onOverwrite: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reloadRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const errorId = useId();
  const onReloadRef = useRef(onReload);
  const pendingRef = useRef(pending);
  onReloadRef.current = onReload;
  pendingRef.current = pending;

  useEffect(() => {
    const restore = rememberFocus();
    reloadRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      const node = panelRef.current;
      if (!node) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!pendingRef.current) onReloadRef.current();
        return;
      }
      trapTabKey(event, node);
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      restore();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        reloadRef.current?.focus();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? `${bodyId} ${errorId}` : bodyId}
        data-testid="conflict-prompt"
        className="w-full max-w-md rounded-xl border border-line bg-[#1b1c22] p-5 shadow-pop"
      >
        <h2 id={titleId} className="text-[16px] font-semibold tracking-tight">
          This issue changed
        </h2>
        <p id={bodyId} className="mt-2 text-[13px] leading-6 text-ink-muted">
          {conflictCopy(actorName)}
        </p>
        {error ? (
          <p id={errorId} role="alert" className="mt-2 text-[12px] text-red-200">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button ref={reloadRef} variant="subtle" data-testid="conflict-reload" onClick={onReload} disabled={pending}>
            Reload
          </Button>
          <Button data-testid="conflict-overwrite" onClick={onOverwrite} disabled={pending}>
            {pending ? "Saving…" : "Overwrite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
