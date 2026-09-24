import { ChevronDown, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type CSSProperties, useMemo, useState } from "react";
import { CountUp } from "@/components/motion/CountUp";
import { Magnetic } from "@/components/motion/Magnetic";
import { RevealWords } from "@/components/motion/RevealWords";
import type { AsyncState } from "@/hooks/useAsync";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import type { PublicPost } from "@/lib/api";
import { LISTINGS, type ListingType } from "@/lib/listing";
import { Link } from "@/lib/router";
import { formatDay, groupPosts, isStartingSoon } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { AreaChips, MY_AREAS_KEY, areaOptions } from "./AreaChips";
import { PostRow } from "./PostRow";

// Past this many rows a board folds, so the second board is never buried.
const FOLD_AT = 8;

/**
 * One board: GK Lagbe or Opponent Lagbe. The home page fetches both in one
 * request and hands each board the whole list; it keeps only its own type.
 */
export function Feed({
  type = "gk_needed",
  index,
  state,
  retry,
  now,
}: {
  type?: ListingType;
  /** "01", "02": the board's number in the big outlined index. */
  index?: string;
  state: AsyncState<PublicPost[]>;
  retry: () => void;
  now: Date;
}) {
  const copy = LISTINGS[type];
  const keeper = useKeeperProfile();
  // Keeper profiles only follow places for keeper games.
  const myRegions = useMemo(() => new Set(type === "gk_needed" ? (keeper?.regions ?? []) : []), [keeper, type]);
  // undefined = nothing picked yet, so open on the keeper's places when those have games.
  const [area, setArea] = useState<string | null | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  const posts = state.status === "ready" ? state.data.filter((p) => (p.listing_type ?? "gk_needed") === type) : [];
  const openCount = posts.filter((p) => p.status === "open").length;
  const mine = (p: { district: string; division: string }) => myRegions.has(p.district) || myRegions.has(p.division);
  const hasMine = posts.some(mine);
  const selected = area !== undefined ? area : hasMine ? MY_AREAS_KEY : null;
  const visible =
    selected === MY_AREAS_KEY ? posts.filter(mine) : selected ? posts.filter((p) => p.district === selected) : posts;
  const shown = expanded ? visible : visible.slice(0, FOLD_AT);
  const soonest = visible.find((p) => p.status === "open" && isStartingSoon(new Date(p.start_datetime), now));
  const headingId = `${copy.anchor}-heading`;

  return (
    <section id={copy.anchor} aria-labelledby={headingId} className={cn("page-x scroll-mt-20 py-20 md:py-28", copy.tone)}>
      <div className="grid gap-6 border-b pb-7 md:grid-cols-[1fr_auto] md:items-end md:pb-9">
        <div className="flex items-end gap-5 md:gap-8">
          {index && (
            <span
              aria-hidden="true"
              className="text-outline hidden font-display text-[120px] leading-[0.78] font-extrabold md:block"
              style={{ "--outline": "var(--board)" } as CSSProperties}
            >
              {index}
            </span>
          )}
          <div>
            <h2 id={headingId} className="on-pitch font-display text-[56px] leading-[0.86] font-extrabold uppercase md:text-[96px]">
              <RevealWords text={copy.board} inView />
              {state.status === "ready" && (
                <sup className="ml-2 align-super text-lg text-board md:text-3xl">
                  <CountUp value={openCount} />
                </sup>
              )}
            </h2>
            <p className="mt-3 text-[15px] text-muted-foreground md:text-[17px]">
              {copy.tagline}
              {" · "}
              <Link to={type === "gk_needed" ? "/alerts?board=gk" : "/alerts?board=opp"} className="link-draw font-semibold text-board">
                {type === "gk_needed" ? "Get alerts for new games" : "Get alerts for new matches"}
              </Link>
            </p>
          </div>
        </div>
        <Magnetic className="inline-flex self-start md:self-end">
          <Link
            to={copy.newPath}
            className={cn(btn.outline, "h-12 border-board px-5 text-board hover:bg-board hover:text-board-foreground")}
          >
            <Plus aria-hidden="true" className="size-4" /> {copy.postCta}
          </Link>
        </Magnetic>
      </div>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label={`Loading ${copy.board}`} className="mt-10">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-26 border-t motion-safe:animate-pulse">
              <div className="mt-8 h-10 w-40 rounded-md bg-muted" />
            </div>
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-10 text-center">
          <p className="text-muted-foreground">Couldn't load {copy.board}. Check your connection.</p>
          <button type="button" onClick={retry} className={cn(btn.outline, "mt-4")}>
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && posts.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-5 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
          <p className="max-w-md text-muted-foreground">{copy.empty}</p>
          <Link to={copy.newPath} className={cn(btn.outline, "border-board text-board")}>
            <Plus aria-hidden="true" className="size-4" /> {copy.postCta}
          </Link>
        </div>
      )}

      {state.status === "ready" && posts.length > 0 && (
        <>
          <div className="mt-6">
            <AreaChips
              layoutId={`${copy.anchor}-chip`}
              options={areaOptions(posts.map((p) => p.district))}
              selected={selected}
              onSelect={(key) => {
                setArea(key);
                setExpanded(false);
              }}
              showMine={hasMine}
            />
          </div>
          {groupPosts(shown, now).map((group) => (
            <div key={group.key} className="pt-10 md:pt-12">
              <h3 className="eyebrow flex gap-4 pb-3.5 text-foreground">
                <span>{group.label}</span>
                {(group.key === "today" || group.key === "tomorrow") && (
                  <span className="text-subtle">{formatDay(new Date(group.posts[0].start_datetime))}</span>
                )}
              </h3>
              <ul className="border-b">
                <AnimatePresence initial={false}>
                  {group.posts.map((post, i) => (
                    <motion.li
                      key={post.id}
                      layout="position"
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{ duration: 0.55, delay: Math.min(i, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <PostRow post={post} now={now} soonest={post.id === soonest?.id} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </div>
          ))}
          {visible.length > FOLD_AT && (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className={cn(btn.outline, "mt-8 w-full sm:w-auto")}
            >
              {expanded ? "Show fewer" : `Show all ${visible.length}`}
              <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </>
      )}
    </section>
  );
}
