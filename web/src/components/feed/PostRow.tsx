import { MessageCircle, Phone } from "lucide-react";
import type { PublicPost } from "@/lib/api";
import { postPath, telUrl, whatsappContactUrl } from "@/lib/contact";
import { Link } from "@/lib/router";
import { formatCountdown, formatTime, isStartingSoon } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

const pill = "rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase";

// One game in the feed: a thin-ruled row. Phones stack it; desktop lays it out as columns.
export function PostRow({ post, now, soonest = false }: { post: PublicPost; now: Date; soonest?: boolean }) {
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const soon = !filled && isStartingSoon(start, now);
  const detail = [post.turf_name, `by ${post.host_name}`].filter(Boolean).join(" · ");

  return (
    <div
      data-soonest={soonest || undefined}
      className={cn(
        "relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 border-t py-5 [grid-template-areas:'time_price'_'place_place'_'act_act']",
        "md:h-26 md:grid-cols-[180px_minmax(0,1fr)_90px_90px_90px_200px] md:items-center md:gap-6 md:py-0 md:[grid-template-areas:'time_place_dur_keep_price_act']",
        filled && "opacity-40",
      )}
    >
      <p
        className={cn(
          "font-display text-[44px] leading-none font-bold whitespace-nowrap [grid-area:time] md:text-[52px]",
          soonest && "text-primary",
        )}
      >
        {formatTime(start)}
      </p>

      <div className="min-w-0 [grid-area:place]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stretched link: the whole row opens the game; the action buttons sit above it. */}
          <Link
            to={postPath(post.id)}
            className="text-lg font-semibold after:absolute after:inset-0 hover:text-primary focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring md:text-xl"
          >
            {post.area}
          </Link>
          {soon && <span className={cn(pill, "border-primary text-primary")}>{formatCountdown(start, now).replace(/^in/, "In")}</span>}
          {filled && <span className={cn(pill, "border-[#3a4233] text-muted-foreground")}>Filled</span>}
        </div>
        <p className="mt-1 truncate text-sm text-subtle md:text-[15px]">
          {detail}
          <span className="md:hidden">
            {post.duration_minutes ? ` · ${post.duration_minutes} min` : ""}
            {post.slots_needed > 1 ? ` · ${post.slots_needed} keepers` : ""}
          </span>
        </p>
      </div>

      <p className="hidden text-[15px] text-muted-foreground [grid-area:dur] md:block">
        {post.duration_minutes ? `${post.duration_minutes} min` : ""}
      </p>
      <p className="hidden text-[15px] text-muted-foreground [grid-area:keep] md:block">
        {post.slots_needed} {post.slots_needed === 1 ? "keeper" : "keepers"}
      </p>
      <p className="self-start font-display text-[28px] leading-none font-bold [grid-area:price] md:self-center md:text-[32px]">
        {post.cost_per_head != null ? `৳${post.cost_per_head}` : "Ask"}
      </p>

      {!filled && (
        <div className="relative z-10 flex gap-2 [grid-area:act] md:justify-end">
          <a
            href={whatsappContactUrl(post, window.location.origin)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${post.host_name}`}
            className={cn(btn.outline, "flex-1 md:flex-none")}
          >
            <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
          </a>
          <a href={telUrl(post.phone)} aria-label={`Call ${post.host_name}`} className={btn.icon}>
            <Phone aria-hidden="true" className="size-4" />
          </a>
        </div>
      )}
    </div>
  );
}
