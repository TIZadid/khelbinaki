import { Bell, ChevronRight, ClipboardList, HelpCircle, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { TelegramAccount } from "@/components/account/TelegramAccount";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { useAccount } from "@/hooks/useAccount";
import { useKeeperProfile } from "@/hooks/useKeeperProfile";
import { usePageTitle } from "@/hooks/usePageTitle";
import { loadAlertPrefs } from "@/lib/alertPrefs";
import { regionName } from "@/lib/bd";
import { LISTINGS } from "@/lib/listing";
import { loadMyPosts } from "@/lib/myPosts";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

/** Everything that's yours, in one place: sign-in, profile, posts, alerts. */
export function MePage() {
  usePageTitle("Me");
  const account = useAccount();
  const profile = useKeeperProfile();
  const posts = loadMyPosts().length;
  const alerts = loadAlertPrefs();

  const places = profile?.regions.map((r) => regionName(r) ?? r).join(", ");
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-24 md:px-10 md:pt-10">
      <Breadcrumbs items={[{ label: "Me" }]} />
      <h1 className="mt-6 font-display text-7xl leading-[0.86] font-extrabold uppercase">Me</h1>
      <p className="mt-3 text-[17px] text-muted-foreground">Your profile, your posts and your alerts — all in one place.</p>

      <div className="board-site mt-8">
        <TelegramAccount account={account} />
      </div>

      <ul className="mt-8 flex flex-col gap-3">
        <Row
          to="/keeper"
          icon={<UserRound className="size-6" />}
          title="Keeper profile"
          detail={profile ? `${profile.name}${places ? ` · ${places}` : ""}` : "Not set up yet — fills in your details for you"}
          tone={LISTINGS.gk_needed.tone}
        />
        <Row
          to="/my-posts"
          icon={<ClipboardList className="size-6" />}
          title="My posts"
          detail={posts > 0 ? `${posts} ${posts === 1 ? "post" : "posts"} on this phone` : "Nothing posted from this phone yet"}
        />
        <Row
          to="/alerts"
          icon={<Bell className="size-6" />}
          title="Alerts"
          detail={
            alerts
              ? `For ${alerts.boards.map((b) => LISTINGS[b].board).join(" and ")}`
              : "Hear about new posts near you"
          }
        />
        <Row to="/help" icon={<HelpCircle className="size-6" />} title="Help" detail="Answers in plain words" />
      </ul>
    </div>
  );
}

function Row({ to, icon, title, detail, tone = "board-site" }: { to: string; icon: ReactNode; title: string; detail: string; tone?: string }) {
  return (
    <li className={tone}>
      <Link
        to={to}
        className="group flex items-center gap-4 rounded-2xl border border-[#242a1f] bg-card/80 p-4 transition-[border-color,transform] duration-200 hover:border-board active:scale-[0.99] md:p-5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-board/15 text-board" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-2xl leading-none font-bold uppercase">{title}</span>
          <span className="mt-1.5 line-clamp-2 block text-[15px] text-muted-foreground">{detail}</span>
        </span>
        <ChevronRight aria-hidden="true" className={cn("size-5 shrink-0 text-subtle transition-transform group-hover:translate-x-1 group-hover:text-board")} />
      </Link>
    </li>
  );
}
