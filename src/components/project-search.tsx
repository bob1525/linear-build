"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { searchBasePath } from "@/lib/view-state";
import { SearchIcon } from "@/components/icons";
import { Kbd } from "@/components/ui";

export function ProjectSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const [text, setText] = useState(query);
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);
  const onProject = /^\/p\/[^/]+/.test(pathname);

  useEffect(() => {
    setText(query);
  }, [query]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!onProject) return null;

  function commit(value: string) {
    const next = value.trim();
    const current = new URLSearchParams(window.location.search);
    if ((current.get("q") ?? "") === next) return;
    if (next) current.set("q", next);
    else current.delete("q");
    current.delete("view");
    const base = searchBasePath(window.location.pathname);
    const search = current.toString();
    startTransition(() => {
      router.push(search ? `${base}?${search}` : base);
    });
  }

  return (
    <label className={`relative block w-full max-w-xs ${pending ? "opacity-80" : ""}`}>
      <span className="sr-only">Search issues</span>
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        data-search
        data-testid="search"
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => commit(value), 200);
        }}
        placeholder="Search title, description, or ID"
        className="h-8 w-full rounded-md border border-line bg-black/20 pl-8 pr-10 text-[13px] outline-none placeholder:text-ink-faint focus:border-accent/80"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        <Kbd>/</Kbd>
      </span>
    </label>
  );
}
