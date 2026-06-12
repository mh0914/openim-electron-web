import { GroupMemberRole } from "@openim/wasm-client-sdk";
import { GroupItem } from "@openim/wasm-client-sdk/lib/types/entity";
import clsx from "clsx";
import { t } from "i18next";
import { memo, useEffect } from "react";

import invite from "@/assets/images/chatSetting/invite.png";
import kick from "@/assets/images/chatSetting/kick.png";
import OIMAvatar from "@/components/OIMAvatar";
import useGroupMembers from "@/hooks/useGroupMembers";
import { emit } from "@/utils/events";

import {
  getChatroomVisitorAvatar,
  getChatroomVisitorDisplayName,
  getChatroomVisitorIdentity,
  getChatroomVisitorLabel,
  parseGroupProfileExtra,
} from "./groupProfileExtra";
import styles from "./group-setting.module.scss";

const ownerLabel = "\u521b\u5efa\u8005";
const adminLabel = "\u7ba1\u7406\u5458";

const GroupMemberRow = ({
  currentGroupInfo,
  isNomal,
  updateTravel,
}: {
  currentGroupInfo: GroupItem;
  isNomal: boolean;
  updateTravel: () => void;
}) => {
  const { fetchState, getMemberData, resetState } = useGroupMembers();
  const profileExtra = parseGroupProfileExtra(currentGroupInfo.ex);

  useEffect(() => {
    if (currentGroupInfo?.groupID) {
      getMemberData(true);
    }
    return () => {
      resetState();
    };
  }, [currentGroupInfo?.groupID, getMemberData, resetState]);

  const sliceCount = isNomal ? 17 : 16;

  const inviteMember = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    emit("OPEN_CHOOSE_MODAL", {
      type: "INVITE_TO_GROUP",
      extraData: currentGroupInfo.groupID,
    });
  };

  const kickMember = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.stopPropagation();
    emit("OPEN_CHOOSE_MODAL", {
      type: "KICK_FORM_GROUP",
      extraData: currentGroupInfo.groupID,
    });
  };

  return (
    <div className="p-4">
      <div className="mb-3 font-medium">
        <span>{t("placeholder.groupMember")}</span>
        <span className="ml-2">{currentGroupInfo?.memberCount}</span>
      </div>
      <div className="flex flex-wrap items-center">
        {fetchState.groupMemberList.slice(0, sliceCount).map((member) => {
          const visitorIdentity = getChatroomVisitorIdentity(
            profileExtra,
            member.userID,
            member.ex,
          );
          const visitorLabel = getChatroomVisitorLabel(visitorIdentity?.role);
          const displayName =
            getChatroomVisitorDisplayName(visitorIdentity, member.nickname) ||
            member.nickname;

          return (
            <div
              key={member.userID}
              title={displayName}
              className={styles["member-item"]}
              onClick={() => window.userClick(member.userID, member.groupID)}
            >
              <OIMAvatar
                src={getChatroomVisitorAvatar(visitorIdentity, member.faceURL)}
                text={displayName}
                size={36}
                bgColor={visitorIdentity?.role === "anonymous" ? "#8c8c8c" : undefined}
              />
              <div className="mt-2 min-h-[16px] max-w-full truncate text-xs">
                {displayName}
                {visitorLabel && (
                  <span className="ml-1 rounded border border-[#52c41a] px-1 text-[10px] text-[#52c41a]">
                    {visitorLabel}
                  </span>
                )}
                {member.roleLevel === GroupMemberRole.Owner && (
                  <span className="ml-1 rounded border border-[#FF9831] px-1 text-[10px] text-[#FF9831]">
                    {ownerLabel}
                  </span>
                )}
                {member.roleLevel === GroupMemberRole.Admin && (
                  <span className="ml-1 rounded border border-[#2b7fff] px-1 text-[10px] text-[#2b7fff]">
                    {adminLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div
          className={clsx(styles["member-item"], "cursor-pointer")}
          onClick={inviteMember}
        >
          <img width={36} src={invite} alt="invite" />
          <div className="mt-2 max-w-full truncate text-xs text-[var(--sub-text)]">
            {t("placeholder.add")}
          </div>
        </div>
        {!isNomal && (
          <div
            className={clsx(styles["member-item"], "cursor-pointer")}
            onClick={kickMember}
          >
            <img width={36} src={kick} alt="kick" />
            <div className="mt-2 max-w-full truncate text-xs text-[var(--sub-text)]">
              {t("placeholder.remove")}
            </div>
          </div>
        )}
      </div>
      <div
        className="flex cursor-pointer items-center justify-center pt-2 text-xs text-[var(--primary)]"
        onClick={updateTravel}
      >
        {t("placeholder.viewMore")}
      </div>
    </div>
  );
};

export default memo(GroupMemberRow);
