"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addIssueRelationAction, removeIssueRelationAction } from "@/lib/actions/relations";
import type { ActivityDTO, IssueCandidate, IssueLinkDTO, IssueRelationGroups, UserDTO } from "@/lib/types";
import { Button, ErrorNote, TextField } from "@/components/ui";

const KINDS = [
  { id: "blocked_by", label: "Blocked by" },
  { id: "blocks", label: "Blocks" },
  { id: "related", label: "Related to" },
  { id: "sub_issue", label: "Sub-issue" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

export function IssueRelations({
  projectKey,
  issueId,
  issueKey,
  relations,
  candidates,
  currentUser,
  onActivity,
}: {
  projectKey: string;
  issueId: string;
  issueKey: string;
  relations: IssueRelationGroups;
  candidates: IssueCandidate[];
  currentUser: UserDTO;
  onActivity: (activity: ActivityDTO) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("blocked_by");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState<{ kind: Kind; link: IssueLinkDTO }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const signature = [
    relations.blockedBy.map((link) => link.issueId).join(","),
    relations.blocks.map((link) => link.issueId).join(","),
    relations.related.map((link) => link.issueId).join(","),
    relations.subIssues.map((link) => link.issueId).join(","),
    relations.parent?.issueId ?? "",
  ].join("|");

  useEffect(() => {
    setAdded([]);
    setRemoved([]);
  }, [signature]);

  function hidden(kindId: Kind, issue: string) {
    return removed.includes(`${kindId}:${issue}`);
  }

  function linksFor(kindId: Exclude<Kind, "sub_issue">, server: IssueLinkDTO[]) {
    const extras = added
      .filter((item) => item.kind === kindId && !server.some((link) => link.issueId === item.link.issueId))
      .map((item) => item.link);
    return [...server, ...extras].filter((link) => !hidden(kindId, link.issueId));
  }

  const subIssues = [
    ...relations.subIssues,
    ...added.filter((item) => item.kind === "sub_issue" && !relations.subIssues.some((link) => link.issueId === item.link.issueId)).map((item) => item.link),
  ].filter((link) => !hidden("sub_issue", link.issueId));
  const parent = relations.parent && !hidden("sub_issue", relations.parent.issueId) ? relations.parent : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await addIssueRelationAction({ issueId, target, kind });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const match = candidates.find((candidate) => candidate.key.toLowerCase() === target.trim().toLowerCase());
    const number = Number(target.trim().split("-").at(-1));
    const linkKey = match?.key ?? target.trim().toUpperCase();
    onActivity(relationActivity(currentUser, kind, linkKey, "add", result.data.otherIssueId));
    setAdded((current) => [
      ...current,
      {
        kind,
        link: {
          issueId: result.data.otherIssueId,
          key: linkKey,
          number: Number.isInteger(number) ? number : 0,
          title: match?.title ?? target.trim(),
          status: "backlog",
        },
      },
    ]);
    setTarget("");
    router.refresh();
  }

  async function remove(kindId: Kind, link: IssueLinkDTO) {
    setPending(true);
    setError(null);
    const result = await removeIssueRelationAction({ issueId, target: link.key, kind: kindId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onActivity(relationActivity(currentUser, kindId, link.key, "remove", link.issueId));
    setRemoved((current) => [...current, `${kindId}:${link.issueId}`]);
    router.refresh();
  }

  async function removeParent(link: IssueLinkDTO) {
    setPending(true);
    setError(null);
    const result = await removeIssueRelationAction({ issueId: link.issueId, target: issueKey, kind: "sub_issue" });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRemoved((current) => [...current, `sub_issue:${link.issueId}`]);
    router.refresh();
  }

  return (
    <section className="mt-8" aria-label="Relations">
      <h2 className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Relations</h2>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={submit}>
        <label className="sr-only" htmlFor="relation-kind">
          Relation type
        </label>
        <select
          id="relation-kind"
          data-testid="relation-kind"
          aria-label="Relation type"
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
          className="h-9 rounded-md border border-line bg-black/25 px-2 text-[13px] text-ink outline-none focus:border-accent/80"
        >
          {KINDS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <TextField
          aria-label="Issue key"
          data-testid="relation-target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder={`${projectKey}-12`}
          list="relation-issues"
          className="sm:max-w-xs"
        />
        <datalist id="relation-issues">
          {candidates.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {candidate.title}
            </option>
          ))}
        </datalist>
        <Button type="submit" size="sm" disabled={pending || target.trim().length === 0}>
          {pending ? "Saving…" : "Add relation"}
        </Button>
      </form>
      {error ? (
        <div className="mt-2" data-testid="relation-error">
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}
      <div className="mt-4 space-y-4">
        <RelationList title="Blocked by" testId="relations-blocked-by" links={linksFor("blocked_by", relations.blockedBy)} projectKey={projectKey} onRemove={(link) => void remove("blocked_by", link)} />
        <RelationList title="Blocks" testId="relations-blocks" links={linksFor("blocks", relations.blocks)} projectKey={projectKey} onRemove={(link) => void remove("blocks", link)} />
        <RelationList title="Related" testId="relations-related" links={linksFor("related", relations.related)} projectKey={projectKey} onRemove={(link) => void remove("related", link)} />
        <div data-testid="relations-parent">
          <h3 className="text-[12px] text-ink-muted">Parent</h3>
          {parent ? (
            <ul className="mt-1.5 space-y-1">
              <RelationRow link={parent} projectKey={projectKey} removeLabel={`Remove parent ${parent.key}`} onRemove={() => void removeParent(parent)} />
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-ink-faint">None</p>
          )}
        </div>
        <RelationList title="Sub-issues" testId="relations-subissues" links={subIssues} projectKey={projectKey} onRemove={(link) => void remove("sub_issue", link)} removePrefix="Remove sub-issue" />
      </div>
    </section>
  );
}

function relationActivity(actor: UserDTO, kind: Kind, key: string, mode: "add" | "remove", otherIssueId: string): ActivityDTO {
  const subIssue = kind === "sub_issue";
  return {
    id: `${mode}-${kind}-${otherIssueId}`,
    type: subIssue ? (mode === "add" ? "subissue_added" : "subissue_removed") : mode === "add" ? "relation_added" : "relation_removed",
    payload: JSON.stringify({ role: subIssue ? "child" : kind, key }),
    createdAt: new Date().toISOString(),
    actor,
  };
}

function RelationList({
  title,
  testId,
  links,
  projectKey,
  onRemove,
  removePrefix,
}: {
  title: string;
  testId: string;
  links: IssueLinkDTO[];
  projectKey: string;
  onRemove: (link: IssueLinkDTO) => void;
  removePrefix?: string;
}) {
  return (
    <div data-testid={testId}>
      <h3 className="text-[12px] text-ink-muted">{title}</h3>
      {links.length === 0 ? (
        <p className="mt-1 text-[13px] text-ink-faint">None</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {links.map((link) => (
            <RelationRow
              key={link.issueId}
              link={link}
              projectKey={projectKey}
              removeLabel={`${removePrefix ?? `Remove ${title.toLowerCase()}`} ${link.key}`}
              onRemove={() => onRemove(link)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RelationRow({
  link,
  projectKey,
  removeLabel,
  onRemove,
}: {
  link: IssueLinkDTO;
  projectKey: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2">
      <Link href={`/p/${projectKey}/issues/${link.number}`} className="min-w-0 truncate text-[13px] hover:text-white">
        <span className="mr-1.5 font-mono text-[11px] text-ink-faint">{link.key}</span>
        {link.title}
      </Link>
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="shrink-0 text-[11px] text-ink-faint hover:text-ink">
        Remove
      </button>
    </li>
  );
}
