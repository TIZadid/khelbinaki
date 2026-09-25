// A tiny toast bus: any component can confirm an action ("Link copied") without
// wiring props. <Toaster /> in the app shell shows them.
export type Toast = { id: number; message: string; tone: "ok" | "error" };

const EVENT = "khelbinaki:toast";
let next = 1;

export function toast(message: string, tone: Toast["tone"] = "ok") {
  window.dispatchEvent(new CustomEvent<Toast>(EVENT, { detail: { id: next++, message, tone } }));
}

export function onToast(listener: (toast: Toast) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<Toast>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
