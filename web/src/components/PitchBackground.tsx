// Faint futsal/football pitch markings behind every page. Portrait pitch
// (700x1100 box, field 620x1020) sliced to cover the viewport: phones see the
// whole pitch, wide screens zoom in on the centre circle.
const stripes = Array.from({ length: 12 }, (_, i) => i);

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
        {stripes.map((i) =>
          i % 2 === 0 ? (
            <rect key={i} x="40" y={40 + i * 85} width="620" height="85" className="fill-primary/[0.025]" />
          ) : null,
        )}
        <g className="stroke-foreground/[0.08]" strokeWidth="2">
          <rect x="40" y="40" width="620" height="1020" />
          <line x1="40" y1="550" x2="660" y2="550" />
          <circle cx="350" cy="550" r="91.5" />
          <rect x="148.5" y="40" width="403" height="165" />
          <rect x="258.5" y="40" width="183" height="55" />
          <path d="M 276.9 205 A 91.5 91.5 0 0 0 423.1 205" />
          <rect x="148.5" y="895" width="403" height="165" />
          <rect x="258.5" y="1005" width="183" height="55" />
          <path d="M 276.9 895 A 91.5 91.5 0 0 1 423.1 895" />
          <path d="M 40 50 A 10 10 0 0 0 50 40 M 650 40 A 10 10 0 0 0 660 50 M 50 1060 A 10 10 0 0 0 40 1050 M 660 1050 A 10 10 0 0 0 650 1060" />
        </g>
        <g className="fill-foreground/[0.12]">
          <circle cx="350" cy="550" r="4" />
          <circle cx="350" cy="150" r="3" />
          <circle cx="350" cy="950" r="3" />
        </g>
      </svg>
      <div className="absolute -top-48 left-1/2 h-[28rem] w-[44rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
    </div>
  );
}
