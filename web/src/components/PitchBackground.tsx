// Faint futsal/football pitch markings behind every page. Portrait pitch
// (700x1100 box, field 620x1020) sliced to cover the viewport: phones see the
// whole pitch, wide screens zoom in on the centre circle.
export function PitchBackground() {
  return (
    <div
      data-testid="pitch-bg"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="pitch-fade absolute inset-0 h-full w-full"
        viewBox="0 0 700 1100"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <g className="stroke-foreground/[0.06]" strokeWidth="1.5">
          <rect x="40" y="40" width="620" height="1020" />
          <line x1="40" y1="550" x2="660" y2="550" />
          <circle cx="350" cy="550" r="91.5" />
          <rect x="148.5" y="40" width="403" height="165" />
          <rect x="258.5" y="40" width="183" height="55" />
          <path d="M 276.9 205 A 91.5 91.5 0 0 0 423.1 205" />
          <rect x="148.5" y="895" width="403" height="165" />
          <rect x="258.5" y="1005" width="183" height="55" />
          <path d="M 276.9 895 A 91.5 91.5 0 0 1 423.1 895" />
        </g>
        <circle cx="350" cy="550" r="3" className="fill-foreground/[0.1]" />
      </svg>
    </div>
  );
}
