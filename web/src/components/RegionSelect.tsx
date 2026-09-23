import { DIVISIONS, divisionRegion } from "@/lib/bd";

/**
 * One dropdown for the whole country: each division, then its districts.
 * `includeDivisions` adds an "All of X" option for keepers following a whole division.
 */
export function RegionSelect({
  id,
  value,
  onChange,
  includeDivisions = false,
  placeholder = "Choose a district",
  className,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  includeDivisions?: boolean;
  placeholder?: string;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid ? true : undefined}
      className={className}
    >
      <option value="">{placeholder}</option>
      {DIVISIONS.map((division) => (
        <optgroup key={division.slug} label={division.name}>
          {includeDivisions && <option value={divisionRegion(division.slug)}>All of {division.name}</option>}
          {division.districts.map((district) => (
            <option key={district.slug} value={district.slug}>
              {district.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
