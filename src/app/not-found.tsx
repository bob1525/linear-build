import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[12px] uppercase tracking-[0.16em] text-ink-faint">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mt-2 text-[13px] text-ink-muted">Check the link, or head back to your workspace.</p>
        <Link href="/" className="mt-5 inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-hover">
          Go to Northstar
        </Link>
      </div>
    </div>
  );
}
