import { ArrowUpRight } from "lucide-react";
import type { PublicPost } from "@/lib/api";
import { districtName } from "@/lib/bd";
import { postPath } from "@/lib/contact";
import { formatLabel, isOpponent, listingOf } from "@/lib/listing";
import { Link } from "@/lib/router";
import { formatCountdown, formatTime, isStartingSoon } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const pill = "rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase";

/**
 * One post on a board: a thin-ruled row. Phones stack it; desktop lays it out as
 * columns. Keeper posts lead with the area; opponent posts lead with the team.
 */
export function PostRow({ post, now, soonest = false }: { post: PublicPost; now: Date; soonest?: boolean }) {
  const copy = listingOf(post);
  const opponent = isOpponent(post);
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const soon = !filled && isStartingSoon(start, now);
  const format = formatLabel(post.players_per_side);
  const title = opponent ? (post.team_name ?? post.host_name) : post.area;
  const detail = (
    opponent
      ? [post.area, post.turf_name, districtName(post.district)]
      : [post.turf_name, districtName(post.district), `by ${post.host_name}`]
  )
    .filter(Boolean)
    .join(" · ");
  const extras = [
    format,
    post.duration_minutes ? `${post.duration_minutes} min` : null,
    !opponent && post.slots_needed > 1 ? `${post.slots_needed} keepers` : null,
  ].filter(Boolean);

  return (
    <div
      data-soonest={soonest || undefined}
      className={cn(
        copy.tone,
        "group relative isolate grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 border-t py-5 [grid-template-areas:'time_price'_'place_place'_'act_act']",
        "md:h-28 md:grid-cols-[170px_minmax(0,1fr)_100px_80px_110px_200px] md:items-center md:gap-6 md:py-0 md:[grid-template-areas:'time_place_fmt_dur_price_act']",
        filled && "opacity-45",
      )}
    >
      {/* Hover wash + a lime edge that grows in from the middle. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -inset-x-3 -z-10 rounded-xl bg-foreground/[0.035] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100 group-active:duration-75 md:-inset-x-5"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3 bottom-3 -left-3 w-[3px] scale-y-0 rounded-full bg-board transition-transform duration-300 ease-out group-hover:scale-y-100 group-active:scale-y-100 md:-left-5"
      />

      <p
        className={cn(
          "font-display text-[44px] leading-none font-bold whitespace-nowrap transition-transform duration-300 ease-out [grid-area:time] md:text-[52px] md:group-hover:translate-x-1.5",
          soonest && "text-board",
        )}
      >
        {formatTime(start)}
      </p>

      <div className="min-w-0 [grid-area:place]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* Stretched link: the whole row opens the post; the action button sits above it. */}
          <Link
            to={postPath(post.id)}
            className="text-lg font-semibold after:absolute after:inset-0 hover:text-board focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring md:text-xl"
          >
            {title}
          </Link>
          {opponent && <span className="font-display text-lg font-bold text-subtle uppercase">vs ?</span>}
          {soon && <span className={cn(pill, "border-board text-board")}>{formatCountdown(start, now).replace(/^in/, "In")}</span>}
          {filled && <span className={cn(pill, "border-[#3a4233] text-muted-foreground")}>{copy.filledBadge}</span>}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-subtle md:truncate md:text-[15px]">
          {detail}
          {extras.length > 0 && <span className="md:hidden"> · {extras.join(" · ")}</span>}
        </p>
      </div>

      <p className="hidden text-[15px] font-medium text-foreground [grid-area:fmt] md:block">
        {format ?? ""}
        {!opponent && post.slots_needed > 1 && <span className="block text-sm font-normal text-subtle">{post.slots_needed} keepers</span>}
      </p>
      <p className="hidden text-[15px] text-muted-foreground [grid-area:dur] md:block">
        {post.duration_minutes ? `${post.duration_minutes} min` : ""}
      </p>
      <p className="self-start text-right [grid-area:price] md:self-center md:text-left">
        <span className="block font-display text-[28px] leading-none font-bold md:text-[32px]">
          {post.cost_per_head != null ? `৳${post.cost_per_head}` : "Ask"}
        </span>
        {post.cost_per_head != null && <span className="mt-1 block text-xs text-subtle">{copy.costUnit}</span>}
      </p>

      {!filled && (
        <div className="relative z-10 flex [grid-area:act] md:justify-end">
          <Link to={postPath(post.id)} className={cn(btn.outline, "flex-1 md:flex-none")}>
            {post.contact_mode === "direct" ? copy.directAction : copy.requestAction}
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </div>
      )}
    </div>
  );
}
