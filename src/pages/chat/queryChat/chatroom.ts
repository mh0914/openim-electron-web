import { GroupMemberRole, GroupStatus, MessageType } from "@openim/wasm-client-sdk";

import { GroupProfileExtra, isChatroomTemporaryMuted } from "./GroupSetting/groupProfileExtra";

export type HistoryFilterType =
  | "all"
  | "text"
  | "image"
  | "voice"
  | "video"
  | "file"
  | "location";

export const normalizeMuteEndTime = (muteEndTime?: number) => {
  if (!muteEndTime) {
    return 0;
  }

  return muteEndTime < 1_000_000_000_000 ? muteEndTime * 1000 : muteEndTime;
};

export const isMemberMuted = (muteEndTime?: number) =>
  normalizeMuteEndTime(muteEndTime) > Date.now();

export const getChatroomRoleLabel = (roleLevel?: number) => {
  switch (roleLevel) {
    case GroupMemberRole.Owner:
      return "创建者";
    case GroupMemberRole.Admin:
      return "管理员";
    default:
      return "";
  }
};

export const canEditChatroomProfile = (roleLevel?: number) =>
  roleLevel === GroupMemberRole.Owner || roleLevel === GroupMemberRole.Admin;

export const canDismissChatroom = (roleLevel?: number) =>
  roleLevel === GroupMemberRole.Owner;

export const canPromoteToAdmin = (
  currentRoleLevel?: number,
  targetRoleLevel?: number,
) =>
  currentRoleLevel === GroupMemberRole.Owner &&
  targetRoleLevel === GroupMemberRole.Normal;

export const canDemoteAdmin = (
  currentRoleLevel?: number,
  targetRoleLevel?: number,
) =>
  currentRoleLevel === GroupMemberRole.Owner &&
  targetRoleLevel === GroupMemberRole.Admin;

export const canModerateMember = (
  currentRoleLevel?: number,
  targetRoleLevel?: number,
  targetUserID?: string,
  selfUserID?: string,
) => {
  if (!targetUserID || !selfUserID || targetUserID === selfUserID) {
    return false;
  }

  if (currentRoleLevel === GroupMemberRole.Owner) {
    return targetRoleLevel !== GroupMemberRole.Owner;
  }

  if (currentRoleLevel === GroupMemberRole.Admin) {
    return targetRoleLevel === GroupMemberRole.Normal;
  }

  return false;
};

export const isChatroomAllMuted = (groupStatus?: number) =>
  groupStatus === GroupStatus.Muted;

export const isChatroomSpeakBlocked = ({
  currentRoleLevel,
  currentMuteEndTime,
  groupStatus,
  profileExtra,
  isBlacklisted,
}: {
  currentRoleLevel?: number;
  currentMuteEndTime?: number;
  groupStatus?: number;
  profileExtra?: GroupProfileExtra;
  isBlacklisted?: boolean;
}) => {
  if (isBlacklisted) {
    return true;
  }

  if (isMemberMuted(currentMuteEndTime)) {
    return true;
  }

  if (canEditChatroomProfile(currentRoleLevel)) {
    return false;
  }

  return isChatroomAllMuted(groupStatus) || isChatroomTemporaryMuted(profileExtra);
};

export const getChatroomSpeakBlockedReason = ({
  currentRoleLevel,
  currentMuteEndTime,
  groupStatus,
  profileExtra,
  isBlacklisted,
}: {
  currentRoleLevel?: number;
  currentMuteEndTime?: number;
  groupStatus?: number;
  profileExtra?: GroupProfileExtra;
  isBlacklisted?: boolean;
}) => {
  if (isBlacklisted) {
    return "你已被聊天室拉黑，无法进入或发送消息";
  }

  if (isMemberMuted(currentMuteEndTime)) {
    return "你已被聊天室禁言，暂时无法发送消息";
  }

  if (canEditChatroomProfile(currentRoleLevel)) {
    return "";
  }

  if (isChatroomAllMuted(groupStatus)) {
    return "聊天室当前处于全员禁言状态，仅创建者和管理员可发言";
  }

  if (isChatroomTemporaryMuted(profileExtra)) {
    return "聊天室当前处于临时禁言状态，仅创建者和管理员可发言";
  }

  return "";
};

export const historyMessageTypeMap: Record<
  Exclude<HistoryFilterType, "all">,
  MessageType[]
> = {
  text: [MessageType.TextMessage],
  image: [MessageType.PictureMessage],
  voice: [MessageType.VoiceMessage],
  video: [MessageType.VideoMessage],
  file: [MessageType.FileMessage],
  location: [MessageType.LocationMessage],
};

export const isHistoryMessageMatched = (
  contentType: number,
  filterType: HistoryFilterType,
) => {
  if (filterType === "all") {
    return true;
  }

  return historyMessageTypeMap[filterType].includes(contentType as MessageType);
};
