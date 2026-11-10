"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ClearFilters() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Button
      variant="subtle"
      onClick={() => {
        router.push(pathname);
      }}
    >
      Clear filters
    </Button>
  );
}
