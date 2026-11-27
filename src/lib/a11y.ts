/** Scroll offset that puts item `index` inside the viewport. A tall item keeps its top in view. */
export function scrollTopForIndex(offsets: readonly number[], index: number, scrollTop: number, viewport: number): number {
  if (index < 0 || index + 1 >= offsets.length) return scrollTop;
  const start = offsets[index] ?? 0;
  const end = offsets[index + 1] ?? start;
  if (start < scrollTop) return start;
  if (viewport > 0 && end > scrollTop + viewport) {
    if (end - start > viewport) return start;
    return Math.max(0, end - viewport);
  }
  return scrollTop;
}

/** Next index for Home, End, and the vertical arrow keys. Null when the list is empty. */
export function stepIndex(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return Math.min(count - 1, current + 1);
  if (key === "ArrowUp") return Math.max(0, current - 1);
  return null;
}

export type PasswordField = "current" | "new" | "confirm";

/** Which password field should receive focus for a change-password error. */
export function passwordFieldForError(message: string): PasswordField {
  if (message === "Passwords do not match") return "confirm";
  if (
    message === "Choose a different password" ||
    message === "Use at least 8 characters" ||
    message === "Password is too long"
  ) {
    return "new";
  }
  return "current";
}

export function focusableIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("input, textarea, select, button, a[href]")].filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex !== -1,
  );
}

export function trapTabKey(event: KeyboardEvent, root: HTMLElement) {
  if (event.key !== "Tab") return;
  const items = focusableIn(root);
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

export function rememberFocus(): () => void {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return () => {
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  };
}
