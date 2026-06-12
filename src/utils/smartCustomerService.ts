import { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { SessionType } from "@openim/wasm-client-sdk";

const SMART_CUSTOMER_SERVICE_THINKING_TYPE = "smart_customer_service_thinking";

export const MARKDOWN_TEXT_MESSAGE_TYPE = 118;

const parseTextPayload = (payload?: string) => {
  if (!payload) return "";
  try {
    const content = JSON.parse(payload);
    if (typeof content?.content === "string") return content.content;
    if (typeof content?.Content === "string") return content.Content;
    if (typeof content?.text === "string") return content.text;
    if (typeof content?.Text === "string") return content.Text;
    return "";
  } catch {
    return payload;
  }
};

export const parseMessageContentText = (message?: MessageItem) => {
  if (!message) return "";
  if (message.textElem?.content) return message.textElem.content;
  if (message.atTextElem?.text) return message.atTextElem.text;
  if (message.advancedTextElem?.text) return message.advancedTextElem.text;
  if (message.customElem?.data) return parseTextPayload(message.customElem.data);
  if (message.customElem?.description) return message.customElem.description;
  if (message.notificationElem?.detail) return parseTextPayload(message.notificationElem.detail);
  return parseTextPayload(message.content);
};

export const isSmartCustomerServiceThinkingMessage = (message?: MessageItem) => {
  if (!message?.ex) return false;
  try {
    const ex = JSON.parse(message.ex);
    return ex?.hubMessageType === SMART_CUSTOMER_SERVICE_THINKING_TYPE;
  } catch {
    return false;
  }
};

export const getMessageConversationID = (message: MessageItem) => {
  if (message.sessionType === SessionType.Single) {
    const ids = [message.sendID, message.recvID].sort();
    return `si_${ids[0]}_${ids[1]}`;
  }
  if (message.sessionType === SessionType.Group) {
    return `sg_${message.groupID}`;
  }
  if (message.sessionType === SessionType.Notification) {
    return `sn_${message.sendID}_${message.recvID}`;
  }
  return "";
};

export const pruneSettledSmartThinkingMessages = (messages: MessageItem[]) =>
  messages.filter((message, index) => {
    if (!isSmartCustomerServiceThinkingMessage(message)) return true;
    const conversationID = getMessageConversationID(message);
    return !messages.slice(index + 1).some((nextMessage) => {
      if (isSmartCustomerServiceThinkingMessage(nextMessage)) return false;
      return (
        nextMessage.sendID === message.sendID &&
        getMessageConversationID(nextMessage) === conversationID
      );
    });
  });
