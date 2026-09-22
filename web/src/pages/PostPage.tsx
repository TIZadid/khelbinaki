import { ArrowLeft, MessageCircle, Share2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { ContactSheet } from "@/components/post/ContactSheet";
import { InterestForm } from "@/components/post/InterestForm";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchPost, type PublicPost } from "@/lib/api";
import { whatsappShareUrl } from "@/lib/contact";
import { Link } from "@/lib/router";
import { formatCountdown, formatDay, formatTime, isStartingSoon } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function PostPage({ id, now: fixedNow }: { id: string; now?: Date }) {
  const { state, retry } = useAsync((signal) => fetchPost(id, signal), [id]);
  const liveNow = useNow();
  const now = fixedNow ?? liveNow;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pt-6 pb-40 md:px-10 md:pt-10 md:pb-24">
      <Link
        to="/"
        className="inline-flex h-11 items-center gap-2 text-[15px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-[18px]" /> All games
      </Link>

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading game" className="mt-8 space-y-4 motion-safe:animate-pulse">
          <div className="h-16 w-2/3 rounded-md bg-muted" />
          <div className="h-28 w-1/2 rounded-md bg-muted" />
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="mt-10">
          <p className="text-muted-foreground">Couldn't load this game. Check your connection.</p>
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
          <p className="text-muted-foreground">This game doesn't exist or was removed.</p>
          <Link to="/" className="mt-4 inline-block font-semibold text-primary underline-offset-4 hover:underline">
            See open games
          </Link>
        </div>
      )}

      {state.status === "ready" && state.data && <PostDetail post={state.data} now={now} />}
    </div>
  );
}

function PostDetail({ post, now }: { post: PublicPost; now: Date }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const started = start.getTime() <= now.getTime();
  const soon = !filled && isStartingSoon(start, now);
  const contactable = !filled && !started;
  const origin = window.location.origin;
  const [clock, meridiem] = formatTime(start).split(" ");

  useEffect(() => {
    const previous = document.title;
    document.title = `${post.area} · ${formatTime(start)} — Khelbi Naki`;
    return () => {
      document.title = previous;
    };
  }, [post.area, post.start_datetime]); // eslint-disable-line react-hooks/exhaustive-deps -- start derives from start_datetime

  const facts: [string, ReactNode][] = [
    [
      "Cost per head",
      post.cost_per_head != null ? (
        <span className="font-display text-[34px] leading-none font-bold text-primary">৳{post.cost_per_head}</span>
      ) : (
        "Ask host"
      ),
    ],
    ["Keepers needed", <span className="font-display text-[34px] leading-none font-bold">{post.slots_needed}</span>],
    ["Host", post.host_name],
    ["Contact", post.contact_mode === "direct" ? "Message host" : "Send your number"],
  ];

  const status = filled ? " · filled" : started ? " · already started" : soon ? ` · starts ${formatCountdown(start, now)}` : "";

  return (
    <article className="mt-8 md:mt-10">
      <p className={cn("eyebrow", soon && "text-primary")}>
        {formatDay(start)}
        {status}
      </p>
      <h1 className="mt-3.5 font-display text-7xl leading-[0.88] font-extrabold uppercase md:text-8xl">{post.area}</h1>
      {post.turf_name && <p className="mt-2 text-[17px] text-muted-foreground">{post.turf_name}</p>}

      <p className="mt-9 flex items-baseline gap-3.5 font-display font-bold">
        <span className="text-[120px] leading-[0.85]">{clock}</span>
        <span className="text-[40px] font-semibold text-muted-foreground">{meridiem}</span>
      </p>
      {post.duration_minutes ? <p className="mt-2.5 text-[15px] text-subtle">{post.duration_minutes} minutes</p> : null}

      <dl className="mt-9 grid grid-cols-2 border-t">
        {facts.map(([label, value], i) => (
          <div key={label} className={cn("border-b py-[18px]", i % 2 === 0 ? "border-r pr-4" : "pl-4")}>
            <dt className="text-[11px] tracking-[0.18em] text-subtle uppercase">{label}</dt>
            <dd className="mt-1.5 text-lg font-semibold break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {post.notes && (
        <section aria-labelledby="notes-heading" className="mt-7">
          <h2 id="notes-heading" className="eyebrow text-subtle">
            Notes from the host
          </h2>
          <p className="mt-2.5 text-[17px] leading-relaxed whitespace-pre-line">{post.notes}</p>
        </section>
      )}

      {contactable && post.contact_mode === "requests" && <InterestForm post={post} />}

      {contactable && post.contact_mode === "direct" && (
        <>
          <p className="mt-7 text-[15px] leading-relaxed text-subtle">
            {post.host_name}'s number stays hidden until you tap Contact host.
          </p>
          {/* Sticky thumb bar on phones, inline row from tablets up. */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-[#0f120d] px-5 pt-3.5 pb-[max(1.625rem,env(safe-area-inset-bottom))] md:static md:mt-10 md:border-0 md:bg-transparent md:p-0">
            <div className="mx-auto flex max-w-3xl gap-2.5">
              <button type="button" onClick={() => setSheetOpen(true)} className={cn(btn.primary, "flex-1 md:flex-none")}>
                <MessageCircle aria-hidden="true" className="size-[18px]" /> Contact host
              </button>
              <a
                href={whatsappShareUrl(post, origin)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share to a group"
                className={cn(btn.icon, "size-14")}
              >
                <Share2 aria-hidden="true" className="size-5" />
              </a>
            </div>
          </div>
          {sheetOpen && <ContactSheet post={post} onClose={() => setSheetOpen(false)} />}
        </>
      )}

      {contactable && post.contact_mode === "requests" && (
        <a
          href={whatsappShareUrl(post, origin)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-7 inline-flex h-11 items-center gap-2.5 text-[15px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <Share2 aria-hidden="true" className="size-[18px]" /> Share to a group
        </a>
      )}

      {!contactable && (
        <p role="status" className="mt-10 text-muted-foreground">
          {filled ? "This game is filled. The host has found a keeper." : "This match has already started."}
        </p>
      )}

    </article>
  );
}
