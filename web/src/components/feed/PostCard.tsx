import { MessageCircle, Phone } from "lucide-react";
import { GlowCard } from "@/components/GlowCard";
import type { PublicPost } from "@/lib/api";
import { postPath, telUrl, whatsappContactUrl } from "@/lib/contact";
import { Link } from "@/lib/router";
import { formatCountdown, formatDay, formatTime, isStartingSoon } from "@/lib/time";
import { cn } from "@/lib/utils";

export function PostCard({ post, now, highlighted = false }: { post: PublicPost; now: Date; highlighted?: boolean }) {
  const start = new Date(post.start_datetime);
  const filled = post.status === "filled";
  const soon = !filled && isStartingSoon(start, now);
  const muted = highlighted ? "text-primary-foreground/70" : "text-muted-foreground";
  const action =
    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors";

  return (
    <GlowCard highlighted={highlighted} className={cn("flex h-full flex-col gap-4", filled && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {/* Stretched link: the whole card opens the post; the action buttons sit above it. */}
            <Link
              to={postPath(post.id)}
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {post.area}
            </Link>
          </p>
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

      {!filled && (
        <div className="relative z-10 flex gap-2">
          <a
            href={whatsappContactUrl(post, window.location.origin)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${post.host_name}`}
            className={cn(
              action,
              highlighted
                ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                : "border hover:border-primary hover:text-primary",
            )}
          >
            <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
          </a>
          <a
            href={telUrl(post.phone)}
            aria-label={`Call ${post.host_name}`}
            className={cn(
              action,
              "border",
              highlighted ? "border-primary-foreground/30 hover:bg-primary-foreground/10" : "hover:border-primary hover:text-primary",
            )}
          >
            <Phone aria-hidden="true" className="size-4" /> Call
          </a>
        </div>
      )}
    </GlowCard>
  );
}
