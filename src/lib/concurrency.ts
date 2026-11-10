export function sameVersion(baseUpdatedAt: string, currentUpdatedAt: string | Date) {
  const base = Date.parse(baseUpdatedAt);
  const current = currentUpdatedAt instanceof Date ? currentUpdatedAt.getTime() : Date.parse(currentUpdatedAt);
  return !Number.isNaN(base) && !Number.isNaN(current) && base === current;
}

export function shouldRejectStaleWrite(input: {
  baseUpdatedAt?: string | null;
  overwrite?: boolean;
  currentUpdatedAt: string | Date;
}) {
  if (input.overwrite) return false;
  if (!input.baseUpdatedAt) return false;
  return !sameVersion(input.baseUpdatedAt, input.currentUpdatedAt);
}

export function conflictCopy(actorName: string | null) {
  const who = actorName
    ? `${actorName} saved this issue after you started editing.`
    : "Someone else saved this issue after you started editing.";
  return `${who} Reload to see their changes, or overwrite them with yours.`;
}

export const CONFLICT_ERROR = conflictCopy(null);
