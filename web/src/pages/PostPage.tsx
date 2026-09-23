import { ArrowLeft, MessageCircle, Share2 } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Magnetic } from "@/components/motion/Magnetic";
import { ShareButton } from "@/components/ShareButton";
import { ContactSheet } from "@/components/post/ContactSheet";
import { InterestForm } from "@/components/post/InterestForm";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchPost, type PublicPost } from "@/lib/api";
import { districtName } from "@/lib/bd";
import { RevealWords } from "@/components/motion/RevealWords";
import { formatLabel, isOpponent, listingOf } from "@/lib/listing";
import { Link } from "@/lib/router";
import { formatCountdown, formatDay, formatTime, isStartingSoon } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function PostPage({ id, now: fixedNow }: { id: string; now?: Date }) {
  const { state, retry } = useAsync((signal) => fetchPost(id, signal), [id]);
  const liveNow = useNow();
  const now = fixedNow ?? liveNow;
  const board = listingOf(state.status === "ready" && state.data ? state.data : { listing_type: "gk_needed" });

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-28">
      <Link
        to={`/#${board.anchor}`}
        className="group inline-flex h-11 items-center gap-2 text-[15px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-[18px] transition-transform group-hover:-translate-x-1" /> {board.board}
      </Link>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading post" className="mt-8 space-y-4 motion-safe:animate-pulse">
          <div className="h-16 w-2/3 rounded-md bg-muted" />
          <div className="h-28 w-1/2 rounded-md bg-muted" />
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-10">
          <p className="text-muted-foreground">Couldn't load this post. Check your connection.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 h-11 rounded-full border border-line px-5 text-sm font-semibold hover:border-primary hover:text-primary"
          >
            Try again
          </button>
        </div>
      )}

      {state.status === "ready" && state.data === null && (
        <div className="mt-10">
          <p className="text-muted-foreground">This post doesn't exist or was removed.</p>
          <Link to="/" className="link-draw mt-4 inline-block font-semibold text-primary">
            Back to GK Lagbe and Opponent Lagbe
          </Link>
        </div>
      )}

      {state.status === "ready" && state.data && <PostDetail post={state.data} now={now} />}
    </div>
  );
}

function PostDetail({ post, now }: { post: PublicPost; now: Date }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const copy = listingOf(post);
  const opponent = isOpponent(post);
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const started = start.getTime() <= now.getTime();
  const soon = !filled && isStartingSoon(start, now);
  const contactable = !filled && !started;
  const [clock, meridiem] = formatTime(start).split(" ");
  const title = opponent ? (post.team_name ?? post.host_name) : post.area;
  const format = formatLabel(post.players_per_side);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${formatTime(start)} — Khelbi Naki`;
    return () => {
      document.title = previous;
    };
  }, [title, post.start_datetime]); // eslint-disable-line react-hooks/exhaustive-deps -- start derives from start_datetime

  const big = (value: ReactNode, lime = false) => (
    <span className={cn("font-display text-[34px] leading-none font-bold", lime && "text-primary")}>{value}</span>
  );
  const facts: [string, ReactNode][] = [
    [copy.costLabel, post.cost_per_head != null ? big(`৳${post.cost_per_head}`, true) : opponent ? "Ask the team" : "Ask host"],
    ["Format", format ? big(format) : "Ask"],
    opponent
      ? ["Length", post.duration_minutes ? big(`${post.duration_minutes} min`) : "Ask"]
      : ["Keepers needed", big(post.slots_needed)],
    [opponent ? "Captain" : "Host", post.host_name],
  ];

  const status = filled
    ? ` · ${copy.filledBadge.toLowerCase()}`
    : started
      ? " · already started"
      : soon
        ? ` · starts ${formatCountdown(start, now)}`
        : "";
  const place = (opponent ? [post.area, post.turf_name, districtName(post.district)] : [post.turf_name, districtName(post.district)])
    .filter(Boolean)
    .join(" · ");
  const contactHint = opponent
    ? `${post.host_name}'s number stays hidden until you tap Contact team.`
    : `${post.host_name}'s number stays hidden until you tap Contact host.`;

  return (
    <article className="mt-8 md:mt-12">
      <p className={cn("eyebrow", soon && "text-primary")}>
        {copy.board} · {formatDay(start)}
        {status}
      </p>
      <h1
        aria-label={title}
        className="on-pitch mt-4 font-display text-[clamp(4rem,14vw,8.5rem)] leading-[0.84] font-extrabold break-words uppercase"
      >
        <RevealWords text={title} />
      </h1>
      {opponent && (
        <p aria-hidden="true" className="on-pitch mt-1 flex items-baseline gap-4 font-display text-[clamp(3rem,10vw,6rem)] leading-[0.9] font-extrabold uppercase">
          <span className="text-outline" style={{ "--outline": "var(--line-strong)" } as CSSProperties}>
            vs
          </span>
          <RevealWords text="you?" delay={0.2} wordClassName="text-primary" />
        </p>
      )}
      <p className="mt-3 text-[17px] text-muted-foreground">{place}</p>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t pt-8">
        <p className="on-pitch flex items-baseline gap-3.5 font-display font-bold">
          <span className="text-[120px] leading-[0.85] md:text-[150px]">{clock}</span>
          <span className="text-[40px] font-semibold text-muted-foreground">{meridiem}</span>
        </p>
        {post.duration_minutes && !opponent ? <p className="pb-3 text-[15px] text-subtle">{post.duration_minutes} minutes</p> : null}
      </div>

      <dl className="mt-8 grid grid-cols-2 border-t md:grid-cols-4">
        {facts.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              "border-b py-[18px]",
              i % 2 === 0 ? "border-r pr-4" : "pl-4",
              "md:border-r md:px-5 md:first:pl-0 md:last:border-r-0",
            )}
          >
            <dt className="text-[11px] tracking-[0.18em] text-subtle uppercase">{label}</dt>
            <dd className="mt-2 text-lg font-semibold break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {post.notes && (
        <section aria-labelledby="notes-heading" className="mt-8">
          <h2 id="notes-heading" className="eyebrow text-subtle">
            {opponent ? "Notes from the team" : "Notes from the host"}
          </h2>
          <p className="mt-2.5 max-w-2xl text-[17px] leading-relaxed whitespace-pre-line">{post.notes}</p>
        </section>
      )}

      {contactable && post.contact_mode === "requests" && <InterestForm post={post} />}

      {contactable && post.contact_mode === "direct" && (
        <>
          <p className="mt-8 text-[15px] leading-relaxed text-subtle">{contactHint}</p>
          {/* Sticky thumb bar on phones, inline row from tablets up. */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-[#0f120d]/95 px-5 pt-3.5 pb-[max(1.625rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto flex max-w-4xl gap-2.5">
              <Magnetic className="flex flex-1 md:flex-none">
                <button type="button" onClick={() => setSheetOpen(true)} className={cn(btn.primary, "w-full")}>
                  <MessageCircle aria-hidden="true" className="size-[18px]" /> {copy.directAction}
                </button>
              </Magnetic>
              <ShareButton post={post} label="Share to a group" className={cn(btn.icon, "size-14 px-0")}>
                <Share2 aria-hidden="true" className="size-5" />
              </ShareButton>
            </div>
          </div>
          <AnimatePresence>{sheetOpen && <ContactSheet post={post} onClose={() => setSheetOpen(false)} />}</AnimatePresence>
        </>
      )}

      {contactable && post.contact_mode === "requests" && (
        <ShareButton post={post} label="Share to a group" className="mt-7 border-0 px-0 text-[15px] text-muted-foreground hover:text-foreground">
          <Share2 aria-hidden="true" className="size-[18px]" /> Share to a group
        </ShareButton>
      )}

      {!contactable && (
        <p role="status" className="mt-10 text-muted-foreground">
          {filled ? copy.filled : "This match has already started."}
        </p>
      )}
    </article>
  );
}
