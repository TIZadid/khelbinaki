import { buildMeta, escapeHtml, type MetaPost } from "../lib/ogMeta";

type SiteEnv = {
  ASSETS: Fetcher;
  API_URL: string;
};

const POST_PATH = /^\/p\/([0-9A-Za-z]{1,32})\/?$/;

/** Swaps the page's share tags for this game's details. */
class MetaRewriter {
  meta: { title: string; description: string; url: string };

  constructor(meta: { title: string; description: string; url: string }) {
    this.meta = meta;
  }

  element(element: Element) {
    const property = element.getAttribute("property") ?? element.getAttribute("name");
    if (property === "og:title" || property === "twitter:title") element.setAttribute("content", this.meta.title);
    if (property === "og:description" || property === "twitter:description" || property === "description")
      element.setAttribute("content", this.meta.description);
    if (property === "og:url") element.setAttribute("content", this.meta.url);
  }
}

class TitleRewriter {
  title: string;

  constructor(title: string) {
    this.title = title;
  }

  element(element: Element) {
    element.setInnerContent(escapeHtml(`${this.title} — Khelbi Naki`));
  }
}

export default {
  async fetch(request: Request, env: SiteEnv): Promise<Response> {
    const url = new URL(request.url);
    const match = POST_PATH.exec(url.pathname);
    const page = await env.ASSETS.fetch(request);

    if (!match || !page.headers.get("content-type")?.includes("text/html")) return page;

    try {
      const apiResponse = await fetch(`${env.API_URL}/posts/${match[1]}`);
      if (!apiResponse.ok) return page;
      const { post } = (await apiResponse.json()) as { post?: MetaPost };
      if (!post) return page;

      const meta = buildMeta(post, url.toString());
      return new HTMLRewriter()
        .on('meta[property^="og:"], meta[name^="twitter:"], meta[name="description"]', new MetaRewriter(meta))
        .on("title", new TitleRewriter(meta.title))
        .transform(page);
    } catch {
      // The API is down: serve the page with its default tags.
      return page;
    }
  },
};
