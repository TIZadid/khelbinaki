export function GridBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="bg-grid absolute inset-0" />
      <div className="absolute -top-48 left-1/2 h-[28rem] w-[44rem] max-w-[140vw] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
    </div>
  );
}
