import { AppShell } from "@/components/AppShell";
import { matchManagePath, matchPostPath, usePath } from "@/lib/router";
import { HomePage } from "@/pages/HomePage";
import { AlertsPage } from "@/pages/AlertsPage";
import { BoardPage } from "@/pages/BoardPage";
import { HelpPage } from "@/pages/HelpPage";
import { MePage } from "@/pages/MePage";
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
  else if (path === "/gk-lagbe") page = <BoardPage key="gk" type="gk_needed" />;
  else if (path === "/opponent-lagbe") page = <BoardPage key="opp" type="opponent_needed" />;
  else if (path === "/me") page = <MePage />;
  else if (path === "/help") page = <HelpPage />;
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
