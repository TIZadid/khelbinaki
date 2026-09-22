import { type AnchorHTMLAttributes, useSyncExternalStore } from "react";

// Minimal history-API router: the site Worker serves index.html for every path.
function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function navigate(to: string) {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
        if (e.defaultPrevented || modified || rest.target === "_blank") return;
        e.preventDefault();
        navigate(to);
      }}
    />
  );
}

export function matchPostPath(path: string): string | null {
  return /^\/p\/([0-9A-Za-z]{1,32})\/?$/.exec(path)?.[1] ?? null;
}

export function matchManagePath(path: string): string | null {
  return /^\/p\/([0-9A-Za-z]{1,32})\/manage\/?$/.exec(path)?.[1] ?? null;
}
