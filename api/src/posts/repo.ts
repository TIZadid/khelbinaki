import type { NewPost } from "./validate";

export type PostStatus = "open" | "filled" | "archived";

export type PublicPost = {
  id: string;
  listing_type: string;
  host_name: string;
  phone: string;
  area: string;
  turf_name: string | null;
  start_datetime: string;
  duration_minutes: number | null;
  cost_per_head: number | null;
  slots_needed: number;
  notes: string | null;
  status: PostStatus;
  created_at: string;
};

// Everything except edit_token (private) and lat/lng (unused for now).
const PUBLIC_COLUMNS =
  "id, listing_type, host_name, phone, area, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, status, created_at";

const FEED_LIMIT = 100;

export async function insertPost(db: D1Database, id: string, editToken: string, post: NewPost): Promise<PublicPost> {
  const row = await db
    .prepare(
      `INSERT INTO posts (id, host_name, phone, area, turf_name, start_datetime, duration_minutes, cost_per_head, slots_needed, notes, edit_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${PUBLIC_COLUMNS}`,
    )
    .bind(
      id,
      post.host_name,
      post.phone,
      post.area,
      post.turf_name,
      post.start_datetime,
      post.duration_minutes,
      post.cost_per_head,
      post.slots_needed,
      post.notes,
      editToken,
    )
    .first<PublicPost>();
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listFeed(
  db: D1Database,
  now: Date,
  opts: { area?: string; listingType?: string } = {},
): Promise<PublicPost[]> {
  const where = ["listing_type = ?", "status != 'archived'", "start_datetime > ?"];
  const params: unknown[] = [opts.listingType ?? "gk_needed", now.toISOString()];
  if (opts.area) {
    where.push("area = ? COLLATE NOCASE");
    params.push(opts.area);
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
