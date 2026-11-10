"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSavedViewAction, deleteSavedViewAction, renameSavedViewAction, setDefaultSavedViewAction } from "@/lib/actions/views";
import type { IssueFilters } from "@/lib/filters";
import type { SavedViewDTO } from "@/lib/types";
import { viewHref, type IssueSort, type ViewType } from "@/lib/view-state";

export function SavedViews({
  projectKey,
  viewType,
  sort,
  filters,
  views,
  activeViewId,
}: {
  projectKey: string;
  viewType: ViewType;
  sort: IssueSort;
  filters: IssueFilters;
  views: SavedViewDTO[];
  activeViewId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState<SavedViewDTO[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; top: number } | null>(null);
  const shown = local ?? views;
  const signature = views.map((view) => `${view.id}:${view.name}:${view.isDefault}:${view.sort}:${view.viewType}`).join("|");

  useEffect(() => {
    setLocal(null);
  }, [signature]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 288;
    setBox({ left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8), top: rect.bottom + 6 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await createSavedViewAction({ projectKey, name, viewType, sort, filters });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    setLocal([...shown.filter((view) => view.id !== result.data.id), result.data].sort((a, b) => a.name.localeCompare(b.name)));
    router.refresh();
  }

  async function rename(viewId: string) {
    setPending(true);
    setError(null);
    const result = await renameSavedViewAction({ viewId, name: draft });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    setLocal(shown.map((view) => (view.id === viewId ? result.data : view)).sort((a, b) => a.name.localeCompare(b.name)));
    router.refresh();
  }

  async function remove(viewId: string) {
    setPending(true);
    setError(null);
    const result = await deleteSavedViewAction({ viewId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLocal(shown.filter((view) => view.id !== viewId));
    router.refresh();
  }

  async function makeDefault(view: SavedViewDTO) {
    setPending(true);
    setError(null);
    const isDefault = !view.isDefault;
    const result = await setDefaultSavedViewAction({ viewId: view.id, isDefault });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLocal(
      shown.map((item) => {
        if (item.id === view.id) return result.data;
        return isDefault ? { ...item, isDefault: false } : item;
      }),
    );
    router.refresh();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        data-testid="saved-views"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-ink-muted hover:bg-white/[0.04] hover:text-ink"
      >
        Saved views
        {shown.length > 0 ? <span className="rounded bg-white/10 px-1.5 text-[11px] text-ink">{shown.length}</span> : null}
      </button>
      {open && box
        ? createPortal(
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Saved views"
          style={{ position: "fixed", left: box.left, top: box.top, width: 288, zIndex: 70 }}
          className="max-h-80 overflow-y-auto rounded-lg border border-line bg-[#1b1c22] p-2 shadow-pop"
        >
          <form className="flex gap-1.5" onSubmit={(event) => void save(event)}>
            <label className="min-w-0 flex-1">
              <span className="sr-only">View name</span>
              <input
                data-testid="view-name"
                aria-label="View name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name this view"
                className="h-8 w-full rounded-md border border-line bg-black/25 px-2 text-[13px] outline-none focus:border-accent/80"
              />
            </label>
            <button type="submit" disabled={pending} className="h-8 shrink-0 rounded-md bg-accent px-2 text-[12px] font-medium text-white disabled:opacity-50">
              {pending ? "Saving…" : "Save view"}
            </button>
          </form>
          {error ? (
            <p data-testid="view-error" className="mt-2 text-[12px] text-red-200">
              {error}
            </p>
          ) : null}
          {pending ? (
            <p data-testid="view-pending" className="mt-2 text-[12px] text-ink-faint">
              Working…
            </p>
          ) : null}
          {shown.length === 0 ? <p className="mt-3 px-1 text-[12px] text-ink-faint">No saved views yet.</p> : null}
          <ul className="mt-2 space-y-1">
            {shown.map((view) => {
              const href = viewHref(projectKey, view.viewType, view.filters, view.sort, view.id);
              const active = view.id === activeViewId;
              return (
                <li key={view.id} data-testid={`saved-view-${view.id}`} className={`rounded-md px-1 py-1 ${active ? "bg-white/[0.05]" : ""}`}>
                  {editingId === view.id ? (
                    <form
                      className="flex gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void rename(view.id);
                      }}
                    >
                      <input
                        aria-label={`New name for ${view.name}`}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="h-7 min-w-0 flex-1 rounded-md border border-line bg-black/25 px-2 text-[12px] outline-none"
                      />
                      <button type="submit" disabled={pending} className="h-7 rounded-md px-2 text-[12px] text-ink hover:bg-white/10 disabled:opacity-50">
                        Save name
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Link href={href} className="min-w-0 flex-1 truncate px-1 text-[13px] text-ink hover:underline" onClick={() => setOpen(false)}>
                        {view.name}
                      </Link>
                      {view.isDefault ? <span className="text-[10px] uppercase tracking-wide text-ink-faint">Default</span> : null}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-1 px-1">
                    <button
                      type="button"
                      aria-label={`Rename ${view.name}`}
                      disabled={pending}
                      onClick={() => {
                        setEditingId(view.id);
                        setDraft(view.name);
                      }}
                      className="rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      aria-label={view.isDefault ? `Clear default ${view.name}` : `Set default ${view.name}`}
                      disabled={pending}
                      onClick={() => void makeDefault(view)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-white/10 hover:text-ink"
                    >
                      {view.isDefault ? "Clear default" : "Set default"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${view.name}`}
                      disabled={pending}
                      onClick={() => void remove(view.id)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-white/10 hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
