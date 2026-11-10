import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">That page is not in this workspace</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-muted">
          The project or issue may have been removed, or you may not be a member.
        </p>
        <Link href="/" className="mt-5 inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-hover">
          Back to your projects
        </Link>
      </div>
    </div>
  );
}
