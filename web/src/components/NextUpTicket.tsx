import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PublicPost } from "@/lib/api";
import { districtName } from "@/lib/bd";
import { postPath } from "@/lib/contact";
import { formatLabel, isOpponent, listingOf } from "@/lib/listing";
import { Link } from "@/lib/router";
import { countdownParts, formatCountdown, formatTime } from "@/lib/time";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 overflow-hidden rounded-[14px] bg-muted pt-3 pb-2.5 text-center md:pt-4 md:pb-3">
      <p className="font-display text-[56px] leading-none font-bold md:text-7xl">
        {/* Each tick slides the old number out and the new one in. */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            className="inline-block"
            initial={{ y: "-60%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "60%", opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </p>
      <p className="mt-1 text-[10px] tracking-[0.2em] text-subtle md:mt-1.5 md:text-[11px]">{label}</p>
    </div>
  );
}

// The soonest open post on either board, styled like a match ticket (reference: soccer-club countdown).
export function NextUpTicket({ post, now }: { post: PublicPost; now: Date }) {
  const copy = listingOf(post);
  const start = new Date(post.start_datetime);
  const [first, second] = countdownParts(start, now);
  const place = [post.turf_name, post.area, districtName(post.district)].filter(Boolean).join(", ");
  const title = isOpponent(post) ? `${post.team_name ?? post.host_name} vs ?` : copy.headline;
  const format = formatLabel(post.players_per_side);

  return (
    <article aria-label="Next kick-off" className={`${copy.tone} overflow-hidden rounded-3xl border border-[#242a1f] bg-card/90 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.8)] backdrop-blur`}>
      <div className="flex flex-col gap-4 p-5 md:gap-6 md:px-8 md:pt-7 md:pb-8">
        <div className="eyebrow flex justify-between">
          <span>{copy.board}</span>
          <span className="text-board">Kicks off in</span>
        </div>
        <div className="flex items-center gap-3" role="timer" aria-label={`Starts ${formatCountdown(start, now)}`}>
          <TimeBox {...first} />
          <span aria-hidden="true" className="font-display text-4xl text-[#3a4233] md:text-5xl">
            :
          </span>
          <TimeBox {...second} />
        </div>
      </div>
      <div className="flex flex-col gap-4 border-t border-dashed border-line p-5 md:gap-5 md:px-8 md:pt-7 md:pb-8">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <Link to={postPath(post.id)} className="font-display text-[38px] leading-none font-bold hover:text-board md:text-[44px]">
              {formatTime(start)}
            </Link>
            <p className="mt-2 truncate font-semibold">{title}</p>
            <p className="mt-0.5 truncate text-muted-foreground">{[format, place].filter(Boolean).join(" · ")}</p>
          </div>
          {post.cost_per_head != null && (
            <div className="text-right">
              <p className="font-display text-3xl leading-none font-bold text-board md:text-4xl">৳{post.cost_per_head}</p>
              <p className="mt-1.5 text-sm text-subtle">{copy.costUnit}</p>
            </div>
          )}
        </div>
        <Link to={postPath(post.id)} className={cn(btn.primary, "h-13 w-full text-base")}>
          {post.contact_mode === "direct" ? copy.directAction : copy.requestAction}
          <ArrowUpRight aria-hidden="true" className="size-[18px]" />
        </Link>
      </div>
    </article>
  );
}
