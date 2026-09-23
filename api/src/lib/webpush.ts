// Web Push, VAPID only: we send a bodyless push, so no payload encryption is
// needed. The service worker fetches the newest games when it wakes up.
const ENCODER = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function audienceOf(endpoint: string): string {
  return new URL(endpoint).origin;
}

/** Signed proof that the push came from us, per RFC 8292. Valid for 12 hours. */
export async function buildVapidJwt(
  audience: string,
  subject: string,
  privateKeyPkcs8: string,
  now: Date = new Date(),
): Promise<string> {
  const header = base64url(ENCODER.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = base64url(
    ENCODER.encode(
      JSON.stringify({ aud: audience, exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60, sub: subject }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodeBase64url(privateKeyPkcs8) as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    ENCODER.encode(`${header}.${claims}`) as BufferSource,
  );
  return `${header}.${claims}.${base64url(signature)}`;
}

export type PushKeys = { publicKey: string; privateKey: string; subject: string };

/**
 * Sends one bodyless push. Returns "gone" when the browser has dropped the
 * subscription, so the caller can forget it.
 */
export async function sendPush(
  endpoint: string,
  keys: PushKeys,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Promise<"sent" | "gone" | "failed"> {
  const jwt = await buildVapidJwt(audienceOf(endpoint), keys.subject, keys.privateKey);
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
      TTL: "3600",
      "Content-Length": "0",
      Urgency: "normal",
    },
  });
  if (response.status === 404 || response.status === 410) return "gone";
  return response.ok ? "sent" : "failed";
}
