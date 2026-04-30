import { SessionType } from "@openim/wasm-client-sdk";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";
import { Empty } from "antd";

import { usePlatformOperators } from "@/hooks/usePlatformOperators";
import ConversationItem from "@/pages/chat/ConversationSider/ConversationItem";
import { useConversationStore } from "@/store";
import { conversationSort, isGroupSession } from "@/utils/imCommon";

export const GroupNotifications = () => {
  const { t } = useTranslation();
  const conversationList = useConversationStore((state) => state.conversationList);
  const getConversationListByReq = useConversationStore(
    (state) => state.getConversationListByReq,
  );

  useEffect(() => {
    if (conversationList.length === 0) {
      void getConversationListByReq();
    }
  }, [conversationList.length, getConversationListByReq]);

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

  const notificationConversationList = useMemo(
    () =>
      conversationSort([...conversationList]).filter(
        (conversation) =>
          (isGroupSession(conversation.conversationType) ||
            (conversation.conversationType === SessionType.Single &&
              platformOperatorUserIDSet.has(conversation.userID))) &&
          Boolean(conversation.latestMsg || conversation.draftText),
      ),
    [conversationList, platformOperatorUserIDSet],
  );

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <p className="m-5.5 text-base font-extrabold">
        {t("placeholder.groupNotification")}
      </p>
      <div className="flex-1 pb-3">
        {notificationConversationList.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <Virtuoso
            className="h-full overflow-x-hidden"
            data={notificationConversationList}
            itemContent={(_, item) => (
              <ConversationItem
                key={item.conversationID}
                conversation={item}
                isActive={false}
                isPlatformOperator={
                  item.conversationType === SessionType.Single &&
                  platformOperatorUserIDSet.has(item.userID)
                }
              />
            )}
          />
        )}
      </div>
    </div>
  );
};
