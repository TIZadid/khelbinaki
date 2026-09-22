import { useMemo, useState } from "react";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import type { AsyncState } from "@/hooks/useAsync";
import type { PublicPost } from "@/lib/api";
import { formatDay, groupPosts, isStartingSoon } from "@/lib/time";
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
  const myAreas = useMemo(() => new Set((keeper?.areas ?? []).map((a) => a.trim().toLowerCase())), [keeper]);
  // undefined = nothing picked yet, so open on the keeper's areas when those have games.
  const [area, setArea] = useState<string | null | undefined>(undefined);

  const posts = state.status === "ready" ? state.data : [];
  const openCount = posts.filter((p) => p.status === "open").length;
  const areaKey = (p: { area: string }) => p.area.trim().toLowerCase();
  const hasMine = posts.some((p) => myAreas.has(areaKey(p)));
  const selected = area !== undefined ? area : hasMine ? MY_AREAS_KEY : null;
  const visible =
    selected === MY_AREAS_KEY
      ? posts.filter((p) => myAreas.has(areaKey(p)))
      : selected
        ? posts.filter((p) => areaKey(p) === selected)
        : posts;
  const soonest = visible.find((p) => p.status === "open" && isStartingSoon(new Date(p.start_datetime), now));

  return (
    <section id="games" aria-labelledby="games-heading" className="page-x scroll-mt-6 pb-24 md:pb-30">
      <div className="border-b pb-6 md:pb-7">
        <h2 id="games-heading" className="font-display text-[52px] leading-[0.9] font-extrabold uppercase md:text-7xl">
          Open games
          {state.status === "ready" && <sup className="ml-2 text-lg text-primary md:text-2xl">{openCount}</sup>}
        </h2>
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
        <p className="mt-12 text-center text-muted-foreground">No upcoming games yet. Check back soon.</p>
      )}

      {state.status === "ready" && posts.length > 0 && (
        <>
          <div className="mt-6">
            <AreaChips
              options={areaOptions(posts.map((p) => p.area))}
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
                {group.posts.map((post) => (
                  <li key={post.id}>
                    <PostRow post={post} now={now} soonest={post.id === soonest?.id} />
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
