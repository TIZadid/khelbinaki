import { AppShell } from "@/components/AppShell";
import { matchManagePath, matchPostPath, usePath } from "@/lib/router";
import { HomePage } from "@/pages/HomePage";
import { KeeperPage } from "@/pages/KeeperPage";
import { ManagePage } from "@/pages/ManagePage";
import { NewPostPage } from "@/pages/NewPostPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PostPage } from "@/pages/PostPage";

export default function App() {
  const path = usePath();
  const postId = matchPostPath(path);
  const manageId = matchManagePath(path);

  let page;
  if (path === "/") page = <HomePage />;
  else if (path === "/keeper") page = <KeeperPage />;
  else if (path === "/new") page = <NewPostPage />;
  else if (manageId) page = <ManagePage key={manageId} id={manageId} />;
  else if (postId) page = <PostPage key={postId} id={postId} />;
  else page = <NotFoundPage />;

  return <AppShell>{page}</AppShell>;
}
