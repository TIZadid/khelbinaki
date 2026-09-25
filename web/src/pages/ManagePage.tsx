import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { ShareButton } from "@/components/ShareButton";
import { deletePost, fetchInterests, fetchPost, type Interest, type PublicPost, setPostStatus } from "@/lib/api";
import { formatPhone, postUrl } from "@/lib/contact";
import { formatLabel, isOpponent, listingOf } from "@/lib/listing";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { forgetMyPost, rememberMyPost, tokenForPost } from "@/lib/myPosts";
import { usePostSection } from "@/lib/nav";
import { toast } from "@/lib/toast";
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
  // Right after posting the link carries &new=1: ask the host to save it.
  const [fresh] = useState(() => /(?:^|[#&])new=1/.test(window.location.hash));
  // A manage link opened on another phone: remember it there too, for My posts.
  useEffect(() => {
    if (token && tokenFromHash()) rememberMyPost({ id, token });
  }, [id, token]);
  const post = useAsync((signal) => fetchPost(id, signal), [id]);
  usePageTitle("Manage your post");
  usePostSection(post.state.status === "ready" && post.state.data ? post.state.data.listing_type : null);
  const interests = useAsync(
    (signal) => (token ? fetchInterests(id, token, signal) : Promise.resolve<Interest[]>([])),
    [id, token],
  );

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-16 md:px-10">
        <h1 className="font-display text-5xl font-extrabold uppercase">Manage link needed</h1>
        <p className="mt-4 text-muted-foreground">
          This page opens with the private link you got when you posted. Open it on the phone you posted from, find it
          wherever you saved it, or post again.
        </p>
        <Link to="/" className="link-draw mt-6 inline-block font-semibold text-board">
          Back to the boards
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 pt-8 pb-20 md:px-10 md:pt-10">
      <Breadcrumbs className="mb-6" items={[{ label: "Me", to: "/me" }, { label: "My posts", to: "/my-posts" }, { label: "Manage" }]} />
      {post.state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading your post" className="h-40 rounded-2xl bg-muted motion-safe:animate-pulse" />
      )}
      {post.state.status === "error" && (
        <p role="alert" className="text-muted-foreground">
          Couldn't load your post. Check your connection.
        </p>
      )}
      {post.state.status === "ready" && post.state.data === null && (
        <p className="text-muted-foreground">
          This post no longer exists. Posts, and the requests sent to them, are deleted two days after the match ends.
        </p>
      )}
      {post.state.status === "ready" && post.state.data && (
        <ManageView
          post={post.state.data}
          token={token}
          fresh={fresh}
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
  fresh,
  interests,
  interestsFailed,
}: {
  post: PublicPost;
  token: string;
  fresh: boolean;
  interests: Interest[];
  interestsFailed: boolean;
}) {
  const [post, setPost] = useState(initial);
  const board = listingOf(post);
  const opponent = isOpponent(post);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"link" | "manage" | null>(null);
  const start = new Date(post.start_datetime);
  const origin = window.location.origin;
  const filled = post.status === "filled";
  const manageUrl = `${origin}/p/${post.id}/manage#t=${token}`;
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm" | "busy" | "done" | "failed">("idle");

  const remove = async () => {
    setDeleteStep("busy");
    try {
      // "gone" means the cleanup got there first: either way it's deleted.
      await deletePost(post.id, token);
      forgetMyPost(post.id);
      setDeleteStep("done");
      toast("Post deleted");
    } catch {
      setDeleteStep("failed");
    }
  };

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = async (text: string, which: "link" | "manage") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      toast(which === "manage" ? "Manage link copied — keep it private" : "Post link copied");
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

  if (deleteStep === "done") {
    return (
      <div className={cn(board.tone, "py-6")}>
        <h1 className="font-display text-6xl leading-[0.9] font-extrabold uppercase">Deleted</h1>
        <p className="mt-3 text-muted-foreground">The post and any requests sent to it are gone for good.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/my-posts" className={btn.outline}>
            My posts
          </Link>
          <Link to={board.newPath} className={cn(btn.outline, "border-board text-board")}>
            {board.postCta}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={board.tone}>
      {fresh && (
        <section aria-labelledby="save-heading" className="mb-8 rounded-3xl border-2 border-board p-5 md:p-6">
          <h2 id="save-heading" className="font-display text-[30px] leading-none font-extrabold uppercase">
            Save this page's link
          </h2>
          <p className="mt-2 text-[15px] leading-snug text-muted-foreground">
            It's the only way to mark this post filled or delete it — there's no account to log back into. Send it to
            yourself now.
          </p>
          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`My Khelbi Naki manage link (private, don't share): ${manageUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(btn.primary, "h-13 text-base")}
            >
              Send to my WhatsApp
            </a>
            <button type="button" onClick={() => copy(manageUrl, "manage")} className={cn(btn.outline, "h-13")}>
              <Copy aria-hidden="true" className="size-4" /> {copied === "manage" ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>
      )}
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">Your post on {board.board} · {formatDay(start)}</p>
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
          <span aria-hidden="true" className={cn("size-[7px] rounded-full", filled ? "bg-muted-foreground" : "bg-board")} />
          {filled ? board.filledBadge : "Open"}
        </span>
      </div>
      <h1 className="mt-3 font-display text-[56px] leading-[0.9] font-extrabold uppercase">
        {opponent ? (post.team_name ?? post.area) : post.area} · {formatTime(start)}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {[
          opponent ? post.area : null,
          post.turf_name,
          formatLabel(post.players_per_side),
          post.cost_per_head != null ? `৳${post.cost_per_head} ${board.costUnit}` : "Cost: ask",
          opponent ? null : `${post.slots_needed} keeper${post.slots_needed > 1 ? "s" : ""}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <section aria-labelledby="share-heading" className="mt-8 rounded-3xl bg-board p-5 text-board-foreground md:p-6">
        <h2 id="share-heading" className="font-display text-[34px] leading-none font-extrabold uppercase">
          Share your post
        </h2>
        <p className="mt-2 text-[15px] leading-snug">{board.shareLead}</p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <ShareButton
            post={post}
            className="h-13 shrink-0 border-0 bg-[#0a0c09] font-semibold text-foreground hover:text-foreground sm:flex-1"
          >
            <Share2 aria-hidden="true" className="size-[18px]" /> Share
          </ShareButton>
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
              {board.interestedHeading}
              <sup className="ml-1.5 text-sm text-board">{interests.length}</sup>
            </h2>
            <span className="text-[13px] text-subtle">Only you see these</span>
          </div>
          {interestsFailed && (
            <p role="alert" className="mt-4 text-muted-foreground">
              Couldn't load who's interested. Refresh to try again.
            </p>
          )}
          {!interestsFailed && interests.length === 0 && (
            <p className="mt-4 text-muted-foreground">{board.noRequests}</p>
          )}
          <ul>
            {interests.map((keeper) => (
              // For opponent posts `name` is the other team's name.
              <li key={keeper.phone} className="flex items-center justify-between gap-3 border-b py-4.5">
                <div className="min-w-0">
                  <p className="font-semibold">{keeper.name}</p>
                  {keeper.note && <p className="mt-1 text-sm leading-snug text-muted-foreground">{keeper.note}</p>}
                  <p className="mt-1 text-sm text-subtle">{formatPhone(keeper.phone)}</p>
                </div>
                <a
                  href={`https://wa.me/${keeper.phone}?text=${encodeURIComponent(
                    opponent
                      ? `Hi ${keeper.name}, ${post.team_name ?? post.host_name} here, about the ${formatLabel(post.players_per_side) ?? "match"} at ${post.turf_name ?? post.area} on ${formatDay(start)} at ${formatTime(start)} — are you still on?`
                      : `Hi ${keeper.name}, about the game at ${post.turf_name ?? post.area} on ${formatDay(start)} at ${formatTime(start)} — are you still free to keep goal?`,
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
          {opponent
            ? "Teams tap Contact team on your post and message you on WhatsApp."
            : "Keepers tap Contact host on your post and message you on WhatsApp."}
        </p>
      )}

      <section aria-labelledby="done-heading" className="mt-10 flex flex-col gap-3">
        <h2 id="done-heading" className="eyebrow text-subtle">
          {filled ? "Changed your mind?" : board.foundIt}
        </h2>
        <button
          type="button"
          onClick={toggleFilled}
          disabled={busy}
          className="h-13 rounded-full border border-foreground font-semibold transition-colors hover:border-board hover:text-board disabled:opacity-60"
        >
          {filled ? "Reopen this post" : opponent ? "We have an opponent" : "Mark as filled"}
        </button>
        <p className="text-[13px] leading-relaxed text-subtle">
          {filled
            ? `Reopening puts it back on ${board.board} and takes requests again.`
            : `Your post stays up with a ${board.filledBadge} badge and stops taking requests.`}{" "}
          It leaves the board at kick-off and is deleted, with any requests, two days after the match.
        </p>
      </section>

      <section aria-labelledby="key-heading" className="mt-10 rounded-2xl border border-dashed border-line p-4.5">
        <h2 id="key-heading" className="font-semibold">
          This page's link is your key
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
          Anyone with it can manage this post, so share the post link with players — never this one. It's saved on this
          phone; copy it if you'll switch devices.
        </p>
        <button
          type="button"
          onClick={() => copy(manageUrl, "manage")}
          className={cn(btn.outline, "mt-3")}
        >
          <Copy aria-hidden="true" className="size-4" /> {copied === "manage" ? "Copied" : "Copy manage link"}
        </button>
      </section>

      <section aria-labelledby="delete-heading" className="mt-10 border-t pt-6">
        <h2 id="delete-heading" className="eyebrow text-subtle">
          Delete
        </h2>
        {deleteStep === "confirm" || deleteStep === "busy" ? (
          <div className="mt-3 rounded-2xl border border-destructive/60 p-4">
            <p className="font-semibold">Delete for good?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {interests.length > 0
                ? `This also removes ${interests.length} ${interests.length === 1 ? "request" : "requests"} sent to it.`
                : "It disappears from the board and its link stops working."}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={deleteStep === "busy"}
                className={cn(btn.outline, "border-destructive text-destructive hover:border-destructive hover:text-destructive disabled:opacity-60")}
              >
                {deleteStep === "busy" ? "Deleting…" : "Yes, delete"}
              </button>
              <button type="button" onClick={() => setDeleteStep("idle")} className={btn.outline}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDeleteStep("confirm")}
            className={cn(btn.outline, "mt-3 hover:border-destructive hover:text-destructive")}
          >
            Delete post
          </button>
        )}
        {deleteStep === "failed" && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            Couldn't delete. Check your connection and try again.
          </p>
        )}
      </section>
    </div>
  );
}
