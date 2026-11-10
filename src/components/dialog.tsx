"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>("input, textarea, select, button");
    focusable?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.querySelector("[data-menu-open]")) return;
        const active = document.activeElement;
        if (active instanceof HTMLElement && node?.contains(active)) active.blur();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>("input, textarea, select, button, a[href]")].filter(
        (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/65 px-4 py-8 sm:py-16" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={`w-full rounded-xl border border-line bg-[#14151a] shadow-pop ${wide ? "max-w-2xl" : "max-w-md"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
            {description ? <p className="mt-0.5 text-[12px] text-ink-muted">{description}</p> : null}
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
