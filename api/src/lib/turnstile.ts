export type VerifyHuman = (token: string, ip: string | null) => Promise<boolean>;

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileVerifier(
  secret: string | undefined,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): VerifyHuman {
  return async (token, ip) => {
    if (!secret) return false;
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const res = await fetcher(SITEVERIFY, { method: "POST", body: form });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  };
}
