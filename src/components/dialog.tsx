"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { rememberFocus, trapTabKey } from "@/lib/a11y";
import { CloseIcon } from "@/components/icons";

export function Dialog({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    const restore = rememberFocus();
    const field = node?.querySelector<HTMLElement>("input, textarea, select");
    const fallback = node?.querySelector<HTMLElement>("button:not([aria-label='Close'])");
    (field ?? fallback)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.querySelector("[data-menu-open]")) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && node?.contains(active)) active.blur();
        onCloseRef.current();
        return;
      }
      if (!node) return;
      trapTabKey(event, node);
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restore();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-16" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        className={`w-full rounded-xl border border-line bg-[#14151a] shadow-pop ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 id={titleId} className="text-[14px] font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-[12px] text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 text-ink-faint hover:bg-white/5 hover:text-ink">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
