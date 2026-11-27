"use client";

import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import { scrollTopForIndex, stepIndex } from "@/lib/a11y";

export type WindowKeyAction =
  | { type: "move"; index: number }
  | { type: "cross"; direction: -1 | 1; index: number };

export function windowRowIndex(target: EventTarget | null): number | null {
  if (!(target instanceof HTMLElement)) return null;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  ) {
    return null;
  }
  const raw = target.closest("[data-window-index]")?.getAttribute("data-window-index");
  if (raw == null) return null;
  const index = Number(raw);
  return Number.isFinite(index) ? index : null;
}

/** Arrow, Home, and End actions for a windowed board column or list. */
export function windowKeyAction(event: KeyboardEvent, count: number): WindowKeyAction | null {
  if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return null;
  if (document.querySelector("[data-menu-open]")) return null;
  const current = windowRowIndex(event.target);
  if (current === null) return null;
  if (event.key === "ArrowLeft") return { type: "cross", direction: -1, index: current };
  if (event.key === "ArrowRight") return { type: "cross", direction: 1, index: current };
  const next = stepIndex(current, event.key, count);
  if (next === null) return null;
  return { type: "move", index: next };
}

export function useWindowFocus(scrollerRef: RefObject<HTMLElement | null>, offsets: readonly number[]) {
  const pending = useRef<number | null>(null);
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;

  const focusPending = useCallback(() => {
    const index = pending.current;
    const scroller = scrollerRef.current;
    if (index === null || !scroller) return false;
    const link = scroller.querySelector<HTMLElement>(`[data-window-index="${index}"] [data-issue-focus]`);
    if (!link) return false;
    link.focus({ preventScroll: true });
    pending.current = null;
    return true;
  }, [scrollerRef]);

  useLayoutEffect(() => {
    focusPending();
  });

  return useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller || index < 0) return;
      const nextTop = scrollTopForIndex(offsetsRef.current, index, scroller.scrollTop, scroller.clientHeight);
      pending.current = index;
      if (Math.abs(nextTop - scroller.scrollTop) > 1) scroller.scrollTop = nextTop;
      focusPending();
    },
    [focusPending, scrollerRef],
  );
}
