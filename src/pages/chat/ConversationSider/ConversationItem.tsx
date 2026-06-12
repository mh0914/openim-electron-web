import type {
  ConversationItem,
  ConversationItem as ConversationItemType,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { GroupAtType } from "@openim/wasm-client-sdk";
import { Badge, Dropdown } from "antd";
import type { MenuProps } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { modal } from "@/AntdGlobalComp";
import OIMAvatar from "@/components/OIMAvatar";
import PlatformOperatorBadge from "@/components/PlatformOperatorBadge";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/common";
import {
  conversationSort,
  formatConversionTime,
  getConversationAtLabel,
  getConversationContent,
} from "@/utils/imCommon";
import {
  isChatroomClosed,
  parseGroupProfileExtra,
} from "../queryChat/GroupSetting/groupProfileExtra";

import styles from "./conversation-item.module.scss";

interface IConversationProps {
  allowDelete?: boolean;
  isActive: boolean;
  conversation: ConversationItemType;
  isPlatformOperator?: boolean;
  isSmartCustomerService?: boolean;
}

const ConversationItem = ({
  allowDelete,
  isActive,
  conversation,
  isPlatformOperator = false,
  isSmartCustomerService = false,
}: IConversationProps) => {
  const navigate = useNavigate();
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const updateConversationList = useConversationStore((state) => state.updateConversationList);
  const removeConversation = useConversationStore((state) => state.removeConversation);
  const getUnReadCountByReq = useConversationStore((state) => state.getUnReadCountByReq);
  const conversationList = useConversationStore((state) => state.conversationList);
  const groupList = useContactStore((state) => state.groupList);
  const currentUser = useUserStore((state) => state.selfInfo.userID);
  const deleteLabel = "删除";
  const deleteConversationConfirmText = "确认删除该会话及本地聊天记录吗？";

  const toSpecifiedConversation = async () => {
    if (isActive) {
      return;
    }
    await updateCurrentConversation({ ...conversation });
    if (conversation.groupAtType !== GroupAtType.AtNormal) {
      void IMSDK.resetConversationGroupAtType(conversation.conversationID);
      const nextList = conversationSort(
        conversationList.map((item) =>
          item.conversationID === conversation.conversationID
            ? { ...item, groupAtType: GroupAtType.AtNormal }
            : item,
        ),
        conversationList,
      );
      updateConversationList(nextList, "push");
    }
    navigate(`/chat/${conversation.conversationID}`);
  };

  const latestMessageContent = useMemo(() => {
    let content = "";
    if (!conversation.latestMsg) {
      return "";
    }
    try {
      content = getConversationContent(
        JSON.parse(conversation.latestMsg) as MessageItem,
      );
    } catch (error) {
      content = t("messageDescription.catchMessage");
    }
    return content;
  }, [conversation.draftText, conversation.latestMsg, isActive, currentUser]);

  const latestMessageTime = formatConversionTime(conversation.latestMsgSendTime);
  const atLabel = getConversationAtLabel(conversation.groupAtType);
  const currentGroup = useMemo(
    () =>
      conversation.groupID
        ? groupList.find((group) => group.groupID === conversation.groupID)
        : undefined,
    [conversation.groupID, groupList],
  );
  const chatroomClosed = isChatroomClosed(parseGroupProfileExtra(currentGroup?.ex));
  const shouldShowOfficialBadge = isPlatformOperator;
  const shouldShowSmartCustomerServiceBadge = isSmartCustomerService;
  const contextMenuItems: MenuProps["items"] = [
    {
      key: "delete",
      danger: true,
      label: deleteLabel,
    },
  ];

  const tryDeleteConversation = () => {
    modal.confirm({
      title: deleteLabel,
      content: deleteConversationConfirmText,
      okText: t("confirm"),
      cancelText: t("cancel"),
      okButtonProps: {
        danger: true,
      },
      onOk: async () => {
        try {
          await IMSDK.deleteConversationAndDeleteAllMsg(conversation.conversationID);
          if (isActive) {
            await updateCurrentConversation(undefined);
            navigate("/chat");
          }
          removeConversation(conversation.conversationID);
          void getUnReadCountByReq();
        } catch (error) {
          feedbackToast({ error, msg: t("toast.deleteConversationFailed") });
        }
      },
    });
  };

  const onContextMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    domEvent.stopPropagation();
    if (key === "delete") {
      tryDeleteConversation();
    }
  };

  const itemNode = (
    <div
      data-platform-operator={shouldShowOfficialBadge ? "true" : "false"}
      data-smart-customer-service={shouldShowSmartCustomerServiceBadge ? "true" : "false"}
      className={clsx(
        styles["conversation-item"],
        "border border-transparent",
        isActive && `bg-[var(--primary-active)]`,
      )}
      onClick={toSpecifiedConversation}
    >
      <Badge size="small" count={conversation.unreadCount}>
        <OIMAvatar
          src={conversation.faceURL}
          isgroup={Boolean(conversation.groupID)}
          text={conversation.showName}
          disabled={chatroomClosed}
        />
      </Badge>

      <div className="ml-3 flex h-11 flex-1 flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="min-w-0 truncate font-medium">{conversation.showName}</div>
            {chatroomClosed && (
              <span className="shrink-0 rounded bg-[#fff1f0] px-1.5 py-0.5 text-[10px] leading-none text-[#ff4d4f]">
                {"\u7fa4\u804a\u5173\u95ed"}
              </span>
            )}
            {shouldShowSmartCustomerServiceBadge && (
              <PlatformOperatorBadge
                variant="customerService"
                compact
                className="shrink-0"
              />
            )}
            {shouldShowOfficialBadge && (
              <PlatformOperatorBadge variant="official" compact className="shrink-0" />
            )}
          </div>
          <div className="ml-2 text-xs text-[var(--sub-text)]">{latestMessageTime}</div>
        </div>

        <div className="flex items-center">
          <div className="flex min-h-[16px] flex-1 items-center overflow-hidden text-xs">
            {atLabel && (
              <span className="mr-1 shrink-0 rounded bg-[#fff2e8] px-1 py-0.5 text-[10px] text-[#fa541c]">
                {atLabel}
              </span>
            )}
            <div
              className="truncate text-[rgba(81,94,112,0.5)]"
              dangerouslySetInnerHTML={{
                __html: latestMessageContent,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!allowDelete) {
    return itemNode;
  }

  return (
    <Dropdown
      menu={{
        items: contextMenuItems,
        onClick: onContextMenuClick,
      }}
      trigger={["contextMenu"]}
    >
      {itemNode}
    </Dropdown>
  );
};

export default ConversationItem;
