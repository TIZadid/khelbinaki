import { ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LISTINGS } from "@/lib/listing";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

type Answer = { q: string; a: ReactNode; words: string };

// Plain words, short sentences, the answer first (GOV.UK / Readability Guidelines).
const GROUPS: { title: string; items: Answer[] }[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is Khelbi Naki?",
        a: (
          <>
            A free board for futsal in Bangladesh. Teams post when they need a goalkeeper (<b>GK Lagbe</b>) or a team to
            play (<b>Opponent Lagbe</b>). Players see it and get in touch on WhatsApp.
          </>
        ),
        words: "about what is free board",
      },
      {
        q: "Does it cost anything?",
        a: "No. It is free. There are no fees, no ads and you do not need to sign up.",
        words: "free cost money price pay",
      },
      {
        q: "Do I need an account?",
        a: (
          <>
            No. Everything works without one. If you want your details and posts on every phone, you can{" "}
            <Link to="/me" className="link-inline font-semibold text-primary">
              continue with Telegram
            </Link>
            . It is optional.
          </>
        ),
        words: "account sign up login telegram register",
      },
    ],
  },
  {
    title: "Finding a game",
    items: [
      {
        q: "I am a keeper. How do I find a game?",
        a: (
          <>
            Open{" "}
            <Link to={LISTINGS.gk_needed.path} className="link-inline font-semibold text-gk">
              GK Lagbe
            </Link>
            . Pick your district, or search your area. Tap a game, then tap <b>Contact host</b> or <b>I'm interested</b>.
          </>
        ),
        words: "keeper goalkeeper find game gk lagbe join play",
      },
      {
        q: "My team wants a match. How do I find one?",
        a: (
          <>
            Open{" "}
            <Link to={LISTINGS.opponent_needed.path} className="link-inline font-semibold text-opp">
              Opponent Lagbe
            </Link>
            . Pick a team near you, then tap <b>Contact team</b> or <b>Take them on</b>.
          </>
        ),
        words: "team opponent match find play against",
      },
      {
        q: "How do I hear about new games?",
        a: (
          <>
            Turn on{" "}
            <Link to="/alerts" className="link-inline font-semibold text-primary">
              Alerts
            </Link>
            . Pick the board and your places. You can get a message on this phone, on Telegram, or both.
          </>
        ),
        words: "alerts notification telegram new games notify",
      },
    ],
  },
  {
    title: "Posting",
    items: [
      {
        q: "How do I post that I need a keeper?",
        a: (
          <>
            Tap{" "}
            <Link to={LISTINGS.gk_needed.newPath} className="link-inline font-semibold text-gk">
              Need a keeper
            </Link>
            . Fill in the place, time and cost. Tap <b>Post</b>. Then save the private link you get.
          </>
        ),
        words: "post need keeper create add",
      },
      {
        q: "How do I post that my team needs an opponent?",
        a: (
          <>
            Tap{" "}
            <Link to={LISTINGS.opponent_needed.newPath} className="link-inline font-semibold text-opp">
              Need an opponent
            </Link>
            . Add your team name, how many a side, the place and time. Tap <b>Post</b>.
          </>
        ),
        words: "post opponent team match create add",
      },
      {
        q: "What is the manage link?",
        a: "After you post, you get a private link. It is the only way to mark your post filled or delete it. Send it to yourself on WhatsApp. Do not share it with players — share the post link instead.",
        words: "manage link private edit key",
      },
      {
        q: "I lost my manage link. What now?",
        a: (
          <>
            Open{" "}
            <Link to="/my-posts" className="link-inline font-semibold text-primary">
              My posts
            </Link>{" "}
            on the phone you posted from. If you were signed in with Telegram, it is there on any phone. If not, the post
            leaves the board at kick-off by itself.
          </>
        ),
        words: "lost manage link find my posts recover",
      },
      {
        q: "How do I mark my post filled, or delete it?",
        a: "Open your post's manage page. Tap Mark as filled when you are sorted. Tap Delete post to remove it for good.",
        words: "filled done delete remove close post",
      },
      {
        q: "When does my post go away?",
        a: "It leaves the board at kick-off. It is deleted, with any numbers sent to it, two days after the match.",
        words: "expire disappear delete old post when",
      },
    ],
  },
  {
    title: "Your number and privacy",
    items: [
      {
        q: "Who can see my phone number?",
        a: "Numbers are never listed on the board. If you pick “message me”, your number is shown only to someone who taps Contact and passes a quick spam check. If you pick “send me their number”, nobody sees yours.",
        words: "phone number privacy private whatsapp see",
      },
      {
        q: "How do I delete my data?",
        a: (
          <>
            On a phone without an account, your details are only on that phone — tap <b>Delete profile</b>. If you signed
            in with Telegram, go to{" "}
            <Link to="/me" className="link-inline font-semibold text-primary">
              Me
            </Link>{" "}
            and tap <b>Delete my data</b>.
          </>
        ),
        words: "delete data privacy remove account",
      },
    ],
  },
];

export function HelpPage() {
  usePageTitle("Help");
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase();
  const groups = GROUPS.map((group) => ({
    ...group,
    items: words ? group.items.filter((item) => `${item.q} ${item.words}`.toLowerCase().includes(words)) : group.items,
  })).filter((group) => group.items.length > 0);
  // One match left? Open it straight away.
  const single = Boolean(words) && groups.flatMap((g) => g.items).length === 1;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pt-8 pb-24 md:px-10 md:pt-10">
      <Breadcrumbs items={[{ label: "Help" }]} />
      <h1 className="mt-6 font-display text-7xl leading-[0.86] font-extrabold uppercase">Help</h1>
      <p className="mt-3 text-[17px] text-muted-foreground">Short answers to common questions. Tap a question to open it.</p>

      <label htmlFor="help-search" className="sr-only">
        Search help
      </label>
      <div className="relative mt-7">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-subtle" />
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a question, e.g. “delete post”"
          className="h-14 w-full rounded-full border border-line bg-card/80 pr-12 pl-12 text-[17px] outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus-visible:border-primary focus-visible:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear the search box"
            className="absolute top-1/2 right-3 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-9">
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="eyebrow text-primary">{group.title}</h2>
            <ul className="mt-3 border-b">
              {group.items.map((item) => (
                <Question key={`${item.q}-${single}`} item={item} startOpen={single} />
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line p-8 text-center">
            <p className="text-muted-foreground">No answer matches "{query.trim()}".</p>
            <a
              href="https://github.com/TIZadid/khelbinaki/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="link-inline mt-3 inline-block font-semibold text-primary"
            >
              Ask us instead
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Question({ item, startOpen }: { item: Answer; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const id = `answer-${item.q.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <li className="border-t">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left text-[17px] font-semibold transition-colors hover:text-primary"
        >
          {item.q}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}>
            <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0", open ? "text-primary" : "text-subtle")} />
          </motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="pb-5 text-[16px] leading-relaxed text-muted-foreground [&_b]:text-foreground">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}
