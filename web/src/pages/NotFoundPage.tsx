import { Link } from "@/lib/router";

export function NotFoundPage() {
  return (
    <div className="py-24 text-center">
      <p className="font-condensed text-8xl font-bold text-primary">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <Link to="/" className="mt-6 inline-block text-primary underline-offset-4 hover:underline">
        Back to open games
      </Link>
    </div>
  );
}
