"use client";

import { useEffect, useState } from "react";
import { formatAbsolute, formatRelativeTime } from "@/lib/format";

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const absolute = formatAbsolute(iso);
  const [label, setLabel] = useState(absolute);

  useEffect(() => {
    setLabel(formatRelativeTime(iso));
  }, [iso]);

  return (
    <time dateTime={iso} title={absolute} className={className}>
      {label}
    </time>
  );
}
