"use client";

import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { CheckIcon } from "@/components/icons";

const MenuCloseContext = createContext<() => void>(() => undefined);

type Box = { left: number; top: number; width: number };

export function Menu({
  label,
  trigger,
  children,
  testId,
  align = "left",
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode;
  testId?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(220, rect.width);
      const left = align === "right" ? rect.right - width : rect.left;
      const clampedLeft = Math.min(Math.max(8, left), window.innerWidth - width - 8);
      const estimated = 280;
      const below = rect.bottom + 6;
      const openUp = below + estimated > window.innerHeight && rect.top > 180;
      setBox({
        left: clampedLeft,
        top: openUp ? Math.max(8, rect.top - estimated - 6) : below,
        width,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        data-testid={testId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-full items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {trigger}
      </button>
      {open && box
        ? createPortal(
            <MenuCloseContext.Provider value={() => setOpen(false)}>
              <div
                ref={panelRef}
                role="listbox"
                aria-labelledby={titleId}
                data-menu-open="true"
                style={{ position: "fixed", left: box.left, top: box.top, width: box.width, zIndex: 70 }}
                className="max-h-72 overflow-y-auto rounded-lg border border-line bg-[#1b1c22] p-1 shadow-pop"
              >
                <p id={titleId} className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                  {label.replace(/^Filter by /, "")}
                </p>
                {children}
              </div>
            </MenuCloseContext.Provider>,
            document.body,
          )
        : null}
    </div>
  );
}

export function MenuOption({
  children,
  selected = false,
  onSelect,
  closeOnSelect = true,
}: {
  children: ReactNode;
  selected?: boolean;
  onSelect: () => void;
  closeOnSelect?: boolean;
}) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => {
        onSelect();
        if (closeOnSelect) close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink hover:bg-white/[0.06]",
        selected && "bg-white/[0.04]",
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {selected ? <CheckIcon className="text-accent-hover" /> : <span className="h-3.5 w-3.5" />}
    </button>
  );
}
