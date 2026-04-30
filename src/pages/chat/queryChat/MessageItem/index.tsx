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

import CatchMessageRender from "./CatchMsgRenderer";
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
};

const MessageItem: FC<IMessageItemProps> = ({
  message,
  disabled,
  isSender,
  conversationID,
  senderRoleLevel,
  displaySenderName,
  isPlatformOperator,
  isSmartCustomerService,
}) => {
  const messageWrapRef = useRef<HTMLDivElement>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const MessageRenderComponent = components[message.contentType] || CatchMessageRender;

  const closeMessageMenu = useCallback(() => {
    setShowMessageMenu(false);
  }, []);

  const canShowMessageMenu = !disabled;
  const mentionName = (displaySenderName || message.senderNickname || message.sendID)?.trim();
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
            src={message.senderFaceUrl}
            text={message.senderNickname}
            style={{ cursor: canInsertMention ? "context-menu" : undefined }}
            onContextMenu={handleInsertMention}
          />

          <div className={styles["message-wrap"]} ref={messageWrapRef}>
            <div className={styles["message-profile"]}>
              <div
                title={message.senderNickname}
                className={clsx(
                  "min-w-0 max-w-[120px] shrink truncate text-[var(--sub-text)]",
                )}
                style={{ cursor: canInsertMention ? "context-menu" : undefined }}
                onContextMenu={handleInsertMention}
              >
                {displaySenderName || message.senderNickname}
              </div>
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
