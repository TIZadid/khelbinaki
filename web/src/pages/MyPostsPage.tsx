import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { fetchMe } from "@/lib/account";
import { type PublicPost, fetchPost } from "@/lib/api";
import { LISTINGS, isOpponent, listingOf } from "@/lib/listing";
import { type MyPost, forgetMyPost, loadMyPosts, managePath, rememberMyPost } from "@/lib/myPosts";
import { Link } from "@/lib/router";
import { formatDay, formatTime } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Row = MyPost & { state: "loading" | "failed" | "cleared" | { post: PublicPost } };

/** Posts made on this phone (or whose manage link was opened here). */
export function MyPostsPage() {
  usePageTitle("My posts");
  const [rows, setRows] = useState<Row[]>(() => loadMyPosts().map((p) => ({ ...p, state: "loading" as const })));

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      // Signed in with Telegram? The account's posts join this phone's list first.
      const me = await fetchMe().catch(() => null);
      for (const post of me?.posts ?? []) rememberMyPost(post);
      if (controller.signal.aborted) return;
      const mine = loadMyPosts();
      setRows(mine.map((p) => ({ ...p, state: "loading" as const })));
      for (const post of mine) check(post);
    };
    const check = (mine: MyPost) => {
      fetchPost(mine.id, controller.signal).then(
        (post) => {
          // A 404 means it ended and was cleaned up, or was deleted: only then forget it.
          if (!post) forgetMyPost(mine.id);
          setRows((all) => all.map((r) => (r.id === mine.id ? { ...r, state: post ? { post } : "cleared" } : r)));
        },
        () => {
          if (!controller.signal.aborted) setRows((all) => all.map((r) => (r.id === mine.id ? { ...r, state: "failed" } : r)));
        },
      );
    };
    load();
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-24 md:px-10 md:pt-10">
      <Breadcrumbs className="mb-6" items={[{ label: "Me", to: "/me" }, { label: "My posts" }]} />
      <p className="eyebrow text-primary">Saved on this phone</p>
      <h1 className="mt-3.5 font-display text-7xl leading-[0.86] font-extrabold uppercase">My posts</h1>
      <p className="mt-3 text-muted-foreground">
        Posts made on this phone, or whose manage link you opened here — and, if you continue with Telegram, every post
        you made signed in. Each is cleared two days after its match.
      </p>

      {rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted-foreground">
          <p>No posts on this phone.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {[LISTINGS.gk_needed, LISTINGS.opponent_needed].map((board) => (
              <Link key={board.anchor} to={board.newPath} className={cn(btn.outline, board.tone, "border-board text-board")}>
                {board.postCta}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <ul className="mt-8 border-b">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 border-t py-5">
              {typeof row.state === "object" ? (
                <PostLine post={row.state.post} manage={managePath(row.id, row.token)} />
              ) : (
                <p className="text-muted-foreground">
                  {row.state === "loading"
                    ? "Loading…"
                    : row.state === "cleared"
                      ? "Cleared — its match ended, or it was deleted."
                      : "Couldn't load this one. Check your connection."}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PostLine({ post, manage }: { post: PublicPost; manage: string }) {
  const copy = listingOf(post);
  const start = new Date(post.start_datetime);
  const state = post.status === "filled" ? copy.filledBadge : post.status === "archived" ? "Ended" : "Open";
  return (
    <>
      <div className={cn(copy.tone, "min-w-0")}>
        <p className="eyebrow">
          <span className="text-board">{copy.board}</span> · {formatDay(start)} · {state}
        </p>
        <p className="mt-1.5 line-clamp-2 text-lg font-semibold">{isOpponent(post) ? (post.team_name ?? post.area) : post.area}</p>
        <p className="text-sm text-muted-foreground">{formatTime(start)}</p>
      </div>
      <Link to={manage} className={cn(btn.outline, copy.tone, "shrink-0 border-board text-board")}>
        Manage
      </Link>
    </>
  );
}
