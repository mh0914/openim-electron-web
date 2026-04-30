import { GroupMemberRole } from "@openim/wasm-client-sdk";
import { GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Button, Empty, Spin } from "antd";
import { t } from "i18next";
import { FC, memo, useCallback, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";

import OIMAvatar from "@/components/OIMAvatar";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import useGroupMembers from "@/hooks/useGroupMembers";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useContactStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";

import {
  canDemoteAdmin,
  canModerateMember,
  canPromoteToAdmin,
  getChatroomRoleLabel,
  isMemberMuted,
} from "../chatroom";
import { useChatroomSelfNickname } from "../useChatroomSelfNickname";
import {
  ChatroomBlackMember,
  parseGroupProfileExtra,
  stringifyGroupProfileExtra,
} from "./groupProfileExtra";
import styles from "./group-setting.module.scss";

const DEFAULT_MUTE_SECONDS = 10 * 60;

const formatMuteDuration = (seconds: number) => {
  if (seconds % 3600 === 0) {
    return `${seconds / 3600}小时`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60}分钟`;
  }

  return `${seconds}秒`;
};

const GroupMemberList: FC = () => {
  const selfInfo = useUserStore((state) => state.selfInfo);
  const selfUserID = selfInfo.userID;
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);
  const updateCurrentGroupInfo = useConversationStore((state) => state.updateCurrentGroupInfo);
  const updateGroup = useContactStore((state) => state.updateGroup);
  const { currentMemberInGroup, currentRolevel } = useCurrentMemberRole();
  const { selfNickname } = useChatroomSelfNickname(currentMemberInGroup?.groupID);
  const { fetchState, getMemberData, resetState } = useGroupMembers();

  useEffect(() => {
    if (currentMemberInGroup?.groupID) {
      void getMemberData(true);
    }
    return () => {
      resetState();
    };
  }, [currentMemberInGroup?.groupID, getMemberData, resetState]);

  const endReached = () => {
    if (fetchState.loading || !fetchState.hasMore) {
      return;
    }
    void getMemberData();
  };

  const refreshMembers = useCallback(async () => {
    await getMemberData(true);
  }, [getMemberData]);

  const blacklistedMembers =
    parseGroupProfileExtra(currentGroupInfo?.ex).blacklistedMembers ?? [];

  const saveBlacklistedMembers = useCallback(
    async (members: ChatroomBlackMember[]) => {
      if (!currentGroupInfo?.groupID) {
        return;
      }

      const nextEx = stringifyGroupProfileExtra(currentGroupInfo.ex, {
        blacklistedMembers: members,
      });

      await IMSDK.setGroupInfo({
        groupID: currentGroupInfo.groupID,
        ex: nextEx,
      });

      const nextGroup = {
        ...currentGroupInfo,
        ex: nextEx,
      };

      updateCurrentGroupInfo(nextGroup);
      updateGroup(nextGroup);
    },
    [currentGroupInfo, updateCurrentGroupInfo, updateGroup],
  );

  const updateRoleLevel = useCallback(
    async (member: GroupMemberItem, roleLevel: GroupMemberRole) => {
      try {
        await IMSDK.setGroupMemberInfo({
          groupID: member.groupID,
          userID: member.userID,
          roleLevel,
        });
        feedbackToast({
          msg: roleLevel === GroupMemberRole.Admin ? "已设为管理员" : "已取消管理员",
        });
        await refreshMembers();
      } catch (error) {
        feedbackToast({ error, msg: "修改角色失败" });
      }
    },
    [refreshMembers],
  );

  const kickMember = useCallback(
    async (member: GroupMemberItem) => {
      try {
        await IMSDK.kickGroupMember({
          groupID: member.groupID,
          userIDList: [member.userID],
          reason: "",
        });
        feedbackToast({ msg: "已移出聊天室" });
        await refreshMembers();
      } catch (error) {
        feedbackToast({ error, msg: "移出聊天室失败" });
      }
    },
    [refreshMembers],
  );

  const toggleMute = useCallback(
    async (member: GroupMemberItem) => {
      const currentMuted = isMemberMuted(member.muteEndTime);
      const mutedSeconds = currentMuted ? 0 : DEFAULT_MUTE_SECONDS;

      try {
        await IMSDK.changeGroupMemberMute({
          groupID: member.groupID,
          userID: member.userID,
          mutedSeconds,
        });

        feedbackToast({
          msg: currentMuted
            ? "已解除个人禁言"
            : `已开启个人禁言，默认时长 ${formatMuteDuration(mutedSeconds)}`,
        });
        await refreshMembers();
      } catch (error) {
        feedbackToast({
          error,
          msg: currentMuted ? "解除个人禁言失败" : "开启个人禁言失败",
        });
      }
    },
    [refreshMembers],
  );

  const blacklistMember = useCallback(
    async (member: GroupMemberItem) => {
      try {
        const exists = blacklistedMembers.some((item) => item.userID === member.userID);
        if (!exists) {
          await saveBlacklistedMembers([
            ...blacklistedMembers,
            {
              userID: member.userID,
              nickname: member.nickname,
              faceURL: member.faceURL,
            },
          ]);
        }

        await IMSDK.kickGroupMember({
          groupID: member.groupID,
          userIDList: [member.userID],
          reason: "",
        });

        feedbackToast({ msg: "已拉黑并移出聊天室" });
        await refreshMembers();
      } catch (error) {
        feedbackToast({ error, msg: "聊天室拉黑失败" });
      }
    },
    [blacklistedMembers, refreshMembers, saveBlacklistedMembers],
  );

  return (
    <div className="h-full px-2 py-2.5">
      {fetchState.groupMemberList.length === 0 ? (
        <Empty
          className="flex h-full flex-col items-center justify-center"
          description={t("empty.noSearchResults")}
        />
      ) : (
        <Virtuoso
          className="h-full overflow-x-hidden"
          data={fetchState.groupMemberList}
          endReached={endReached}
          components={{
            Header: () => (fetchState.loading ? <Spin /> : null),
          }}
          itemContent={(_, member) => (
            <MemberItem
              currentRolevel={currentRolevel}
              member={member}
              selfDisplayName={
                member.userID === selfUserID && selfNickname ? selfNickname : undefined
              }
              selfUserID={selfUserID}
              onBlacklist={blacklistMember}
              onKick={kickMember}
              onToggleMute={toggleMute}
              onUpdateRoleLevel={updateRoleLevel}
            />
          )}
        />
      )}
    </div>
  );
};

export default GroupMemberList;

interface IMemberItemProps {
  member: GroupMemberItem;
  selfDisplayName?: string;
  selfUserID: string;
  currentRolevel?: number;
  onKick: (member: GroupMemberItem) => Promise<void>;
  onToggleMute: (member: GroupMemberItem) => Promise<void>;
  onBlacklist: (member: GroupMemberItem) => Promise<void>;
  onUpdateRoleLevel: (member: GroupMemberItem, roleLevel: GroupMemberRole) => Promise<void>;
}

const MemberItem = memo(
  ({
    member,
    selfDisplayName,
    selfUserID,
    currentRolevel,
    onKick,
    onToggleMute,
    onBlacklist,
    onUpdateRoleLevel,
  }: IMemberItemProps) => {
    const roleLabel = getChatroomRoleLabel(member.roleLevel);
    const currentMuted = isMemberMuted(member.muteEndTime);
    const allowPromote = canPromoteToAdmin(currentRolevel, member.roleLevel);
    const allowDemote = canDemoteAdmin(currentRolevel, member.roleLevel);
    const allowModerate = canModerateMember(
      currentRolevel,
      member.roleLevel,
      member.userID,
      selfUserID,
    );

    return (
      <div className={styles["list-member-item"]}>
        <div
          className="flex items-center overflow-hidden"
          onClick={() => window.userClick(member.userID, member.groupID)}
        >
          <OIMAvatar src={member.faceURL} text={member.nickname} />
          <div className="ml-3 flex min-w-0 items-center gap-2">
            <div className="max-w-[120px] truncate">{selfDisplayName || member.nickname}</div>
            {roleLabel && (
              <span
                className={
                  member.roleLevel === GroupMemberRole.Owner
                    ? "rounded border border-[#FF9831] px-1 text-xs text-[#FF9831]"
                    : "rounded border border-[#2b7fff] px-1 text-xs text-[#2b7fff]"
                }
              >
                {roleLabel}
              </span>
            )}
            {currentMuted && (
              <span className="rounded border border-[#ff4d4f] px-1 text-xs text-[#ff4d4f]">
                已禁言
              </span>
            )}
          </div>
        </div>

        <div className={styles["tools-row"]}>
          {allowPromote && (
            <Button
              type="link"
              onClick={() => void onUpdateRoleLevel(member, GroupMemberRole.Admin)}
            >
              设管理员
            </Button>
          )}
          {allowDemote && (
            <Button
              type="link"
              onClick={() => void onUpdateRoleLevel(member, GroupMemberRole.Normal)}
            >
              取消管理员
            </Button>
          )}
          {allowModerate && (
            <Button type="link" onClick={() => void onToggleMute(member)}>
              {currentMuted ? "解除禁言" : "个人禁言"}
            </Button>
          )}
          {allowModerate && (
            <Button danger type="link" onClick={() => void onKick(member)}>
              移除
            </Button>
          )}
          {allowModerate && member.roleLevel === GroupMemberRole.Normal && (
            <Button danger type="link" onClick={() => void onBlacklist(member)}>
              拉黑
            </Button>
          )}
        </div>
      </div>
    );
  },
);
