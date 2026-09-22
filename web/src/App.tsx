import { AppShell } from "@/components/AppShell";
import { matchPostPath, usePath } from "@/lib/router";
import { HomePage } from "@/pages/HomePage";
import { KeeperPage } from "@/pages/KeeperPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PostPage } from "@/pages/PostPage";

export default function App() {
  const path = usePath();
  const postId = matchPostPath(path);

  let page;
  if (path === "/") page = <HomePage />;
  else if (path === "/keeper") page = <KeeperPage />;
  else if (postId) page = <PostPage key={postId} id={postId} />;
  else page = <NotFoundPage />;

  return <AppShell>{page}</AppShell>;
}
