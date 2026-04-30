import { useMount } from "ahooks";
import { Layout, Spin } from "antd";
import { t } from "i18next";
import { Outlet, useMatches, useNavigate } from "react-router-dom";

import { useUserStore } from "@/store";

import LeftNavBar from "./LeftNavBar";
import TopSearchBar from "./TopSearchBar";
import { useGlobalEvent } from "./useGlobalEvents";

export const MainContentLayout = () => {
  useGlobalEvent();
  const matches = useMatches();
  const navigate = useNavigate();

  const progress = useUserStore((state) => state.progress);
  const syncState = useUserStore((state) => state.syncState);
  const reinstall = useUserStore((state) => state.reinstall);
  const isLogining = useUserStore((state) => state.isLogining);

  useMount(() => {
    const isRoot = !matches.find((item) => item.pathname !== "/");
    const inConversation = matches.some((item) => item.params.conversationID);
    if (isRoot || inConversation) {
      navigate("chat", {
        replace: true,
      });
    }
  });

  const loadingTip = isLogining ? t("toast.loading") : `${progress}%`;
  const showLockLoading = isLogining || (reinstall && syncState === "loading");

  return (
    <Spin className="!max-h-none" spinning={showLockLoading} tip={loadingTip}>
      <Layout className="app-background-shell h-full min-h-0">
        <TopSearchBar />
        <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-6 xl:p-8">
          <div className="flex h-full w-full max-w-[1520px] min-h-0 max-h-[calc(100vh-32px)] overflow-hidden rounded-[28px] border border-[#e8edf3] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:max-h-[calc(100vh-48px)] xl:max-h-[calc(100vh-64px)]">
            <Layout className="min-h-0 flex-1 !flex-row overflow-hidden rounded-[inherit] bg-white">
              <LeftNavBar />
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
                <Outlet />
              </div>
            </Layout>
          </div>
        </div>
      </Layout>
    </Spin>
  );
};
