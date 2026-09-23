import { type AnchorHTMLAttributes, useSyncExternalStore } from "react";
import { scrollToTarget } from "./smoothScroll";

// Minimal history-API router: the site Worker serves index.html for every path.
function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function navigate(to: string) {
  const samePage = new URL(to, window.location.href).pathname === window.location.pathname;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  const hash = new URL(to, window.location.href).hash;
  if (!hash) {
    scrollToTarget(0, true);
    return;
  }
  // "/#opponent-lagbe" from another page: wait for the home page to render, then glide there.
  if (!samePage) scrollToTarget(0, true);
  let tries = 0;
  const seek = () => {
    if (document.querySelector(hash)) scrollToTarget(hash, !samePage);
    else if (tries++ < 20) requestAnimationFrame(seek);
  };
  requestAnimationFrame(seek);
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
