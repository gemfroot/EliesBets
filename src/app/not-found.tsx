import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="type-overline mb-2">404</p>
      <h1 className="type-display mb-3">Page not found</h1>
      <p className="type-muted mb-8 max-w-md">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
      >
        Back to home
      </Link>
    </div>
  );
}
