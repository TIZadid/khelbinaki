import { AppShell } from "@/components/AppShell";
import { matchPostPath, usePath } from "@/lib/router";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PostPage } from "@/pages/PostPage";

export default function App() {
  const path = usePath();
  const postId = matchPostPath(path);

  return (
    <AppShell>
      {path === "/" ? <HomePage /> : postId ? <PostPage key={postId} id={postId} /> : <NotFoundPage />}
    </AppShell>
  );
}
