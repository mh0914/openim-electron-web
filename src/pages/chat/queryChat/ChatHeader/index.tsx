import { SessionType } from "@openim/wasm-client-sdk";
import { Layout, Tooltip } from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { memo, useEffect, useRef } from "react";

import group_member from "@/assets/images/chatHeader/group_member.png";
import launch_group from "@/assets/images/chatHeader/launch_group.png";
import settings from "@/assets/images/chatHeader/settings.png";
import PlatformOperatorBadge from "@/components/PlatformOperatorBadge";
import { OverlayVisibleHandle } from "@/hooks/useOverlayVisible";
import { usePlatformOperators } from "@/hooks/usePlatformOperators";
import { useSmartCustomerServices } from "@/hooks/useSmartCustomerServices";
import { useConversationStore, useUserStore } from "@/store";
import { emit } from "@/utils/events";

import GroupSetting from "../GroupSetting";
import {
  isChatroomClosed,
  parseGroupProfileExtra,
} from "../GroupSetting/groupProfileExtra";
import SingleSetting from "../SingleSetting";

const menuList = [
  {
    title: t("placeholder.createGroup"),
    icon: launch_group,
    idx: 0,
  },
  {
    title: t("placeholder.invitation"),
    icon: launch_group,
    idx: 1,
  },
  {
    title: t("placeholder.setting"),
    icon: settings,
    idx: 2,
  },
];

i18n.on("languageChanged", () => {
  menuList[0].title = t("placeholder.createGroup");
  menuList[1].title = t("placeholder.invitation");
  menuList[2].title = t("placeholder.setting");
});

const ChatHeader = () => {
  const singleSettingRef = useRef<OverlayVisibleHandle>(null);
  const groupSettingRef = useRef<OverlayVisibleHandle>(null);

  const currentConversation = useConversationStore(
    (state) => state.currentConversation,
  );
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);
  const currentUserIsInGroup = useConversationStore((state) =>
    Boolean(state.currentMemberInGroup?.userID),
  );
  const inGroup = useConversationStore((state) =>
    Boolean(state.currentMemberInGroup?.groupID),
  );
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const currentConversationOperatorUserSet = usePlatformOperators(
    currentConversation?.conversationType === SessionType.Single
      ? [currentConversation?.userID ?? ""]
      : [],
  );
  const currentConversationSmartServiceUserSet = useSmartCustomerServices(
    currentConversation?.conversationType === SessionType.Single
      ? [currentConversation?.userID ?? ""]
      : [],
  );
  const selfOperatorUserSet = usePlatformOperators(selfUserID ? [selfUserID] : []);
  const canManageContacts =
    Boolean(selfUserID) && selfOperatorUserSet.has(selfUserID);

  // locale re render
  useUserStore((state) => state.appSettings.locale);

  useEffect(() => {
    if (singleSettingRef.current?.isOverlayOpen) {
      singleSettingRef.current?.closeOverlay();
    }
    if (groupSettingRef.current?.isOverlayOpen) {
      groupSettingRef.current?.closeOverlay();
    }
  }, [currentConversation?.conversationID]);

  const menuClick = (idx: number) => {
    switch (idx) {
      case 0:
      case 1:
        emit("OPEN_CHOOSE_MODAL", {
          type: isSingleSession ? "CRATE_GROUP" : "INVITE_TO_GROUP",
          extraData: isSingleSession
            ? [{ ...currentConversation }]
            : currentConversation?.groupID,
        });
        break;
      case 2:
        if (isGroupSession) {
          groupSettingRef.current?.openOverlay();
        } else {
          singleSettingRef.current?.openOverlay();
        }
        break;
      default:
        break;
    }
  };

  const isSingleSession = currentConversation?.conversationType === SessionType.Single;
  const isGroupSession = currentConversation?.conversationType === SessionType.Group;
  const chatroomClosed = isChatroomClosed(parseGroupProfileExtra(currentGroupInfo?.ex));

  return (
    <Layout.Header className="relative !h-[60px] border-b border-b-[var(--gap-text)] !bg-white !px-4">
      <div className="flex h-full items-center leading-none">
        <div className="flex flex-1 items-center overflow-hidden">
          <div
            className={clsx(
              "flex !h-9 flex-1 flex-col justify-center overflow-hidden",
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="truncate text-base font-semibold">
                {currentConversation?.showName}
              </div>
              {isGroupSession && chatroomClosed && (
                <span className="shrink-0 rounded bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#ff4d4f]">
                  {"\u7fa4\u804a\u5173\u95ed"}
                </span>
              )}
              {isSingleSession &&
                currentConversationSmartServiceUserSet.has(
                  currentConversation?.userID ?? "",
                ) && (
                  <PlatformOperatorBadge
                    variant="customerService"
                    compact
                    className="shrink-0"
                  />
                )}
              {isSingleSession &&
                currentConversationOperatorUserSet.has(
                  currentConversation?.userID ?? "",
                ) && (
                  <PlatformOperatorBadge
                    variant="official"
                    compact
                    className="shrink-0"
                  />
                )}
            </div>
            {isGroupSession && currentUserIsInGroup && (
              <div className="mt-1 flex items-center text-xs text-[var(--sub-text)]">
                <img width={20} src={group_member} alt="member" />
                <span>{currentGroupInfo?.memberCount}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mr-5 flex">
          {menuList.map((menu) => {
            if ((menu.idx === 0 || menu.idx === 1) && !canManageContacts) {
              return null;
            }
            if (menu.idx === 1 && (isSingleSession || (!inGroup && !isSingleSession))) {
              return null;
            }
            if (menu.idx === 0 && !isSingleSession) {
              return null;
            }

            return (
              <Tooltip title={menu.title} key={menu.idx}>
                <img
                  className="ml-5 cursor-pointer"
                  width={20}
                  src={menu.icon}
                  alt=""
                  onClick={() => menuClick(menu.idx)}
                />
              </Tooltip>
            );
          })}
        </div>
      </div>
      <SingleSetting ref={singleSettingRef} />
      <GroupSetting ref={groupSettingRef} />
    </Layout.Header>
  );
};

export default memo(ChatHeader);
