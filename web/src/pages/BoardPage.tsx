import { Feed } from "@/components/feed/Feed";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { usePageTitle } from "@/hooks/usePageTitle";
import { fetchFeed } from "@/lib/api";
import { LISTINGS, type ListingType } from "@/lib/listing";

/** A board's own page: GK Lagbe or Opponent Lagbe, with search and district filters. */
export function BoardPage({ type }: { type: ListingType }) {
  const copy = LISTINGS[type];
  const { state, retry } = useAsync(fetchFeed, []);
  const now = useNow();
  usePageTitle(copy.board);

  return (
    <>
      <div className="page-x pt-8 md:pt-10">
        <Breadcrumbs items={[{ label: copy.board }]} />
      </div>
      <Feed type={type} mode="page" state={state} retry={retry} now={now} />
    </>
  );
}
