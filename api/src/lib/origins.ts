// `list` is comma-separated; "*" matches part of one DNS label (for preview URLs
// like https://<version>-khelbinaki.zlabz.workers.dev).
export function isAllowedOrigin(origin: string, list: string): boolean {
  return list
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => {
      const pattern = entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]+");
      return new RegExp(`^${pattern}$`).test(origin);
    });
}
