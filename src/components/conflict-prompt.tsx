import { conflictCopy } from "@/lib/concurrency";
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
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-body"
        data-testid="conflict-prompt"
        className="w-full max-w-md rounded-xl border border-line bg-[#1b1c22] p-5 shadow-pop"
      >
        <h2 id="conflict-title" className="text-[16px] font-semibold tracking-tight">
          This issue changed
        </h2>
        <p id="conflict-body" className="mt-2 text-[13px] leading-6 text-ink-muted">
          {conflictCopy(actorName)}
        </p>
        {error ? <p className="mt-2 text-[12px] text-red-200">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="subtle" data-testid="conflict-reload" onClick={onReload} disabled={pending}>
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
