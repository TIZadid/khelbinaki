// Bangladeshi mobile: 01[3-9] + 8 digits, optional 88 country code. Same rule as the API
// (api/src/posts/validate.ts); stored as 8801XXXXXXXXX for wa.me.
export function normalizeBdPhone(raw: string): string | null {
  const match = /^(?:88)?(01[3-9]\d{8})$/.exec(raw.replace(/\D/g, ""));
  return match ? `88${match[1]}` : null;
}
