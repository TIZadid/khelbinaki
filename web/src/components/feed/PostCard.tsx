import { GlowCard } from "@/components/GlowCard";
import type { PublicPost } from "@/lib/api";
import { formatCountdown, formatDay, formatTime, isStartingSoon } from "@/lib/time";
import { cn } from "@/lib/utils";

export function PostCard({ post, now, highlighted = false }: { post: PublicPost; now: Date; highlighted?: boolean }) {
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const soon = !filled && isStartingSoon(start, now);
  const muted = highlighted ? "text-primary-foreground/70" : "text-muted-foreground";

  return (
    <GlowCard highlighted={highlighted} className={cn("flex h-full flex-col gap-4", filled && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{post.area}</p>
          {post.turf_name && <p className={cn("truncate text-sm", muted)}>{post.turf_name}</p>}
        </div>
        {filled ? (
          <span className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold">Filled</span>
        ) : soon ? (
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
              highlighted ? "border-primary-foreground/30" : "border-primary/40 text-primary",
            )}
          >
            Starts {formatCountdown(start, now)}
          </span>
        ) : null}
      </div>

      <div>
        <p className="font-condensed text-5xl leading-none font-bold tracking-tight">{formatTime(start)}</p>
        <p className={cn("mt-1 text-sm", muted)}>
          {formatDay(start)}
          {post.duration_minutes ? ` · ${post.duration_minutes} min` : ""}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-current/10 pt-4">
        {post.cost_per_head != null ? (
          <p>
            <span className={cn("font-condensed text-3xl font-bold", !highlighted && "text-primary")}>
              ৳{post.cost_per_head}
            </span>
            <span className={cn("ml-1 text-sm", muted)}>/ head</span>
          </p>
        ) : (
          <p className={cn("text-sm", muted)}>Cost: ask host</p>
        )}
        <p className={cn("text-right text-sm", muted)}>
          {post.slots_needed > 1 ? `${post.slots_needed} keepers · ` : ""}by {post.host_name}
        </p>
      </div>
    </GlowCard>
  );
}
