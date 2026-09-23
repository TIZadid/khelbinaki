import { useMemo, useState } from "react";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import type { AsyncState } from "@/hooks/useAsync";
import type { PublicPost } from "@/lib/api";
import { formatDay, groupPosts, isStartingSoon } from "@/lib/time";
import { CountUp } from "@/components/motion/CountUp";
import { FadeUp } from "@/components/motion/FadeUp";
import { Plus } from "lucide-react";
import { Link } from "@/lib/router";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AreaChips, MY_AREAS_KEY, areaOptions } from "./AreaChips";
import { PostRow } from "./PostRow";

export function Feed({
  state,
  retry,
  now,
}: {
  state: AsyncState<PublicPost[]>;
  retry: () => void;
  now: Date;
}) {
  const keeper = useKeeperProfile();
  const myRegions = useMemo(() => new Set(keeper?.regions ?? []), [keeper]);
  // undefined = nothing picked yet, so open on the keeper's areas when those have games.
  const [area, setArea] = useState<string | null | undefined>(undefined);

  const posts = state.status === "ready" ? state.data : [];
  const openCount = posts.filter((p) => p.status === "open").length;
  const mine = (p: { district: string; division: string }) => myRegions.has(p.district) || myRegions.has(p.division);
  const hasMine = posts.some(mine);
  const selected = area !== undefined ? area : hasMine ? MY_AREAS_KEY : null;
  const visible =
    selected === MY_AREAS_KEY
      ? posts.filter(mine)
      : selected
        ? posts.filter((p) => p.district === selected)
        : posts;
  const soonest = visible.find((p) => p.status === "open" && isStartingSoon(new Date(p.start_datetime), now));

  return (
    <section id="games" aria-labelledby="games-heading" className="page-x scroll-mt-6 pb-24 md:pb-30">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6 md:pb-7">
        <div>
          <h2 id="games-heading" className="on-pitch font-display text-[52px] leading-[0.9] font-extrabold uppercase md:text-7xl">
            GK Lagbe
            {state.status === "ready" && (
              <sup className="ml-2 text-lg text-primary md:text-2xl">
                <CountUp value={openCount} />
              </sup>
            )}
          </h2>
          <p className="mt-2 text-[15px] text-muted-foreground">Games looking for a goalkeeper</p>
        </div>
        <Link
          to="/new"
          className={cn(btn.outline, "h-12 border-primary text-primary hover:bg-primary hover:text-primary-foreground")}
        >
          <Plus aria-hidden="true" className="size-4" /> Need a keeper
        </Link>
      </div>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading games" className="mt-10">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-26 border-t motion-safe:animate-pulse">
              <div className="mt-8 h-10 w-40 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-10 text-center">
          <p className="text-muted-foreground">Couldn't load games. Check your connection.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 h-11 rounded-full border border-line px-5 text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && posts.length === 0 && (
        <p className="mt-12 text-center text-muted-foreground">No games need a keeper right now. Check back soon.</p>
      )}

      {state.status === "ready" && posts.length > 0 && (
        <>
          <div className="mt-6">
            <AreaChips
              options={areaOptions(posts.map((p) => p.district))}
              selected={selected}
              onSelect={setArea}
              showMine={hasMine}
            />
          </div>
          {groupPosts(visible, now).map((group) => (
            <div key={group.key} className="pt-10 md:pt-12">
              <h3 className="eyebrow flex gap-4 pb-3.5 text-foreground">
                <span>{group.label}</span>
                {(group.key === "today" || group.key === "tomorrow") && (
                  <span className="text-subtle">{formatDay(new Date(group.posts[0].start_datetime))}</span>
                )}
              </h3>
              <ul className="border-b">
                {group.posts.map((post, i) => (
                  <li key={post.id}>
                    <FadeUp delay={Math.min(i, 6) * 0.05}>
                      <PostRow post={post} now={now} soonest={post.id === soonest?.id} />
                    </FadeUp>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
