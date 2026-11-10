"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PRIORITIES, STATUSES, UNASSIGNED, priorityLabel, statusLabel } from "@/lib/constants";
import { hasActiveFilters, toSearchParams, type IssueFilters } from "@/lib/filters";
import type { LabelDTO, UserDTO } from "@/lib/types";
import { cn } from "@/lib/cn";
import { LabelPill } from "@/components/avatar";
import { CloseIcon, PriorityIcon, SearchIcon, StatusIcon } from "@/components/icons";
import { Menu, MenuOption } from "@/components/menu";
import { Kbd } from "@/components/ui";

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function FilterBar({
  filters,
  members,
  labels,
}: {
  filters: IssueFilters;
  members: UserDTO[];
  labels: LabelDTO[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(filters.query);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    setText(filters.query);
  }, [filters.query]);

  useEffect(() => {
    if (text.trim() === filtersRef.current.query) return;
    const timeout = window.setTimeout(() => {
      update({ ...filtersRef.current, query: text.trim() });
    }, 200);
    return () => window.clearTimeout(timeout);
    // update is stable enough for the debounced query; filters are read from the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function update(next: IssueFilters) {
    const query = toSearchParams(next).toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  const active = hasActiveFilters(filters);

  return (
    <div className={cn("space-y-2", pending && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <span className="sr-only">Search issues</span>
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            data-search
            data-testid="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search title, description, or ID"
            className="h-8 w-full rounded-md border border-line bg-black/20 pl-8 pr-10 text-[13px] outline-none placeholder:text-ink-faint focus:border-accent/80"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Kbd>/</Kbd>
          </span>
        </label>
        <FilterButton
          testId="filter-status"
          label="Status"
          count={filters.statuses.length}
          menu={STATUSES.map((status) => (
            <MenuOption
              key={status.id}
              selected={filters.statuses.includes(status.id)}
              closeOnSelect={false}
              onSelect={() => update({ ...filters, statuses: toggleValue(filters.statuses, status.id) })}
            >
              <span className="inline-flex items-center gap-2">
                <StatusIcon status={status.id} />
                {status.label}
              </span>
            </MenuOption>
          ))}
        />
        <FilterButton
          testId="filter-priority"
          label="Priority"
          count={filters.priorities.length}
          menu={PRIORITIES.map((priority) => (
            <MenuOption
              key={priority.id}
              selected={filters.priorities.includes(priority.id)}
              closeOnSelect={false}
              onSelect={() => update({ ...filters, priorities: toggleValue(filters.priorities, priority.id) })}
            >
              <span className="inline-flex items-center gap-2">
                <PriorityIcon priority={priority.id} />
                {priority.label}
              </span>
            </MenuOption>
          ))}
        />
        <FilterButton
          testId="filter-assignee"
          label="Assignee"
          count={filters.assignees.length}
          menu={
            <>
              <MenuOption
                selected={filters.assignees.includes(UNASSIGNED)}
                closeOnSelect={false}
                onSelect={() => update({ ...filters, assignees: toggleValue(filters.assignees, UNASSIGNED) })}
              >
                Unassigned
              </MenuOption>
              {members.map((member) => (
                <MenuOption
                  key={member.id}
                  selected={filters.assignees.includes(member.id)}
                  closeOnSelect={false}
                  onSelect={() => update({ ...filters, assignees: toggleValue(filters.assignees, member.id) })}
                >
                  {member.name}
                </MenuOption>
              ))}
            </>
          }
        />
        <FilterButton
          testId="filter-label"
          label="Label"
          count={filters.labels.length}
          menu={labels.map((label) => (
            <MenuOption
              key={label.id}
              selected={filters.labels.includes(label.id)}
              closeOnSelect={false}
              onSelect={() => update({ ...filters, labels: toggleValue(filters.labels, label.id) })}
            >
              <LabelPill name={label.name} color={label.color} />
            </MenuOption>
          ))}
        />
        {active ? (
          <button
            type="button"
            onClick={() => {
              setText("");
              update({ statuses: [], priorities: [], assignees: [], labels: [], query: "" });
            }}
            className="h-8 rounded-md px-2 text-[12px] text-ink-muted hover:bg-white/5 hover:text-ink"
          >
            Clear filters
          </button>
        ) : null}
      </div>
      {active ? (
        <div className="flex flex-wrap gap-1.5">
          {filters.statuses.map((status) => (
            <Chip key={status} onRemove={() => update({ ...filters, statuses: filters.statuses.filter((item) => item !== status) })}>
              <StatusIcon status={status} />
              {statusLabel(status)}
            </Chip>
          ))}
          {filters.priorities.map((priority) => (
            <Chip key={priority} onRemove={() => update({ ...filters, priorities: filters.priorities.filter((item) => item !== priority) })}>
              <PriorityIcon priority={priority} />
              {priorityLabel(priority)}
            </Chip>
          ))}
          {filters.assignees.map((assigneeId) => (
            <Chip key={assigneeId} onRemove={() => update({ ...filters, assignees: filters.assignees.filter((item) => item !== assigneeId) })}>
              {assigneeId === UNASSIGNED ? "Unassigned" : (members.find((member) => member.id === assigneeId)?.name ?? "Assignee")}
            </Chip>
          ))}
          {filters.labels.map((labelId) => {
            const label = labels.find((item) => item.id === labelId);
            return (
              <Chip key={labelId} onRemove={() => update({ ...filters, labels: filters.labels.filter((item) => item !== labelId) })}>
                {label ? <LabelPill name={label.name} color={label.color} /> : "Label"}
              </Chip>
            );
          })}
          {filters.query ? (
            <Chip onRemove={() => { setText(""); update({ ...filters, query: "" }); }}>
              “{filters.query}”
            </Chip>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterButton({
  label,
  count,
  testId,
  menu,
}: {
  label: string;
  count: number;
  testId: string;
  menu: ReactNode;
}) {
  return (
    <Menu
      label={`Filter by ${label}`}
      testId={testId}
      trigger={
        <span
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-ink-muted hover:bg-white/[0.04] hover:text-ink",
            count > 0 && "border-accent/40 bg-accent/10 text-ink",
          )}
        >
          {label}
          {count > 0 ? <span className="rounded bg-accent/25 px-1.5 text-[11px] text-white">{count}</span> : null}
        </span>
      }
    >
      {menu}
    </Menu>
  );
}

function Chip({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-line bg-white/[0.03] pl-2 pr-1 text-[11px] text-ink-muted">
      {children}
      <button type="button" aria-label="Remove filter" onClick={onRemove} className="rounded-full p-0.5 hover:bg-white/10 hover:text-ink">
        <CloseIcon className="h-3 w-3" />
      </button>
    </span>
  );
}
