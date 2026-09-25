import { AppShell } from "@/components/AppShell";
import { matchManagePath, matchPostPath, usePath } from "@/lib/router";
import { HomePage } from "@/pages/HomePage";
import { AlertsPage } from "@/pages/AlertsPage";
import { ChaPage } from "@/pages/ChaPage";
import { KeeperPage } from "@/pages/KeeperPage";
import { ManagePage } from "@/pages/ManagePage";
import { MyPostsPage } from "@/pages/MyPostsPage";
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
  else if (path === "/alerts") page = <AlertsPage />;
  else if (path === "/my-posts") page = <MyPostsPage />;
  else if (path === "/cha") page = <ChaPage />;
  else if (path === "/new" || path === "/new/keeper") page = <NewPostPage key="gk" type="gk_needed" />;
  else if (path === "/new/opponent") page = <NewPostPage key="opponent" type="opponent_needed" />;
  else if (manageId) page = <ManagePage key={manageId} id={manageId} />;
  else if (postId) page = <PostPage key={postId} id={postId} />;
  else page = <NotFoundPage />;

  return <AppShell>{page}</AppShell>;
}
