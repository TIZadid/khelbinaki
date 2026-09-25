// The two boards. Every piece of copy that differs between "a team needs a keeper"
// and "a team needs a team to play" lives here, so pages never hard-code either.
export type ListingType = "gk_needed" | "opponent_needed";

export const LISTING_TYPES: readonly ListingType[] = ["gk_needed", "opponent_needed"];

// Dhaka turfs are sold as 5-, 6-, 7- and 8-a-side pitches; 11 covers full-size grounds.
export const FORMATS = [5, 6, 7, 8, 11] as const;

export function formatLabel(playersPerSide: number | null | undefined): string | null {
  return playersPerSide ? `${playersPerSide}-a-side` : null;
}

export type ListingCopy = {
  /** Board name, as players say it. */
  board: string;
  /** Hash on the home page where this board's preview lives. */
  anchor: string;
  /** The board's own page. */
  path: string;
  /** Label in the phone's bottom tab bar. */
  short: string;
  tagline: string;
  /** The host's button: always specific, never a generic "Post a game". */
  postCta: string;
  newPath: string;
  /** Who is being looked for, singular. */
  seeking: string;
  empty: string;
  /** Row / ticket action for each contact mode. */
  directAction: string;
  requestAction: string;
  /** What the price covers. */
  costUnit: string;
  costLabel: string;
  costHint: string;
  filled: string;
  filledBadge: string;
  foundIt: string;
  interestedHeading: string;
  noRequests: string;
  shareLead: string;
  /** Link-preview and notification prefix. */
  headline: string;
  /** Colour scope (index.css): GK Lagbe amber, Opponent Lagbe green. Put it on anything that belongs to the board. */
  tone: "board-gk" | "board-opp";
};

export const LISTINGS: Record<ListingType, ListingCopy> = {
  gk_needed: {
    board: "GK Lagbe",
    anchor: "gk-lagbe",
    path: "/gk-lagbe",
    short: "GK Lagbe",
    tagline: "Games looking for a goalkeeper",
    postCta: "Need a keeper",
    newPath: "/new",
    seeking: "keeper",
    empty: "No games need a keeper right now. Check back soon, or turn on alerts from your keeper profile.",
    directAction: "Contact host",
    requestAction: "I'm interested",
    costUnit: "per head",
    costLabel: "Cost per head",
    costHint: "What the keeper pays, like everyone else",
    filled: "This game is filled. The host has found a keeper.",
    filledBadge: "Filled",
    foundIt: "Found your keeper?",
    interestedHeading: "Keepers interested",
    noRequests: "No keepers yet. Share your post in a group to get some.",
    shareLead: "Most keepers come from groups. Post it where your players are.",
    headline: "Keeper needed",
    tone: "board-gk",
  },
  opponent_needed: {
    board: "Opponent Lagbe",
    anchor: "opponent-lagbe",
    path: "/opponent-lagbe",
    short: "Opponent",
    tagline: "Teams looking for a match",
    postCta: "Need an opponent",
    newPath: "/new/opponent",
    seeking: "opponent",
    empty: "No teams are looking for a match right now. Post yours and be the first one on the board.",
    directAction: "Contact team",
    requestAction: "Take them on",
    costUnit: "per team",
    costLabel: "Cost per team",
    costHint: "Your opponents' share of the turf",
    filled: "This match is on. The team has found an opponent.",
    filledBadge: "Match on",
    foundIt: "Found your opponent?",
    interestedHeading: "Teams interested",
    noRequests: "No teams yet. Share your post in a group to find one.",
    shareLead: "Most matches come from groups. Post it where the teams are.",
    headline: "Opponent needed",
    tone: "board-opp",
  },
};

export function listingOf(post: { listing_type: string }): ListingCopy {
  return post.listing_type === "opponent_needed" ? LISTINGS.opponent_needed : LISTINGS.gk_needed;
}

export function isOpponent(post: { listing_type: string }): boolean {
  return post.listing_type === "opponent_needed";
}

/** "৳150 per head", "৳1500 per team", or null when the host left it blank. */
export function costText(post: { listing_type: string; cost_per_head: number | null }): string | null {
  return post.cost_per_head != null ? `৳${post.cost_per_head} ${listingOf(post).costUnit}` : null;
}
