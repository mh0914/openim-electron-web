import dayjs from "dayjs";
import { v4 as uuidV4 } from "uuid";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import updateLocale from "dayjs/plugin/updateLocale";
import { t } from "i18next";
import default_group from "@/assets/images/contact/my_groups.png";
import { v4 as uuidv4 } from "uuid";

import {
  GroupSessionTypes,
  SidebarSuppressedGroupEventTypes,
  SystemMessageTypes,
} from "@/constants/im";
import { useConversationStore, useUserStore } from "@/store";
import { useContactStore } from "@/store/contact";

import { generateAvatar, secondsToTime } from "./common";
import {
  AtTextElem,
  ConversationItem,
  MessageItem,
  PublicUserItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { GroupAtType, MessageType, SessionType } from "@openim/wasm-client-sdk";
import { isThisYear } from "date-fns";
import { FileWithPath } from "@/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage";
import { IMSDK } from "@/layout/MainContentWrap";
import { UploadFileParams } from "@openim/wasm-client-sdk/lib/types/params";
dayjs.extend(calendar);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.updateLocale("en", {
  calendar: {
    sameDay: "HH:mm",
    nextDay: "[tomorrow]",
    nextWeek: "dddd",
    lastDay: "[yesterday] HH:mm",
    lastWeek: "dddd HH:mm",
    sameElse: "YYYY/M/D HH:mm",
  },
});
dayjs.updateLocale("zh-cn", {
  calendar: {
    sameDay: "HH:mm",
    nextDay: "[明天]",
    nextWeek: "dddd",
    lastDay: "[昨天] HH:mm",
    lastWeek: "dddd HH:mm",
    sameElse: "YYYY年M月D日 HH:mm",
  },
});

const linkWrap = ({
  userID,
  groupID,
  name,
  fromAt,
}: {
  userID: string;
  groupID: string;
  name: string;
  fromAt?: boolean;
}) => {
  return `<span class='link-el${fromAt ? "" : " member-el"
    } max-w-[200px] truncate inline-block align-bottom' onclick='userClick("${userID}","${groupID ?? ""
    }")'>${name}</span>`;
};

export const notificationMessageFormat = (msg: MessageItem) => {
  const selfID = useUserStore.getState().selfInfo.userID;
  const getName = (user: PublicUserItem) => {
    return user.userID === selfID ? t("you") : user.nickname;
  };
  try {
    switch (msg.contentType) {
      case MessageType.FriendAdded:
        return t("messageDescription.alreadyFriendMessage");
      case MessageType.GroupCreated:
        const groupCreatedDetail = JSON.parse(msg.notificationElem!.detail);
        const groupCreatedUser = groupCreatedDetail.opUser;
        return t("messageDescription.createGroupMessage", {
          creator: linkWrap({
            userID: groupCreatedUser.userID,
            groupID: msg.groupID,
            name: getName(groupCreatedUser),
          }),
        });
      case MessageType.GroupInfoUpdated:
        const groupUpdateDetail = JSON.parse(msg.notificationElem!.detail);
        const groupUpdateUser = groupUpdateDetail.opUser;
        return t("messageDescription.updateGroupInfoMessage", {
          operator: linkWrap({
            userID: groupUpdateUser.userID,
            groupID: msg.groupID,
            name: getName(groupUpdateUser),
          }),
        });
      case MessageType.GroupOwnerTransferred:
        const transferDetails = JSON.parse(msg.notificationElem!.detail);
        const transferOpUser = transferDetails.opUser;
        const newOwner = transferDetails.newGroupOwner;
        return t("messageDescription.transferGroupMessage", {
          owner: linkWrap({
            userID: transferOpUser.userID,
            groupID: msg.groupID,
            name: getName(transferOpUser),
          }),
          newOwner: linkWrap({
            userID: newOwner.userID,
            groupID: msg.groupID,
            name: getName(newOwner),
          }),
        });
      case MessageType.MemberQuit:
        const quitDetails = JSON.parse(msg.notificationElem!.detail);
        const quitUser = quitDetails.quitUser;
        return t("messageDescription.quitGroupMessage", {
          name: linkWrap({
            userID: quitUser.userID,
            groupID: msg.groupID,
            name: getName(quitUser),
          }),
        });
      case MessageType.MemberInvited:
        const inviteDetails = JSON.parse(msg.notificationElem!.detail);
        const inviteOpUser = inviteDetails.opUser;
        const invitedUserList = inviteDetails.invitedUserList ?? [];
        let inviteStr = "";
        invitedUserList.slice(0, 3).map(
          (user: any) =>
          (inviteStr += `${linkWrap({
            userID: user.userID,
            groupID: msg.groupID,
            name: getName(user),
          })}、`),
        );
        inviteStr = inviteStr.slice(0, -1);
        return t("messageDescription.invitedToGroupMessage", {
          operator: linkWrap({
            userID: inviteOpUser.userID,
            groupID: msg.groupID,
            name: getName(inviteOpUser),
          }),
          invitedUser: `${inviteStr}${invitedUserList.length > 3
            ? `${t("placeholder.and")}${t("placeholder.somePerson", {
              num: invitedUserList.length,
            })}`
            : ""
            }`,
        });
      case MessageType.MemberKicked:
        const kickDetails = JSON.parse(msg.notificationElem!.detail);
        const kickOpUser = kickDetails.opUser;
        const kickdUserList = kickDetails.kickedUserList ?? [];
        let kickStr = "";
        kickdUserList.slice(0, 3).map(
          (user: any) =>
          (kickStr += `${linkWrap({
            userID: user.userID,
            groupID: msg.groupID,
            name: getName(user),
          })}、`),
        );
        kickStr = kickStr.slice(0, -1);
        return t("messageDescription.kickInGroupMessage", {
          operator: linkWrap({
            userID: kickOpUser.userID,
            groupID: msg.groupID,
            name: getName(kickOpUser),
          }),
          kickedUser: `${kickStr}${kickdUserList.length > 3 ? "..." : ""}`,
        });
      case MessageType.MemberEnter:
        const enterDetails = JSON.parse(msg.notificationElem!.detail);
        const enterUser = enterDetails.entrantUser;
        return t("messageDescription.joinGroupMessage", {
          name: linkWrap({
            userID: enterUser.userID,
            groupID: msg.groupID,
            name: getName(enterUser),
          }),
        });
      case MessageType.GroupDismissed:
        const dismissDetails = JSON.parse(msg.notificationElem!.detail);
        const dismissUser = dismissDetails.opUser;
        return t("messageDescription.disbanedGroupMessage", {
          operator: linkWrap({
            userID: dismissUser.userID,
            groupID: msg.groupID,
            name: getName(dismissUser),
          }),
        });
      case MessageType.GroupMemberMuted:
        const memberMutedDetails = JSON.parse(msg.notificationElem!.detail);
        return t("messageDescription.singleMuteMessage", {
          name: linkWrap({
            userID: memberMutedDetails.mutedUser.userID,
            groupID: msg.groupID,
            name: getName(memberMutedDetails.mutedUser),
          }),
          operator: linkWrap({
            userID: memberMutedDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(memberMutedDetails.opUser),
          }),
          muteTime: secondsToTime(memberMutedDetails.mutedSeconds ?? 0),
        });
      case MessageType.GroupMemberCancelMuted:
        const memberCancelMutedDetails = JSON.parse(msg.notificationElem!.detail);
        return t("messageDescription.cancelSingleMuteMessage", {
          name: linkWrap({
            userID: memberCancelMutedDetails.mutedUser.userID,
            groupID: msg.groupID,
            name: getName(memberCancelMutedDetails.mutedUser),
          }),
          operator: linkWrap({
            userID: memberCancelMutedDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(memberCancelMutedDetails.opUser),
          }),
        });
      case MessageType.GroupMuted:
        const groupMutedDetails = JSON.parse(msg.notificationElem!.detail);
        return t("messageDescription.allMuteMessage", {
          operator: linkWrap({
            userID: groupMutedDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(groupMutedDetails.opUser),
          }),
        });
      case MessageType.GroupCancelMuted:
        const groupCancelMutedDetails = JSON.parse(msg.notificationElem!.detail);
        return t("messageDescription.cancelAllMuteMessage", {
          operator: linkWrap({
            userID: groupCancelMutedDetails.opUser.userID,
            groupID: msg.groupID,
            name: getName(groupCancelMutedDetails.opUser),
          }),
        });
      default:
        return "";
    }
  } catch (error) {
    return "";
  }
};

export const formatConversionTime = (timestemp: number): string => {
  if (!timestemp) return "";

  const fromNowStr = dayjs(timestemp).fromNow();

  if (fromNowStr.includes(t("date.second"))) {
    return t("date.justNow");
  }

  if (
    !fromNowStr.includes(t("date.second")) &&
    !fromNowStr.includes(t("date.minute"))
  ) {
    return dayjs(timestemp).calendar();
  }

  return fromNowStr;
};

export const formatMessageTime = (timestemp: number, keepSameYear = false): string => {
  if (!timestemp) return "";

  const isRecent = dayjs().diff(timestemp, "day") < 7;
  const keepYear = keepSameYear || !isThisYear(timestemp);

  if (!isRecent && !keepYear) {
    return dayjs(timestemp).format("M/D HH:mm");
  }

  return dayjs(timestemp).calendar();
};

export const parseBr = (text: string) => {
  return text
    .replace(new RegExp("\\n", "g"), "<br>")
    .replace(new RegExp("\n", "g"), "<br>");
};

export const formatMessageByType = (message?: MessageItem): string => {
  if (!message) return "";
  const selfUserID = useUserStore.getState().selfInfo.userID;
  const isSelf = (id: string) => id === selfUserID;
  const getName = (user: PublicUserItem) => {
    return user.userID === selfUserID ? t("you") : user.nickname;
  };
  try {
    switch (message.contentType) {
      case MessageType.TextMessage:
        return message.textElem!.content;
      case MessageType.AtTextMessage:
        return message.atTextElem?.text ?? "";
      case MessageType.PictureMessage:
        return t("messageDescription.imageMessage");
      case MessageType.VoiceMessage:
        return t("messageDescription.voiceMessage");
      case MessageType.VideoMessage:
        return t("messageDescription.videoMessage");
      case MessageType.FileMessage:
        return t("messageDescription.fileMessage", {
          file: message.fileElem?.fileName ?? "",
        });
      case MessageType.LocationMessage:
        return t("messageDescription.locationMessage", {
          location: message.locationElem?.description ?? "",
        });
      case MessageType.CustomMessage:
        return (
          message.customElem?.description ||
          t("messageDescription.customMessage")
        );
      case MessageType.FriendAdded:
        return t("messageDescription.alreadyFriendMessage");
      case MessageType.MemberEnter:
        const enterDetails = JSON.parse(message.notificationElem!.detail);
        const enterUser = enterDetails.entrantUser;
        return t("messageDescription.joinGroupMessage", {
          name: getName(enterUser),
        });
      case MessageType.GroupCreated:
        const groupCreatedDetail = JSON.parse(message.notificationElem!.detail);
        const groupCreatedUser = groupCreatedDetail.opUser;
        return t("messageDescription.createGroupMessage", {
          creator: getName(groupCreatedUser),
        });
      case MessageType.MemberInvited:
        const inviteDetails = JSON.parse(message.notificationElem!.detail);
        const inviteOpUser = inviteDetails.opUser;
        const invitedUserList = inviteDetails.invitedUserList ?? [];
        let inviteStr = "";
        invitedUserList
          .slice(0, 3)
          .map((user: any) => (inviteStr += `${getName(user)}、`));
        inviteStr = inviteStr.slice(0, -1);
        return t("messageDescription.invitedToGroupMessage", {
          operator: getName(inviteOpUser),
          invitedUser: `${inviteStr}${invitedUserList.length > 3
            ? `${t("placeholder.and")}${t("placeholder.somePerson", {
              num: invitedUserList.length,
            })}`
            : ""
            }`,
        });
      case MessageType.MemberKicked:
        const kickDetails = JSON.parse(message.notificationElem!.detail);
        const kickOpUser = kickDetails.opUser;
        const kickdUserList = kickDetails.kickedUserList ?? [];
        let kickStr = "";
        kickdUserList.slice(0, 3).map((user: any) => (kickStr += `${getName(user)}、`));
        kickStr = kickStr.slice(0, -1);
        return t("messageDescription.kickInGroupMessage", {
          operator: getName(kickOpUser),
          kickedUser: `${kickStr}${kickdUserList.length > 3
            ? `${t("placeholder.and")}${t("placeholder.somePerson", {
              num: kickdUserList.length,
            })}`
            : ""
            }`,
        });
      case MessageType.MemberQuit:
        const quitDetails = JSON.parse(message.notificationElem!.detail);
        const quitUser = quitDetails.quitUser;
        return t("messageDescription.quitGroupMessage", {
          name: getName(quitUser),
        });
      case MessageType.GroupInfoUpdated:
        const groupUpdateDetail = JSON.parse(message.notificationElem!.detail);
        const groupUpdateUser = groupUpdateDetail.opUser;
        return t("messageDescription.updateGroupInfoMessage", {
          operator: getName(groupUpdateUser),
        });
      case MessageType.GroupOwnerTransferred:
        const transferDetails = JSON.parse(message.notificationElem!.detail);
        const transferOpUser = transferDetails.opUser;
        const newOwner = transferDetails.newGroupOwner;
        return t("messageDescription.transferGroupMessage", {
          owner: getName(transferOpUser),
          newOwner: getName(newOwner),
        });
      case MessageType.GroupDismissed:
        const dismissDetails = JSON.parse(message.notificationElem!.detail);
        const dismissUser = dismissDetails.opUser;
        return t("messageDescription.disbanedGroupMessage", {
          operator: getName(dismissUser),
        });
      case MessageType.GroupMemberMuted:
        const memberMutedDetails = JSON.parse(message.notificationElem!.detail);
        return t("messageDescription.singleMuteMessage", {
          name: getName(memberMutedDetails.mutedUser),
          operator: getName(memberMutedDetails.opUser),
          muteTime: secondsToTime(memberMutedDetails.mutedSeconds ?? 0),
        });
      case MessageType.GroupMemberCancelMuted:
        const memberCancelMutedDetails = JSON.parse(message.notificationElem!.detail);
        return t("messageDescription.cancelSingleMuteMessage", {
          name: getName(memberCancelMutedDetails.mutedUser),
          operator: getName(memberCancelMutedDetails.opUser),
        });
      case MessageType.GroupMuted:
        const groupMutedDetails = JSON.parse(message.notificationElem!.detail);
        return t("messageDescription.allMuteMessage", {
          operator: getName(groupMutedDetails.opUser),
        });
      case MessageType.GroupCancelMuted:
        const groupCancelMutedDetails = JSON.parse(message.notificationElem!.detail);
        return t("messageDescription.cancelAllMuteMessage", {
          operator: getName(groupCancelMutedDetails.opUser),
        });
      default:
        return "";
    }
  } catch (error) {
    return "";
  }
};

export const getConversationAtLabel = (groupAtType?: GroupAtType) => {
  switch (groupAtType) {
    case GroupAtType.AtMe:
      return `@${t("me") === "I" ? "Me" : t("me")}`;
    case GroupAtType.AtAll:
      return `@${t("placeholder.mentionAll") === "Everyone" ? "Everyone" : "\u5168\u4f53\u6210\u5458"}`;
    case GroupAtType.AtAllAtMe:
      return `@${t("placeholder.mentionAll") === "Everyone" ? "Everyone" : "\u5168\u4f53\u6210\u5458"}/@${t("me") === "I" ? "Me" : t("me")}`;
    case GroupAtType.AtGroupNotice:
      return `@${t("placeholder.groupNotification")}`;
    default:
      return "";
  }
};

export const initStore = () => {
  calcApplicationBadge();
  const { getSelfInfoByReq } = useUserStore.getState();
  const {
    getBlackListByReq,
    getRecvFriendApplicationListByReq,
    getRecvGroupApplicationListByReq,
    getSendFriendApplicationListByReq,
    getSendGroupApplicationListByReq,
  } = useContactStore.getState();
  const { getConversationListByReq, getUnReadCountByReq } =
    useConversationStore.getState();

  getUnReadCountByReq();
  getConversationListByReq();
  getSelfInfoByReq();
  getBlackListByReq();
  getRecvFriendApplicationListByReq();
  getRecvGroupApplicationListByReq();
  getSendFriendApplicationListByReq();
  getSendGroupApplicationListByReq();
  getUnReadCountByReq();
};

export const conversationSort = (
  conversationList: ConversationItem[],
  originalList?: ConversationItem[],
) => {
  const listWithIndex = conversationList.map((item, index) => ({
    ...item,
    originalIndex:
      originalList?.findIndex((c) => c.conversationID === item.conversationID) ?? index,
  }));

  const arr: string[] = [];
  const filterArr = listWithIndex.filter((c) => {
    if (!arr.includes(c.conversationID)) {
      arr.push(c.conversationID);
      return true;
    }
    return false;
  });

  filterArr.sort((a, b) => {
    if (a.isPinned === b.isPinned) {
      const aCompare =
        a.draftTextTime > a.latestMsgSendTime ? a.draftTextTime : a.latestMsgSendTime;
      const bCompare =
        b.draftTextTime > b.latestMsgSendTime ? b.draftTextTime : b.latestMsgSendTime;
      if (aCompare > bCompare) {
        return -1;
      } else if (aCompare < bCompare) {
        return 1;
      } else {
        if (!originalList) return 0;
        return a.originalIndex - b.originalIndex;
      }
    } else if (a.isPinned && !b.isPinned) {
      return -1;
    } else {
      return 1;
    }
  });

  return filterArr.map(({ originalIndex, ...rest }) => rest);
};

export const isGroupSession = (sessionType?: SessionType) =>
  sessionType ? GroupSessionTypes.includes(sessionType) : false;

export const parseConversationLatestMessage = (latestMsg?: string) => {
  if (!latestMsg) return undefined;

  try {
    return JSON.parse(latestMsg) as MessageItem;
  } catch (error) {
    return undefined;
  }
};

export const isSidebarSuppressedGroupEventMessage = (message?: MessageItem) =>
  Boolean(message?.groupID) &&
  Boolean(message?.contentType) &&
  SidebarSuppressedGroupEventTypes.includes(message.contentType);

export const isSidebarSuppressedConversation = (conversation?: ConversationItem) => {
  if (!conversation?.latestMsg || !isGroupSession(conversation.conversationType)) {
    return false;
  }

  return isSidebarSuppressedGroupEventMessage(
    parseConversationLatestMessage(conversation.latestMsg),
  );
};

export const sanitizeConversationSidebarReminder = (
  conversation: ConversationItem,
  previousConversation?: ConversationItem,
) => {
  if (!isSidebarSuppressedConversation(conversation)) {
    return conversation;
  }

  const fallbackConversation =
    previousConversation && !isSidebarSuppressedConversation(previousConversation)
      ? previousConversation
      : undefined;

  return {
    ...conversation,
    unreadCount: previousConversation?.unreadCount ?? 0,
    latestMsg: fallbackConversation?.latestMsg ?? "",
    latestMsgSendTime: fallbackConversation?.latestMsgSendTime ?? 0,
  };
};

export const getFilteredConversationUnreadCount = (
  conversationList: ConversationItem[],
) =>
  conversationList.reduce(
    (total, conversation) => total + Math.max(0, conversation.unreadCount || 0),
    0,
  );

const regex =
  /\b(https?:\/\/|www\.)[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*(:\d+)?(\.[a-zA-Z]{2,})?(\/[a-zA-Z0-9\/_.-]*(%[a-fA-F0-9]{2})*(\/[a-zA-Z0-9\/_.-]*)*(\?\S*)?(#\S*)?)?(?=([^a-zA-Z0-9\/_.-]|$))/g;

export const formatLink = (content: string) =>
  content.replace(regex, (match) => {
    let href = match;
    if (!match.match(/^https?:\/\//)) {
      href = "https://" + match;
    }
    return `<a href="${href}" target="_blank" class="link-el">${match}</a>`;
  });

export const calcApplicationBadge = async () => {
  const unHandleFriendApplicationNum = useContactStore
    .getState()
    .recvFriendApplicationList.filter(
      (application) =>
        application.handleResult === 0,
    ).length;

  const unHandleGroupApplicationNum = useContactStore
    .getState()
    .recvGroupApplicationList.filter(
      (application) =>
        application.handleResult === 0,
    ).length;
  useContactStore
    .getState()
    .updateUnHandleFriendApplicationCount(unHandleFriendApplicationNum);
  useContactStore
    .getState()
    .updateUnHandleGroupApplicationCount(unHandleGroupApplicationNum);
};

export const getConversationContent = (message: MessageItem) => {
  if (
    !message.groupID ||
    SystemMessageTypes.includes(message.contentType) ||
    message.sendID === useUserStore.getState().selfInfo.userID
  ) {
    return formatMessageByType(message);
  }
  return `${message.senderNickname}：${formatMessageByType(message)}`;
};

export const uploadFile = async (file: FileWithPath, path?: string) => {
  const params: UploadFileParams = {
    name: file.name,
    contentType: file.type,
    uuid: uuidV4(),
    cause: "",
  };
  if (window.electronAPI) {
    params.filepath = path ?? file.path;
  } else {
    params.file = file;
  }
  return IMSDK.uploadFile(params);
};

export const getConversationIDByMsg = (message: MessageItem) => {
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
