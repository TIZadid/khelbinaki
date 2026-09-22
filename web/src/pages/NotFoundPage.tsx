import { Link } from "@/lib/router";

export function NotFoundPage() {
  return (
    <div className="page-x py-24 text-center">
      <p className="font-display text-9xl leading-none font-extrabold text-primary">404</p>
      <h1 className="mt-4 font-display text-4xl font-extrabold uppercase">Page not found</h1>
      <Link to="/" className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline">
        Back to open games
      </Link>
    </div>
  );
}
