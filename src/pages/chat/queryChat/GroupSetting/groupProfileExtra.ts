import dayjs from "dayjs";
import localForage from "localforage";

export interface GroupProfileExtra {
  groupTypeText?: string;
  creator?: string;
  onlineCount?: string;
  liveAddress?: string;
  extensionField?: string;
  sendUpdateNotification?: boolean;
  updateNotificationTime?: string;
  notificationEventExtra?: string;
  temporaryMuteUntil?: number;
  blacklistedMembers?: ChatroomBlackMember[];
}

export interface GroupProfileDraft extends GroupProfileExtra {
  groupName?: string;
  notification?: string;
  faceURL?: string;
}

export interface ChatroomBlackMember {
  userID: string;
  nickname?: string;
  faceURL?: string;
}

type GroupExtraRecord = Record<string, unknown> & GroupProfileExtra;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseGroupProfileExtra = (rawEx?: string): GroupProfileExtra => {
  if (!rawEx) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawEx);
    if (!isObjectRecord(parsed)) {
      return {
        extensionField: rawEx,
      };
    }

    return {
      groupTypeText:
        typeof parsed.groupTypeText === "string" ? parsed.groupTypeText : "",
      creator: typeof parsed.creator === "string" ? parsed.creator : "",
      onlineCount: typeof parsed.onlineCount === "string" ? parsed.onlineCount : "",
      liveAddress: typeof parsed.liveAddress === "string" ? parsed.liveAddress : "",
      extensionField:
        typeof parsed.extensionField === "string"
          ? parsed.extensionField
          : typeof parsed.ex === "string"
            ? parsed.ex
            : "",
      sendUpdateNotification:
        typeof parsed.sendUpdateNotification === "boolean"
          ? parsed.sendUpdateNotification
          : false,
      updateNotificationTime:
        typeof parsed.updateNotificationTime === "string"
          ? parsed.updateNotificationTime
          : "",
      notificationEventExtra:
        typeof parsed.notificationEventExtra === "string"
          ? parsed.notificationEventExtra
          : "",
      temporaryMuteUntil:
        typeof parsed.temporaryMuteUntil === "number" ? parsed.temporaryMuteUntil : 0,
      blacklistedMembers: Array.isArray(parsed.blacklistedMembers)
        ? parsed.blacklistedMembers
            .filter(isObjectRecord)
            .map((item) => ({
              userID: typeof item.userID === "string" ? item.userID : "",
              nickname: typeof item.nickname === "string" ? item.nickname : "",
              faceURL: typeof item.faceURL === "string" ? item.faceURL : "",
            }))
            .filter((item) => Boolean(item.userID))
        : [],
    };
  } catch {
    return {
      extensionField: rawEx,
    };
  }
};

export const stringifyGroupProfileExtra = (
  rawEx: string | undefined,
  patch: Partial<GroupProfileExtra>,
) => {
  let base: GroupExtraRecord = {};

  if (rawEx) {
    try {
      const parsed = JSON.parse(rawEx);
      if (isObjectRecord(parsed)) {
        base = parsed as GroupExtraRecord;
      } else {
        base.extensionField = rawEx;
      }
    } catch {
      base.extensionField = rawEx;
    }
  }

  const next: GroupExtraRecord = {
    ...base,
    ...patch,
  };

  return JSON.stringify(next);
};

export const formatNotificationUpdateTime = (
  notificationUpdateTime?: number,
  customNotificationUpdateTime?: string,
) => {
  if (customNotificationUpdateTime) {
    return customNotificationUpdateTime;
  }

  if (!notificationUpdateTime) {
    return "";
  }

  return dayjs(notificationUpdateTime).format("YYYY-MM-DD HH:mm:ss");
};

export const isChatroomTemporaryMuted = (extra?: GroupProfileExtra) =>
  (extra?.temporaryMuteUntil ?? 0) > Date.now();

export const getChatroomMuteRemainSeconds = (extra?: GroupProfileExtra) =>
  Math.max(0, Math.ceil(((extra?.temporaryMuteUntil ?? 0) - Date.now()) / 1000));

export const formatMuteRemainDuration = (totalSeconds?: number) => {
  const seconds = Math.max(0, Math.ceil(totalSeconds ?? 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }

  if (minutes > 0) {
    return `${minutes}分钟${remainSeconds}秒`;
  }

  return `${remainSeconds}秒`;
};

const getGroupProfileDraftKey = (groupID: string) => `IM_GROUP_PROFILE_DRAFT_${groupID}`;
const getChatroomSelfNicknameKey = (groupID: string, userID: string) =>
  `IM_CHATROOM_SELF_NICKNAME_${groupID}_${userID}`;

export const getGroupProfileDraft = async (groupID?: string) => {
  if (!groupID) {
    return {} as GroupProfileDraft;
  }

  return (
    (await localForage.getItem<GroupProfileDraft>(getGroupProfileDraftKey(groupID))) ?? {}
  );
};

export const saveGroupProfileDraft = async (
  groupID: string | undefined,
  patch: Partial<GroupProfileDraft>,
) => {
  if (!groupID) {
    return {} as GroupProfileDraft;
  }

  const current = await getGroupProfileDraft(groupID);
  const next = {
    ...current,
    ...patch,
  };

  await localForage.setItem(getGroupProfileDraftKey(groupID), next);

  return next;
};

export const getChatroomSelfNickname = async (groupID?: string, userID?: string) => {
  if (!groupID || !userID) {
    return "";
  }

  return (
    (await localForage.getItem<string>(getChatroomSelfNicknameKey(groupID, userID))) ?? ""
  );
};

export const saveChatroomSelfNickname = async (
  groupID?: string,
  userID?: string,
  nickname?: string,
) => {
  if (!groupID || !userID) {
    return "";
  }

  const value = nickname?.trim() ?? "";
  await localForage.setItem(getChatroomSelfNicknameKey(groupID, userID), value);
  return value;
};
