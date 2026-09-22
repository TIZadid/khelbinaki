import { useState } from "react";
import { FadeUp } from "@/components/motion/FadeUp";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchFeed } from "@/lib/api";
import { groupPosts, isStartingSoon } from "@/lib/time";
import { AreaChips, areaOptions } from "./AreaChips";
import { LivePill } from "./LivePill";
import { PostCard } from "./PostCard";

export function Feed({ now: fixedNow }: { now?: Date }) {
  const { state, retry } = useAsync(fetchFeed, []);
  const liveNow = useNow();
  const now = fixedNow ?? liveNow;
  const [area, setArea] = useState<string | null>(null);

  const posts = state.status === "ready" ? state.data : [];
  const visible = area ? posts.filter((p) => p.area.trim().toLowerCase() === area) : posts;
  const soonest = visible.find((p) => p.status === "open" && isStartingSoon(new Date(p.start_datetime), now));

  return (
    <section id="games" aria-labelledby="games-heading" className="scroll-mt-6 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <h2 id="games-heading" className="text-2xl font-bold sm:text-3xl">
          Open games
        </h2>
        {state.status === "ready" && <LivePill count={posts.filter((p) => p.status === "open").length} />}
      </div>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading games" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 rounded-lg border bg-card/60 motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-8 rounded-lg border bg-card/60 p-8 text-center">
          <p>Couldn't load games. Check your connection.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
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
            <AreaChips options={areaOptions(posts.map((p) => p.area))} selected={area} onSelect={setArea} />
          </div>
          <div className="mt-8 space-y-10">
            {groupPosts(visible, now).map((group) => (
              <div key={group.key}>
                <h3 className="mb-4 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                  {group.label}
                  <sup className="ml-1 text-primary">{group.posts.length}</sup>
                </h3>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.posts.map((post, i) => (
                    <li key={post.id}>
                      <FadeUp delay={Math.min(i, 5) * 0.05} className="h-full">
                        <PostCard post={post} now={now} highlighted={post.id === soonest?.id} />
                      </FadeUp>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
