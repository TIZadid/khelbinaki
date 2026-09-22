const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Short public id for URLs. The slight modulo bias (256 % 62) doesn't matter for ids.
export function randomId(length = 10): string {
  let out = "";
  for (const b of crypto.getRandomValues(new Uint8Array(length))) out += ALPHABET[b % ALPHABET.length];
  return out;
}

// Private edit token: 32 unbiased random bytes, base64url without padding.
export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
