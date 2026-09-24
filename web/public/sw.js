// Push arrives with no payload (that needs encryption keys we don't ship), so the
// worker fetches the posts itself and describes the newest one.
const API_URL = "https://khelbinaki-api.zlabz.workers.dev";

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "New on Khelbi Naki";
      let body = "A new post near you. Tap to see it.";
      let url = "/";

      try {
        // The push has no payload, so describe the newest open post on either
        // board: it's almost always the one that set this off.
        const response = await fetch(`${API_URL}/posts?type=all`);
        const { posts = [] } = await response.json();
        const next = posts
          .filter((post) => post.status === "open")
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
        if (next) {
          const start = new Date(next.start_datetime);
          const when = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Dhaka",
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          }).format(start);
          const place = next.turf_name ? `${next.turf_name}, ${next.area}` : next.area;
          if (next.listing_type === "opponent_needed") {
            const cost = next.cost_per_head != null ? ` · ৳${next.cost_per_head}/team` : "";
            const format = next.players_per_side ? ` · ${next.players_per_side}-a-side` : "";
            title = `New on Opponent Lagbe · ${next.team_name || next.area}`;
            body = `${place} · ${when}${format}${cost}`;
          } else {
            const cost = next.cost_per_head != null ? ` · ৳${next.cost_per_head}/head` : "";
            title = `New on GK Lagbe · ${next.area}`;
            body = `${place} · ${when}${cost}`;
          }
          url = `/p/${next.id}`;
        }
      } catch {
        // Offline: the generic message still gets them to the boards.
      }

      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "khelbinaki-new-post",
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
