import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { fetchInterests, fetchPost, type Interest, type PublicPost, setPostStatus } from "@/lib/api";
import { formatPhone, postUrl, whatsappShareUrl } from "@/lib/contact";
import { tokenForPost } from "@/lib/myPosts";
import { Link } from "@/lib/router";
import { formatDay, formatTime } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

function tokenFromHash(): string | null {
  const match = /(?:^|[#&])t=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  return match ? match[1] : null;
}

export function ManagePage({ id }: { id: string }) {
  // The manage link carries the token; localStorage remembers it for later visits.
  const [token] = useState(() => tokenFromHash() ?? tokenForPost(id));
  const post = useAsync((signal) => fetchPost(id, signal), [id]);
  const interests = useAsync(
    (signal) => (token ? fetchInterests(id, token, signal) : Promise.resolve<Interest[]>([])),
    [id, token],
  );

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-16 md:px-10">
        <h1 className="font-display text-5xl font-extrabold uppercase">Manage link needed</h1>
        <p className="mt-4 text-muted-foreground">
          This page opens with the private link you got when you posted. Find it in the WhatsApp message you sent
          yourself, or post again.
        </p>
        <Link to="/" className="mt-6 inline-block font-semibold text-primary underline-offset-4 hover:underline">
          Back to open games
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-10 pb-20 md:px-10">
      {post.state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading your post" className="h-40 rounded-2xl bg-muted motion-safe:animate-pulse" />
      )}
      {post.state.status === "error" && (
        <p role="alert" className="text-muted-foreground">
          Couldn't load your post. Check your connection.
        </p>
      )}
      {post.state.status === "ready" && post.state.data === null && (
        <p className="text-muted-foreground">This post no longer exists.</p>
      )}
      {post.state.status === "ready" && post.state.data && (
        <ManageView
          post={post.state.data}
          token={token}
          interests={interests.state.status === "ready" ? interests.state.data : []}
          interestsFailed={interests.state.status === "error"}
        />
      )}
    </div>
  );
}

function ManageView({
  post: initial,
  token,
  interests,
  interestsFailed,
}: {
  post: PublicPost;
  token: string;
  interests: Interest[];
  interestsFailed: boolean;
}) {
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"link" | "manage" | null>(null);
  const start = new Date(post.start_datetime);
  const origin = window.location.origin;
  const filled = post.status === "filled";

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async (text: string, which: "link" | "manage") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
    } catch {
      setCopied(null);
    }
  };

  const toggleFilled = async () => {
    setBusy(true);
    try {
      setPost(await setPostStatus(post.id, token, filled ? "open" : "filled"));
    } catch {
      // Leave the post as it was; the button can be tapped again.
    }
    setBusy(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">Your post · {formatDay(start)}</p>
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
          <span aria-hidden="true" className={cn("size-[7px] rounded-full", filled ? "bg-muted-foreground" : "bg-primary")} />
          {filled ? "Filled" : "Open"}
        </span>
      </div>
      <h1 className="mt-3 font-display text-[56px] leading-[0.9] font-extrabold uppercase">
        {post.area} · {formatTime(start)}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {[post.turf_name, post.cost_per_head != null ? `৳${post.cost_per_head}` : "Cost: ask", `${post.slots_needed} keeper${post.slots_needed > 1 ? "s" : ""}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <section aria-labelledby="share-heading" className="mt-8 rounded-3xl bg-primary p-5 text-primary-foreground md:p-6">
        <h2 id="share-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
          Share your post
        </h2>
        <p className="mt-2 text-[15px] leading-snug">Most keepers come from groups. Post it where your players are.</p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <a
            href={whatsappShareUrl(post, origin)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-13 flex-1 items-center justify-center gap-2.5 rounded-full bg-[#0a0c09] font-semibold text-foreground"
          >
            <Share2 aria-hidden="true" className="size-[18px]" /> Share
          </a>
          <button
            type="button"
            onClick={() => copy(postUrl(post.id, origin), "link")}
            className="inline-flex h-13 items-center justify-center gap-2.5 rounded-full border border-[#0a0c09]/30 px-5 font-semibold"
          >
            <Copy aria-hidden="true" className="size-[18px] shrink-0" /> {copied === "link" ? "Copied" : "Copy link"}
          </button>
        </div>
      </section>

      {post.contact_mode === "requests" ? (
        <section aria-labelledby="interested-heading" className="mt-10">
          <div className="flex items-baseline justify-between gap-4 border-b pb-3.5">
            <h2 id="interested-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
              Interested
              <sup className="ml-1.5 text-sm text-primary">{interests.length}</sup>
            </h2>
            <span className="text-[13px] text-subtle">Only you see these</span>
          </div>
          {interestsFailed && (
            <p role="alert" className="mt-4 text-muted-foreground">
              Couldn't load the keepers who are interested.
            </p>
          )}
          {!interestsFailed && interests.length === 0 && (
            <p className="mt-4 text-muted-foreground">No requests yet. Share your post to get some.</p>
          )}
          <ul>
            {interests.map((keeper) => (
              <li key={keeper.phone} className="flex items-center justify-between gap-3 border-b py-4.5">
                <div className="min-w-0">
                  <p className="font-semibold">{keeper.name}</p>
                  {keeper.note && <p className="mt-1 text-sm leading-snug text-muted-foreground">{keeper.note}</p>}
                  <p className="mt-1 text-sm text-subtle">{formatPhone(keeper.phone)}</p>
                </div>
                <a
                  href={`https://wa.me/${keeper.phone}?text=${encodeURIComponent(
                    `Hi ${keeper.name}, about the game at ${post.turf_name ?? post.area} on ${formatDay(start)} at ${formatTime(start)} — are you still free to keep goal?`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp ${keeper.name}`}
                  className={btn.outline}
                >
                  <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3.5 text-[13px] leading-relaxed text-subtle">
            New requests don't send alerts. Keep this page bookmarked and check back.
          </p>
        </section>
      ) : (
        <p className="mt-10 text-[15px] leading-relaxed text-muted-foreground">
          Keepers tap Contact host on your post and message you on WhatsApp.
        </p>
      )}

      <section aria-labelledby="done-heading" className="mt-10 flex flex-col gap-3">
        <h2 id="done-heading" className="eyebrow text-subtle">
          {filled ? "Changed your mind?" : "Found your keeper?"}
        </h2>
        <button
          type="button"
          onClick={toggleFilled}
          disabled={busy}
          className="h-13 rounded-full border border-foreground font-semibold transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {filled ? "Reopen this post" : "Mark as filled"}
        </button>
        <p className="text-[13px] leading-relaxed text-subtle">
          {filled
            ? "Reopening puts it back in the feed and takes requests again."
            : "Your post stays up with a Filled badge and stops taking requests."}
        </p>
      </section>

      <section aria-labelledby="key-heading" className="mt-10 rounded-2xl border border-dashed border-line p-4.5">
        <h2 id="key-heading" className="font-semibold">
          This page's link is your key
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
          Anyone with it can manage this post. It's saved on this phone — copy it if you'll switch devices.
        </p>
        <button
          type="button"
          onClick={() => copy(`${origin}/p/${post.id}/manage#t=${token}`, "manage")}
          className={cn(btn.outline, "mt-3")}
        >
          <Copy aria-hidden="true" className="size-4" /> {copied === "manage" ? "Copied" : "Copy manage link"}
        </button>
      </section>
    </>
  );
}
