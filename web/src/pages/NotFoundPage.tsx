import { LISTINGS } from "@/lib/listing";
import { Link } from "@/lib/router";

export function NotFoundPage() {
  return (
    <div className="page-x flex flex-col items-center py-24 text-center md:py-32">
      <p className="text-outline font-display text-[160px] leading-none font-extrabold md:text-[240px]" style={{ "--outline": "var(--board)" } as React.CSSProperties}>
        404
      </p>
      <h1 className="mt-4 font-display text-5xl font-extrabold uppercase">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">Offside. That link doesn't go anywhere on Khelbi Naki.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-5">
        {[LISTINGS.gk_needed, LISTINGS.opponent_needed].map((board) => (
          <Link key={board.anchor} to={`/#${board.anchor}`} className={`${board.tone} link-draw font-semibold text-board`}>
            Go to {board.board}
          </Link>
        ))}
      </div>
    </div>
  );
}
