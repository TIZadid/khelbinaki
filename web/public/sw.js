// Push arrives with no payload (that needs encryption keys we don't ship), so the
// worker fetches the newest games itself and describes the closest one.
const API_URL = "https://khelbinaki-api.zlabz.workers.dev";

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "New on GK Lagbe";
      let body = "A game near you needs a keeper. Tap to see it.";
      let url = "/#gk-lagbe";

      try {
        const response = await fetch(`${API_URL}/posts?type=gk_needed`);
        const { posts = [] } = await response.json();
        const next = posts.find((post) => post.status === "open");
        if (next) {
          const start = new Date(next.start_datetime);
          const when = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Dhaka",
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(start);
          const place = next.turf_name ? `${next.turf_name}, ${next.area}` : next.area;
          const cost = next.cost_per_head != null ? ` · ৳${next.cost_per_head}/head` : "";
          title = `Keeper needed · ${next.area}`;
          body = `${place} · ${when}${cost}`;
          url = `/p/${next.id}`;
        }
      } catch {
        // Offline: the generic message still gets them to the feed.
      }

      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "khelbinaki-new-game",
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        await open.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
