import { SessionType } from "@openim/wasm-client-sdk";
import { Layout, Spin } from "antd";
import clsx from "clsx";
import { memo, useEffect, useMemo, useRef } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import { SystemMessageTypes } from "@/constants/im";
import { usePlatformOperators } from "@/hooks/usePlatformOperators";
import { useSmartCustomerServices } from "@/hooks/useSmartCustomerServices";
import { useConversationStore } from "@/store";
import { useUserStore } from "@/store";
import emitter from "@/utils/events";

import MessageItem from "./MessageItem";
import NotificationMessage from "./NotificationMessage";
import {
  getChatroomVisitorAvatar,
  getChatroomVisitorDisplayName,
  getChatroomVisitorIdentity,
  getChatroomVisitorLabel,
  parseGroupProfileExtra,
} from "./GroupSetting/groupProfileExtra";
import { useChatroomSelfNickname } from "./useChatroomSelfNickname";
import { useHistoryMessageList } from "./useHistoryMessageList";

const ChatContent = () => {
  const virtuoso = useRef<VirtuosoHandle>(null);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);
  const currentGroupMemberList = useConversationStore((state) => state.currentGroupMemberList);
  const { selfNickname } = useChatroomSelfNickname(currentConversation?.groupID);
  const profileExtra = useMemo(
    () => parseGroupProfileExtra(currentGroupInfo?.ex),
    [currentGroupInfo?.ex],
  );

  const scrollToBottom = () => {
    setTimeout(() => {
      virtuoso.current?.scrollToIndex({
        index: 9999,
        align: "end",
        behavior: "auto",
      });
    });
  };

  const { SPLIT_COUNT, conversationID, loadState, moreOldLoading, getMoreOldMessages } =
    useHistoryMessageList();

  const memberRoleMap = useMemo(
    () =>
      new Map(
        currentGroupMemberList.map((member) => [member.userID, member.roleLevel] as const),
      ),
    [currentGroupMemberList],
  );
  const memberExMap = useMemo(
    () =>
      new Map(currentGroupMemberList.map((member) => [member.userID, member.ex] as const)),
    [currentGroupMemberList],
  );
  const operatorUserSet = usePlatformOperators(
    loadState.messageList.map((message) => message.sendID),
  );
  const smartCustomerServiceUserSet = useSmartCustomerServices(
    loadState.messageList.map((message) => message.sendID),
  );

  useEffect(() => {
    emitter.on("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    return () => {
      emitter.off("CHAT_LIST_SCROLL_TO_BOTTOM", scrollToBottom);
    };
  }, []);

  const loadMoreMessage = () => {
    if (!loadState.hasMoreOld || moreOldLoading) return;

    getMoreOldMessages();
  };

  return (
    <Layout.Content
      className="relative flex h-full overflow-hidden !bg-white"
      id="chat-main"
    >
      {loadState.initLoading ? (
        <div className="flex h-full w-full items-center justify-center bg-white pt-1">
          <Spin spinning />
        </div>
      ) : (
        <Virtuoso
          id="chat-list"
          className="w-full overflow-x-hidden"
          followOutput="smooth"
          firstItemIndex={loadState.firstItemIndex}
          initialTopMostItemIndex={SPLIT_COUNT - 1}
          startReached={loadMoreMessage}
          ref={virtuoso}
          data={loadState.messageList}
          components={{
            Header: () =>
              loadState.hasMoreOld ? (
                <div
                  className={clsx(
                    "flex justify-center py-2 opacity-0",
                    moreOldLoading && "opacity-100",
                  )}
                >
                  <Spin />
                </div>
              ) : null,
          }}
          computeItemKey={(_, item) => item.clientMsgID}
          itemContent={(_, message) => {
            if (SystemMessageTypes.includes(message.contentType)) {
              return (
                <NotificationMessage key={message.clientMsgID} message={message} />
              );
            }
            const isSender = selfUserID === message.sendID;
            const visitorIdentity = getChatroomVisitorIdentity(
              profileExtra,
              message.sendID,
              memberExMap.get(message.sendID),
            );
            const senderName = getChatroomVisitorDisplayName(
              visitorIdentity,
              isSender && selfNickname ? selfNickname : undefined,
            );
            return (
              <MessageItem
                key={message.clientMsgID}
                conversationID={conversationID}
                message={message}
                messageUpdateFlag={message.senderNickname + message.senderFaceUrl}
                isSender={isSender}
                senderRoleLevel={memberRoleMap.get(message.sendID)}
                displaySenderName={senderName}
                displaySenderFaceURL={getChatroomVisitorAvatar(
                  visitorIdentity,
                  message.senderFaceUrl,
                )}
                visitorRoleLabel={getChatroomVisitorLabel(visitorIdentity?.role)}
                isPlatformOperator={operatorUserSet.has(message.sendID)}
                isSmartCustomerService={smartCustomerServiceUserSet.has(message.sendID)}
              />
            );
          }}
        />
      )}
    </Layout.Content>
  );
};

export default memo(ChatContent);
