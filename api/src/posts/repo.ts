import type { ContactMode, ListingType, NewInterest, NewPost } from "./validate";

export type PostStatus = "open" | "filled" | "archived";

export type PublicPost = {
  id: string;
  listing_type: ListingType;
  team_name: string | null;
  players_per_side: number | null;
  contact_mode: ContactMode;
  host_name: string;
  area: string;
  district: string;
  division: string;
  turf_name: string | null;
  start_datetime: string;
  duration_minutes: number | null;
  cost_per_head: number | null;
  slots_needed: number;
  notes: string | null;
  status: PostStatus;
  created_at: string;
};

// What the keeper-action gate needs, including the private phone.
export type ContactInfo = {
  phone: string;
  status: PostStatus;
  start_datetime: string;
  contact_mode: ContactMode;
};

export type Interest = { name: string; phone: string; note: string | null; created_at: string };

export const MAX_INTERESTS = 30;

// Everything except edit_token and phone (both private) and lat/lng (unused for now).
const PUBLIC_COLUMNS =
  "id, listing_type, team_name, players_per_side, contact_mode, host_name, area, district, division, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, status, created_at";

const FEED_LIMIT = 100;

export async function insertPost(db: D1Database, id: string, editToken: string, post: NewPost): Promise<PublicPost> {
  const row = await db
    .prepare(
      `INSERT INTO posts (id, listing_type, team_name, players_per_side, host_name, phone, area, district, division, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, contact_mode, edit_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${PUBLIC_COLUMNS}`,
    )
    .bind(
      id,
      post.listing_type,
      post.team_name,
      post.players_per_side,
      post.host_name,
      post.phone,
      post.area,
      post.district,
      post.division,
      post.turf_name,
      post.start_datetime,
      post.duration_minutes,
      post.cost_per_head,
      post.slots_needed,
      post.notes,
      post.contact_mode,
      editToken,
    )
    .first<PublicPost>();
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listFeed(
  db: D1Database,
  now: Date,
  // "all" returns both boards mixed; callers split them by listing_type.
  opts: { area?: string; district?: string; listingType?: ListingType | "all" } = {},
): Promise<PublicPost[]> {
  const where = ["status != 'archived'", "start_datetime > ?"];
  const params: unknown[] = [now.toISOString()];
  const type = opts.listingType ?? "gk_needed";
  if (type !== "all") {
    where.push("listing_type = ?");
    params.push(type);
  }
  if (opts.area) {
    where.push("area = ? COLLATE NOCASE");
    params.push(opts.area);
  }
  if (opts.district) {
    where.push("district = ?");
    params.push(opts.district.toLowerCase());
  }
  const { results } = await db
    .prepare(`SELECT ${PUBLIC_COLUMNS} FROM posts WHERE ${where.join(" AND ")} ORDER BY start_datetime ASC LIMIT ${FEED_LIMIT}`)
    .bind(...params)
    .all<PublicPost>();
  return results;
}

export async function getPost(db: D1Database, id: string): Promise<PublicPost | null> {
  return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM posts WHERE id = ?`).bind(id).first<PublicPost>();
}

export async function getContactInfo(db: D1Database, id: string): Promise<ContactInfo | null> {
  return db
    .prepare("SELECT phone, status, start_datetime, contact_mode FROM posts WHERE id = ?")
    .bind(id)
    .first<ContactInfo>();
}

export async function setStatus(
  db: D1Database,
  id: string,
  token: string,
  status: "open" | "filled",
): Promise<"ok" | "not_found" | "forbidden"> {
  const res = await db
    .prepare("UPDATE posts SET status = ? WHERE id = ? AND edit_token = ? AND status != 'archived'")
    .bind(status, id, token)
    .run();
  if (res.meta.changes > 0) return "ok";
  const exists = await db.prepare("SELECT 1 FROM posts WHERE id = ?").bind(id).first();
  return exists ? "forbidden" : "not_found";
}

// Same phone twice on one post is ignored (UNIQUE), so resubmitting is harmless.
export async function addInterest(
  db: D1Database,
  interestId: string,
  postId: string,
  interest: NewInterest,
): Promise<"created" | "duplicate" | "full"> {
  const count = await db.prepare("SELECT COUNT(*) AS n FROM interests WHERE post_id = ?").bind(postId).first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_INTERESTS) return "full";
  const res = await db
    .prepare("INSERT OR IGNORE INTO interests (id, post_id, name, phone, note) VALUES (?, ?, ?, ?, ?)")
    .bind(interestId, postId, interest.name, interest.phone, interest.note)
    .run();
  return res.meta.changes > 0 ? "created" : "duplicate";
}

export async function listInterests(
  db: D1Database,
  postId: string,
  token: string,
): Promise<Interest[] | "not_found" | "forbidden"> {
  const owner = await db.prepare("SELECT edit_token FROM posts WHERE id = ?").bind(postId).first<{ edit_token: string }>();
  if (!owner) return "not_found";
  if (!token || owner.edit_token !== token) return "forbidden";
  const { results } = await db
    .prepare("SELECT name, phone, note, created_at FROM interests WHERE post_id = ? ORDER BY created_at ASC, rowid ASC")
    .bind(postId)
    .all<Interest>();
  return results;
}

/** Removes a post and every request sent to it. The edit token proves ownership. */
export async function deletePost(db: D1Database, id: string, token: string): Promise<"ok" | "not_found" | "forbidden"> {
  const owner = await db.prepare("SELECT edit_token FROM posts WHERE id = ?").bind(id).first<{ edit_token: string }>();
  if (!owner) return "not_found";
  if (!token || owner.edit_token !== token) return "forbidden";
  // Requests first, so this never depends on foreign-key cascades being on.
  await db.batch([
    db.prepare("DELETE FROM interests WHERE post_id = ?").bind(id),
    db.prepare("DELETE FROM posts WHERE id = ?").bind(id),
  ]);
  return "ok";
}
