import { ArrowLeft, ArrowUpRight, Phone, Share2 } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { GlowCard } from "@/components/GlowCard";
import { useAsync } from "@/hooks/useAsync";
import { useNow } from "@/hooks/useNow";
import { fetchPost, type PublicPost } from "@/lib/api";
import { formatPhone, telUrl, whatsappContactUrl, whatsappShareUrl } from "@/lib/contact";
import { Link } from "@/lib/router";
import { formatCountdown, formatDay, formatTime, isStartingSoon } from "@/lib/time";

const button =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition-colors";

export function PostPage({ id, now: fixedNow }: { id: string; now?: Date }) {
  const { state, retry } = useAsync((signal) => fetchPost(id, signal), [id]);
  const liveNow = useNow();
  const now = fixedNow ?? liveNow;

  return (
    <div className="mx-auto max-w-2xl py-8 pb-20">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" /> All games
      </Link>

      <div className="mt-6">
        {state.status === "loading" && (
          <div aria-busy="true" aria-label="Loading game" className="h-96 rounded-lg border bg-card/60 motion-safe:animate-pulse" />
        )}

        {state.status === "error" && (
          <div role="alert" className="rounded-lg border bg-card/60 p-8 text-center">
            <p>Couldn't load this game. Check your connection.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-full border px-4 py-2 text-sm font-semibold hover:border-primary hover:text-primary"
            >
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && state.data === null && (
          <div className="rounded-lg border bg-card/60 p-8 text-center">
            <p>This game doesn't exist or was removed.</p>
            <Link to="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
              See open games
            </Link>
          </div>
        )}

        {state.status === "ready" && state.data && <PostDetail post={state.data} now={now} />}
      </div>
    </div>
  );
}

function PostDetail({ post, now }: { post: PublicPost; now: Date }) {
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const started = start.getTime() <= now.getTime();
  const contactable = !filled && !started;
  const origin = window.location.origin;

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
        <span className="font-condensed text-2xl font-bold text-primary">৳{post.cost_per_head}</span>
      ) : (
        "Ask host"
      ),
    ],
    ["Keepers needed", post.slots_needed],
    ["Host", post.host_name],
    ["Phone", <span className="whitespace-nowrap">{formatPhone(post.phone)}</span>],
  ];

  return (
    <GlowCard className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{post.area}</h1>
          {post.turf_name && <p className="mt-1 text-muted-foreground">{post.turf_name}</p>}
        </div>
        {filled ? (
          <span className="rounded-full border px-3 py-1 text-sm font-semibold">Filled</span>
        ) : started ? (
          <span className="rounded-full border px-3 py-1 text-sm font-semibold">Already started</span>
        ) : isStartingSoon(start, now) ? (
          <span className="rounded-full border border-primary/40 px-3 py-1 text-sm font-semibold text-primary">
            Starts {formatCountdown(start, now)}
          </span>
        ) : null}
      </div>

      <p className="mt-8 font-condensed text-7xl leading-none font-bold tracking-tight">{formatTime(start)}</p>
      <p className="mt-2 text-muted-foreground">
        {formatDay(start)}
        {post.duration_minutes ? ` · ${post.duration_minutes} min` : ""}
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
        {facts.map(([label, value]) => (
          <div key={label} className="bg-card p-4">
            <dt className="text-xs tracking-[0.15em] text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-1 font-semibold break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {post.notes && (
        <div className="mt-6">
          <h2 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">Notes from the host</h2>
          <p className="mt-2 whitespace-pre-line">{post.notes}</p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {contactable ? (
          <>
            <a
              href={whatsappContactUrl(post, origin)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} flex-1 bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              WhatsApp {post.host_name} <ArrowUpRight aria-hidden="true" className="size-4" />
            </a>
            <a href={telUrl(post.phone)} className={`${button} border hover:border-primary hover:text-primary`}>
              <Phone aria-hidden="true" className="size-4" /> Call
            </a>
            <a
              href={whatsappShareUrl(post, origin)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button} border hover:border-primary hover:text-primary`}
            >
              <Share2 aria-hidden="true" className="size-4" /> Share to a group
            </a>
          </>
        ) : (
          <p role="status" className="text-muted-foreground">
            {filled ? "This game is filled. The host has found a keeper." : "This match has already started."}
          </p>
        )}
      </div>
    </GlowCard>
  );
}
