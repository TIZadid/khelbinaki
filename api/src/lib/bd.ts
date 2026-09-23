// Bangladesh's 8 divisions and 64 districts. Shipped with the app so keepers and
// hosts pick from the same fixed list instead of typing free text.
// Keep web/src/lib/bd.ts identical.
export type Division = { slug: string; name: string; districts: { slug: string; name: string }[] };

const district = (name: string, slug?: string) => ({
  slug: slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  name,
});

export const DIVISIONS: Division[] = [
  {
    slug: "barishal",
    name: "Barishal",
    districts: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"].map((n) => district(n)),
  },
  {
    slug: "chattogram",
    name: "Chattogram",
    districts: [
      "Bandarban",
      "Brahmanbaria",
      "Chandpur",
      "Chattogram",
      "Cumilla",
      "Feni",
      "Khagrachhari",
      "Lakshmipur",
      "Noakhali",
      "Rangamati",
    ]
      .map((n) => district(n))
      .concat(district("Cox's Bazar", "coxs-bazar"))
      .sort((a, b) => a.name.localeCompare(b.name)),
  },
  {
    slug: "dhaka",
    name: "Dhaka",
    districts: [
      "Dhaka",
      "Faridpur",
      "Gazipur",
      "Gopalganj",
      "Kishoreganj",
      "Madaripur",
      "Manikganj",
      "Munshiganj",
      "Narayanganj",
      "Narsingdi",
      "Rajbari",
      "Shariatpur",
      "Tangail",
    ].map((n) => district(n)),
  },
  {
    slug: "khulna",
    name: "Khulna",
    districts: [
      "Bagerhat",
      "Chuadanga",
      "Jashore",
      "Jhenaidah",
      "Khulna",
      "Kushtia",
      "Magura",
      "Meherpur",
      "Narail",
      "Satkhira",
    ].map((n) => district(n)),
  },
  {
    slug: "mymensingh",
    name: "Mymensingh",
    districts: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"].map((n) => district(n)),
  },
  {
    slug: "rajshahi",
    name: "Rajshahi",
    districts: [
      "Bogura",
      "Chapai Nawabganj",
      "Joypurhat",
      "Naogaon",
      "Natore",
      "Pabna",
      "Rajshahi",
      "Sirajganj",
    ].map((n) => district(n)),
  },
  {
    slug: "rangpur",
    name: "Rangpur",
    districts: [
      "Dinajpur",
      "Gaibandha",
      "Kurigram",
      "Lalmonirhat",
      "Nilphamari",
      "Panchagarh",
      "Rangpur",
      "Thakurgaon",
    ].map((n) => district(n)),
  },
  {
    slug: "sylhet",
    name: "Sylhet",
    districts: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"].map((n) => district(n)),
  },
];

// A division's region slug is prefixed: every division shares its name with one of
// its districts (Sylhet the division vs Sylhet the district), so plain slugs clash.
export const DIVISION_PREFIX = "div-";

const DISTRICT_INDEX = new Map(
  DIVISIONS.flatMap((division) =>
    division.districts.map(
      (d) => [d.slug, { name: d.name, division: `${DIVISION_PREFIX}${division.slug}`, divisionName: division.name }] as const,
    ),
  ),
);
const DIVISION_INDEX = new Map(
  DIVISIONS.map((division) => [`${DIVISION_PREFIX}${division.slug}`, division.name] as const),
);

export function isDistrict(slug: string): boolean {
  return DISTRICT_INDEX.has(slug);
}

export function divisionOf(districtSlug: string): string | null {
  return DISTRICT_INDEX.get(districtSlug)?.division ?? null;
}

export function districtName(slug: string): string | null {
  return DISTRICT_INDEX.get(slug)?.name ?? null;
}

export function divisionName(slug: string): string | null {
  return DIVISION_INDEX.get(slug) ?? null;
}

/** The region slug that means "the whole of this division". */
export function divisionRegion(divisionSlug: string): string {
  return `${DIVISION_PREFIX}${divisionSlug}`;
}

/** A region is either a district or a whole division. */
export function isRegion(slug: string): boolean {
  return isDistrict(slug) || DIVISION_INDEX.has(slug);
}

export function regionName(slug: string): string | null {
  return districtName(slug) ?? (DIVISION_INDEX.has(slug) ? `All of ${DIVISION_INDEX.get(slug)}` : null);
}
