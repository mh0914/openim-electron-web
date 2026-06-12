import {
  GroupMemberRole,
  MessageItem as MessageItemType,
  MessageType,
} from "@openim/wasm-client-sdk";
import clsx from "clsx";
import { t } from "i18next";
import { FC, memo, MouseEvent, useCallback, useRef, useState } from "react";

import OIMAvatar from "@/components/OIMAvatar";
import PlatformOperatorBadge from "@/components/PlatformOperatorBadge";
import { formatMessageTime } from "@/utils/imCommon";
import { emit } from "@/utils/events";
import {
  isSmartCustomerServiceThinkingMessage,
  MARKDOWN_TEXT_MESSAGE_TYPE,
} from "@/utils/smartCustomerService";

import CatchMessageRender from "./CatchMsgRenderer";
import CustomMessageRender from "./CustomMessageRender";
import FileMessageRender from "./FileMessageRender";
import LocationMessageRender from "./LocationMessageRender";
import MediaMessageRender from "./MediaMessageRender";
import styles from "./message-item.module.scss";
import MessageItemErrorBoundary from "./MessageItemErrorBoundary";
import MessageSuffix from "./MessageSuffix";
import TextMessageRender from "./TextMessageRender";
import VideoMessageRender from "./VideoMessageRender";
import VoiceMessageRender from "./VoiceMessageRender";

export interface IMessageItemProps {
  message: MessageItemType;
  isSender: boolean;
  disabled?: boolean;
  conversationID?: string;
  messageUpdateFlag?: string;
  senderRoleLevel?: number;
  displaySenderName?: string;
  displaySenderFaceURL?: string;
  visitorRoleLabel?: string;
  isPlatformOperator?: boolean;
  isSmartCustomerService?: boolean;
}

const components: Record<number, FC<IMessageItemProps>> = {
  [MessageType.TextMessage]: TextMessageRender,
  [MessageType.AtTextMessage]: TextMessageRender,
  [MessageType.PictureMessage]: MediaMessageRender,
  [MessageType.VoiceMessage]: VoiceMessageRender,
  [MessageType.VideoMessage]: VideoMessageRender,
  [MessageType.FileMessage]: FileMessageRender,
  [MessageType.LocationMessage]: LocationMessageRender,
  [MessageType.CustomMessage]: CustomMessageRender,
  [MARKDOWN_TEXT_MESSAGE_TYPE]: TextMessageRender,
};

const MessageItem: FC<IMessageItemProps> = ({
  message,
  disabled,
  isSender,
  conversationID,
  senderRoleLevel,
  displaySenderName,
  displaySenderFaceURL,
  visitorRoleLabel,
  isPlatformOperator,
  isSmartCustomerService,
}) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const MessageRenderComponent = isSmartCustomerServiceThinkingMessage(message)
    ? TextMessageRender
    : components[message.contentType] || CatchMessageRender;

  const closeMessageMenu = useCallback(() => {
    setShowMessageMenu(false);
  }, []);

  const canShowMessageMenu = !disabled;
  const senderDisplayName = displaySenderName || message.senderNickname;
  const mentionName = (senderDisplayName || message.sendID)?.trim();
  const canInsertMention = Boolean(message.groupID && !isSender && message.sendID && mentionName);

  const handleInsertMention = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!canInsertMention || !mentionName) {
        return;
      }

      if (event.button !== 2) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      emit("INSERT_MENTION", {
        userID: message.sendID,
        displayName: mentionName,
      });
    },
    [canInsertMention, mentionName, message.sendID],
  );

  return (
    <>
      <div
        id={`chat_${message.clientMsgID}`}
        className={clsx("relative flex select-text px-5 py-3")}
      >
        <div
          className={clsx(
            styles["message-container"],
            isSender && styles["message-container-sender"],
          )}
        >
          <OIMAvatar
            size={36}
            src={displaySenderFaceURL ?? message.senderFaceUrl}
            text={senderDisplayName}
            bgColor={visitorRoleLabel === "\u533f\u540d\u6e38\u5ba2" ? "#8c8c8c" : undefined}
            style={{ cursor: canInsertMention ? "context-menu" : undefined }}
            onContextMenu={handleInsertMention}
          />

          <div className={styles["message-wrap"]} ref={messageWrapRef}>
            <div className={styles["message-profile"]}>
              <div
                title={senderDisplayName}
                className={clsx(
                  "min-w-0 max-w-[120px] shrink truncate text-[var(--sub-text)]",
                )}
                style={{ cursor: canInsertMention ? "context-menu" : undefined }}
                onContextMenu={handleInsertMention}
              >
                {senderDisplayName}
              </div>
              {visitorRoleLabel && (
                <span
                  className={clsx(
                    "rounded border px-1 text-[10px]",
                    visitorRoleLabel === "\u533f\u540d\u6e38\u5ba2"
                      ? "border-[#8c8c8c] text-[#8c8c8c]"
                      : "border-[#52c41a] text-[#52c41a]",
                  )}
                >
                  {visitorRoleLabel}
                </span>
              )}
              {isSmartCustomerService && (
                <PlatformOperatorBadge
                  variant="customerService"
                  compact
                  className="shrink-0"
                />
              )}
              {isPlatformOperator && (
                <PlatformOperatorBadge
                  variant="official"
                  compact
                  className="shrink-0"
                />
              )}
              {senderRoleLevel === GroupMemberRole.Owner && (
                <span className="rounded border border-[#FF9831] px-1 text-[10px] text-[#FF9831]">
                  {t("placeholder.groupOwner")}
                </span>
              )}
              {senderRoleLevel === GroupMemberRole.Admin && (
                <span className="rounded border border-[#2b7fff] px-1 text-[10px] text-[#2b7fff]">
                  {t("placeholder.administrator")}
                </span>
              )}
              <div className="shrink-0 text-[var(--sub-text)]">
                {formatMessageTime(message.sendTime)}
              </div>
            </div>

            <div className={styles["menu-wrap"]}>
              <MessageItemErrorBoundary message={message}>
                <MessageRenderComponent
                  message={message}
                  isSender={isSender}
                  disabled={disabled}
                />
              </MessageItemErrorBoundary>

              <MessageSuffix
                message={message}
                isSender={isSender}
                disabled={false}
                conversationID={conversationID}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default memo(MessageItem);
