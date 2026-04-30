import { Badge } from "antd";
import { SessionType } from "@openim/wasm-client-sdk";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import group_notifications from "@/assets/images/contact/group_notifications.png";
import my_friends from "@/assets/images/contact/my_friends.png";
import my_groups from "@/assets/images/contact/my_groups.png";
import new_friends from "@/assets/images/contact/new_friends.png";
import FlexibleSider from "@/components/FlexibleSider";
import { usePlatformOperators } from "@/hooks/usePlatformOperators";
import { useContactStore, useConversationStore } from "@/store";
import { isGroupSession } from "@/utils/imCommon";

const Links = [
  {
    label: t("placeholder.newFriends"),
    icon: new_friends,
    path: "/contact/newFriends",
  },
  {
    label: t("placeholder.groupNotification"),
    icon: group_notifications,
    path: "/contact/groupNotifications",
  },
  {
    label: t("placeholder.myFriend"),
    icon: my_friends,
    path: "/contact",
  },
  {
    label: t("placeholder.myGroup"),
    icon: my_groups,
    path: "/contact/myGroups",
  },
];

i18n.on("languageChanged", () => {
  Links[0].label = t("placeholder.newFriends");
  Links[1].label = t("placeholder.groupNotification");
  Links[2].label = t("placeholder.myFriend");
  Links[3].label = t("placeholder.myGroup");
});

const ContactSider = () => {
  const [selectIndex, setSelectIndex] = useState(2);
  const unHandleFriendApplicationCount = useContactStore(
    (state) => state.unHandleFriendApplicationCount,
  );
  const conversationList = useConversationStore((state) => state.conversationList);
  const singleConversationUserIDs = useMemo(
    () =>
      conversationList
        .filter(
          (conversation) =>
            conversation.conversationType === SessionType.Single &&
            Boolean(conversation.userID),
        )
        .map((conversation) => conversation.userID),
    [conversationList],
  );
  const platformOperatorUserIDSet = usePlatformOperators(singleConversationUserIDs);
  const notificationUnreadCount = useMemo(
    () =>
      conversationList
        .filter(
          (conversation) =>
            isGroupSession(conversation.conversationType) ||
            (conversation.conversationType === SessionType.Single &&
              platformOperatorUserIDSet.has(conversation.userID)),
        )
        .reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversationList, platformOperatorUserIDSet],
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash.includes("/contact/newFriends")) {
      setSelectIndex(0);
    }
    if (location.hash.includes("/contact/groupNotifications")) {
      setSelectIndex(1);
    }
    if (location.hash.includes("/contact/myGroups")) {
      setSelectIndex(3);
    }
  }, []);

  const getBadge = (index: number) => {
    if (index === 0) {
      return unHandleFriendApplicationCount;
    }
    if (index === 1) {
      return notificationUnreadCount;
    }
    return 0;
  };

  return (
    <FlexibleSider needHidden={true}>
      <div className="h-full bg-white">
        <div className="pb-3 pl-5.5 pt-5.5 text-base font-extrabold">
          {t("placeholder.contact")}
        </div>
        <ul>
          {Links.map((item, index) => {
            return (
              <li
                key={item.path}
                className={clsx(
                  "mx-2 flex cursor-pointer items-center rounded-md p-3 text-sm hover:bg-[var(--primary-active)]",
                  {
                    "bg-[#f3f8fe]": index === selectIndex,
                  },
                )}
                onClick={() => {
                  setSelectIndex(index);
                  navigate(String(item.path));
                }}
              >
                <Badge size="small" count={getBadge(index)}>
                  <img
                    alt={item.label}
                    src={item.icon}
                    className="mr-3 h-10.5 w-10.5 rounded-md"
                  />
                </Badge>
                <div className="text-sm">{item.label}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </FlexibleSider>
  );
};
export default ContactSider;
