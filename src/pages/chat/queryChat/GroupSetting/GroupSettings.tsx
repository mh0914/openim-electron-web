import { GroupStatus } from "@openim/wasm-client-sdk";
import { RightOutlined } from "@ant-design/icons";
import { Button, Divider, Empty, Input, Switch, Upload } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useCopyToClipboard } from "react-use";

import { modal } from "@/AntdGlobalComp";
import copy from "@/assets/images/chatSetting/copy.png";
import edit_avatar from "@/assets/images/chatSetting/edit_avatar.png";
import EditableContent from "@/components/EditableContent";
import OIMAvatar from "@/components/OIMAvatar";
import SettingRow from "@/components/SettingRow";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import { feedbackToast } from "@/utils/common";
import { emit } from "@/utils/events";
import { IMSDK } from "@/layout/MainContentWrap";
import { uploadFile } from "@/utils/imCommon";

import { canEditChatroomProfile } from "../chatroom";
import { FileWithPath } from "../ChatFooter/SendActionBar/useFileMessage";
import GroupMemberRow from "./GroupMemberRow";
import {
  ChatroomBlackMember,
  formatMuteRemainDuration,
  formatNotificationUpdateTime,
  getChatroomMuteRemainSeconds,
  isChatroomTemporaryMuted,
  parseGroupProfileExtra,
  stringifyGroupProfileExtra,
} from "./groupProfileExtra";
import { useGroupSettings } from "./useGroupSettings";

const EditValue = ({
  value,
  editable,
  onEdit,
}: {
  value?: string;
  editable?: boolean;
  onEdit?: () => void;
}) => {
  return (
    <div className="flex max-w-[260px] items-center justify-end gap-2 text-right">
      <span className="truncate text-xs text-[var(--sub-text)]">{value || ""}</span>
      {editable && (
        <button
          type="button"
          className="text-xs text-[var(--primary)]"
          onClick={onEdit}
        >
          编辑
        </button>
      )}
    </div>
  );
};

const openInputModal = ({
  title,
  initialValue,
  placeholder,
}: {
  title: string;
  initialValue?: string;
  placeholder?: string;
}) =>
  new Promise<string | null>((resolve) => {
    let inputValue = initialValue ?? "";

    const instance = modal.confirm({
      title,
      content: (
        <Input
          autoFocus
          defaultValue={initialValue}
          placeholder={placeholder}
          onChange={(event) => {
            inputValue = event.target.value;
          }}
          onPressEnter={() => {
            instance.destroy();
            resolve(inputValue);
          }}
        />
      ),
      onOk: async () => {
        resolve(inputValue);
      },
      onCancel: () => {
        resolve(null);
      },
    });
  });

const GroupSettings = ({
  updateTravel,
  closeOverlay,
}: {
  updateTravel: () => void;
  closeOverlay: () => void;
}) => {
  const { isNomal, isOwner, isJoinGroup, currentRolevel } = useCurrentMemberRole();

  const { currentGroupInfo, syncGroupInfo, updateGroupInfo, tryQuitGroup, tryDismissGroup } =
    useGroupSettings({ closeOverlay });

  const [, copyToClipboard] = useCopyToClipboard();

  const profileExtra = useMemo(
    () => parseGroupProfileExtra(currentGroupInfo?.ex),
    [currentGroupInfo?.ex],
  );
  const blacklistedMembers = profileExtra.blacklistedMembers ?? [];
  const hasPermissions = canEditChatroomProfile(currentRolevel);
  const temporaryMuted = isChatroomTemporaryMuted(profileExtra);
  const temporaryMuteRemainSeconds = getChatroomMuteRemainSeconds(profileExtra);
  const temporaryMuteStatusText = temporaryMuted
    ? `已开启，剩余 ${formatMuteRemainDuration(temporaryMuteRemainSeconds)}`
    : "未开启";
  const allMuted = currentGroupInfo?.status === GroupStatus.Muted;
  const allMuteStatusText = allMuted ? "已开启" : "未开启";
  const [, setMuteTick] = useState(Date.now());

  useEffect(() => {
    if (!temporaryMuted) {
      return;
    }

    const timer = window.setInterval(() => {
      setMuteTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [temporaryMuted]);

  const updateGroupEx = useCallback(
    async (patch: Parameters<typeof stringifyGroupProfileExtra>[1]) => {
      if (!currentGroupInfo) {
        return;
      }

      const nextEx = stringifyGroupProfileExtra(currentGroupInfo.ex, patch);
      await updateGroupInfo({ ex: nextEx });
    },
    [currentGroupInfo, updateGroupInfo],
  );

  const updateBlacklistedMembers = useCallback(
    async (members: ChatroomBlackMember[]) => {
      await updateGroupEx({ blacklistedMembers: members });
    },
    [updateGroupEx],
  );

  const toggleTemporaryMute = useCallback(
    async (checked: boolean) => {
      if (!hasPermissions) {
        feedbackToast({
          msg: "仅创建者和管理员可设置临时禁言",
          error: "仅创建者和管理员可设置临时禁言",
        });
        return;
      }

      try {
        if (!checked) {
          await updateGroupEx({ temporaryMuteUntil: 0 });
          feedbackToast({ msg: "已关闭聊天室临时禁言" });
          return;
        }

        const input = await openInputModal({
          title: "请输入聊天室临时禁言时长（分钟）",
          initialValue: "10",
          placeholder: "例如：10",
        });
        if (input === null) {
          return;
        }

        const minutes = Number(input);
        if (!Number.isFinite(minutes) || minutes <= 0) {
          feedbackToast({ msg: "请输入大于 0 的分钟数", error: "请输入大于 0 的分钟数" });
          return;
        }

        await updateGroupEx({
          temporaryMuteUntil: Date.now() + Math.ceil(minutes * 60) * 1000,
        });
        feedbackToast({
          msg: `已开启聊天室临时禁言，时长 ${Math.ceil(minutes)} 分钟`,
        });
      } catch (error) {
        feedbackToast({ error, msg: "设置聊天室临时禁言失败" });
      }
    },
    [hasPermissions, updateGroupEx],
  );

  const updateTemporaryMuteDuration = useCallback(async () => {
    if (!hasPermissions) {
      feedbackToast({
        msg: "仅创建者和管理员可设置临时禁言时长",
        error: "仅创建者和管理员可设置临时禁言时长",
      });
      return;
    }

    const input = await openInputModal({
      title: "请输入聊天室临时禁言时长（分钟）",
      initialValue: temporaryMuted
        ? String(Math.max(1, Math.ceil(temporaryMuteRemainSeconds / 60)))
        : "10",
      placeholder: "例如：10",
    });

    if (input === null) {
      return;
    }

    const minutes = Number(input);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      feedbackToast({ msg: "请输入大于 0 的分钟数", error: "请输入大于 0 的分钟数" });
      return;
    }

    try {
      await updateGroupEx({
        temporaryMuteUntil: Date.now() + Math.ceil(minutes * 60) * 1000,
      });
      feedbackToast({
        msg: `已更新聊天室临时禁言时长为 ${Math.ceil(minutes)} 分钟`,
      });
    } catch (error) {
      feedbackToast({ error, msg: "更新聊天室临时禁言时长失败" });
    }
  }, [hasPermissions, temporaryMuted, temporaryMuteRemainSeconds, updateGroupEx]);

  const toggleAllMute = useCallback(
    async (checked: boolean) => {
      if (!currentGroupInfo?.groupID) {
        return;
      }

      if (!hasPermissions) {
        feedbackToast({
          msg: "仅创建者和管理员可设置全员禁言",
          error: "仅创建者和管理员可设置全员禁言",
        });
        return;
      }

      try {
        await IMSDK.changeGroupMute({
          groupID: currentGroupInfo.groupID,
          isMute: checked,
        });
        syncGroupInfo?.({
          status: checked ? GroupStatus.Muted : GroupStatus.Normal,
        });
        feedbackToast({
          msg: checked ? "已开启聊天室全员禁言" : "已关闭聊天室全员禁言",
        });
      } catch (error) {
        feedbackToast({ error, msg: checked ? "开启全员禁言失败" : "关闭全员禁言失败" });
      }
    },
    [currentGroupInfo?.groupID, hasPermissions, syncGroupInfo],
  );

  const promptEdit = useCallback(
    async (
      title: string,
      currentValue: string,
      onSave: (value: string) => Promise<unknown>,
    ) => {
      if (!hasPermissions) {
        feedbackToast({
          msg: "仅创建者和管理员可编辑",
          error: "仅创建者和管理员可编辑",
        });
        return;
      }

      const nextValue = await openInputModal({
        title: `请输入${title}`,
        initialValue: currentValue ?? "",
      });
      if (nextValue === null) {
        return;
      }

      try {
        await onSave(nextValue.trim());
        feedbackToast({ msg: `已保存${title}` });
      } catch (error) {
        feedbackToast({ error, msg: `保存${title}失败` });
      }
    },
    [hasPermissions],
  );

  const removeFromBlacklist = useCallback(
    async (userID: string) => {
      if (!hasPermissions) {
        feedbackToast({
          msg: "仅创建者和管理员可解除拉黑",
          error: "仅创建者和管理员可解除拉黑",
        });
        return;
      }

      try {
        await updateBlacklistedMembers(
          blacklistedMembers.filter((member) => member.userID !== userID),
        );
        feedbackToast({ msg: "已解除拉黑，该用户现在可以再次被邀请入群" });
      } catch (error) {
        feedbackToast({ error, msg: "解除拉黑失败" });
      }
    },
    [blacklistedMembers, hasPermissions, updateBlacklistedMembers],
  );

  const customUpload = async ({ file }: { file: FileWithPath }) => {
    try {
      const {
        data: { url },
      } = await uploadFile(file);
      await updateGroupInfo({ faceURL: url });
    } catch (error) {
      feedbackToast({ error: t("toast.updateAvatarFailed") });
    }
  };

  const updateGroupName = useCallback(
    async (groupName: string) => {
      await updateGroupInfo({ groupName });
    },
    [updateGroupInfo],
  );

  const transferGroup = () => {
    emit("OPEN_CHOOSE_MODAL", {
      type: "TRANSFER_IN_GROUP",
      extraData: currentGroupInfo?.groupID,
    });
  };

  const creatorValue =
    profileExtra.creator ||
    currentGroupInfo?.creatorUserID ||
    currentGroupInfo?.ownerUserID ||
    "";
  const onlineCountValue = profileExtra.onlineCount || "";
  const groupTypeValue = profileExtra.groupTypeText || t("placeholder.workGroup");
  const notificationTimeValue = formatNotificationUpdateTime(
    currentGroupInfo?.notificationUpdateTime,
    profileExtra.updateNotificationTime,
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center p-4">
        <div className="flex items-center">
          <Upload
            accept="image/*"
            className={clsx({ "disabled-upload": !hasPermissions })}
            openFileDialogOnClick={hasPermissions}
            showUploadList={false}
            customRequest={customUpload as never}
          >
            <div className="relative">
              <OIMAvatar
                isgroup
                src={currentGroupInfo?.faceURL}
                text={currentGroupInfo?.groupName}
              />
              {hasPermissions && (
                <img
                  className="absolute -bottom-1 -right-1"
                  width={15}
                  src={edit_avatar}
                  alt="edit avatar"
                />
              )}
            </div>
          </Upload>

          <EditableContent
            textClassName="font-medium"
            value={currentGroupInfo?.groupName}
            editable={hasPermissions}
            onChange={updateGroupName}
          />
        </div>
      </div>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />
      {currentGroupInfo && isJoinGroup && (
        <GroupMemberRow
          currentGroupInfo={currentGroupInfo}
          isNomal={isNomal}
          updateTravel={updateTravel}
        />
      )}
      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      <SettingRow className="pb-2" title={`${t("placeholder.group")}ID`}>
        <div className="flex items-center">
          <span className="mr-1 text-xs text-[var(--sub-text)]">
            {currentGroupInfo?.groupID}
          </span>
          <img
            className="cursor-pointer"
            width={14}
            src={copy}
            alt=""
            onClick={() => {
              copyToClipboard(currentGroupInfo?.groupID ?? "");
              feedbackToast({ msg: t("toast.copySuccess") });
            }}
          />
        </div>
      </SettingRow>
      <SettingRow title="群类型">
        <EditValue
          value={groupTypeValue}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("群类型", groupTypeValue, async (value) => {
              await updateGroupEx({ groupTypeText: value });
            })
          }
        />
      </SettingRow>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      <div className="px-4 pt-4 text-sm text-[var(--sub-text)]">群基本信息</div>
      <SettingRow title="创建者">
        <EditValue
          value={creatorValue}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("创建者", creatorValue, async (value) => {
              await updateGroupEx({ creator: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="在线人数">
        <EditValue
          value={onlineCountValue}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("在线人数", onlineCountValue, async (value) => {
              await updateGroupEx({ onlineCount: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="名称">
        <EditValue
          value={currentGroupInfo?.groupName || ""}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("名称", currentGroupInfo?.groupName || "", async (value) => {
              await updateGroupInfo({ groupName: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="公告">
        <EditValue
          value={currentGroupInfo?.notification || ""}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("公告", currentGroupInfo?.notification || "", async (value) => {
              await updateGroupInfo({ notification: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="直播地址">
        <EditValue
          value={profileExtra.liveAddress || ""}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("直播地址", profileExtra.liveAddress || "", async (value) => {
              await updateGroupEx({ liveAddress: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="扩展字段">
        <EditValue
          value={profileExtra.extensionField || ""}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("扩展字段", profileExtra.extensionField || "", async (value) => {
              await updateGroupEx({ extensionField: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="是否发送更新通知">
        <div className="flex items-center gap-2">
          <Switch
            className="bg-[#8e9aaf]"
            checked={Boolean(profileExtra.sendUpdateNotification)}
            disabled={!hasPermissions}
            onChange={(checked) => {
              if (!hasPermissions) {
                return;
              }
              void updateGroupEx({ sendUpdateNotification: checked }).then(() => {
                feedbackToast({ msg: "已保存是否发送更新通知" });
              });
            }}
          />
        </div>
      </SettingRow>
      <SettingRow title="更新通知时间">
        <EditValue
          value={notificationTimeValue}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit("更新通知时间", notificationTimeValue, async (value) => {
              await updateGroupEx({ updateNotificationTime: value });
            })
          }
        />
      </SettingRow>
      <SettingRow title="通知事件扩展字段">
        <EditValue
          value={profileExtra.notificationEventExtra || ""}
          editable={hasPermissions}
          onEdit={() =>
            void promptEdit(
              "通知事件扩展字段",
              profileExtra.notificationEventExtra || "",
              async (value) => {
                await updateGroupEx({ notificationEventExtra: value });
              },
            )
          }
        />
      </SettingRow>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      <div className="px-4 pt-4 text-sm text-[var(--sub-text)]">聊天室禁言</div>
      <SettingRow title="聊天室临时禁言">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--sub-text)]">{temporaryMuteStatusText}</span>
          <Switch
            className="bg-[#8e9aaf]"
            checked={temporaryMuted}
            disabled={!hasPermissions}
            onChange={(checked) => {
              void toggleTemporaryMute(checked);
            }}
          />
        </div>
      </SettingRow>
      <SettingRow title="聊天室全员禁言">
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--sub-text)]">{allMuteStatusText}</span>
          <Switch
            className="bg-[#8e9aaf]"
            checked={allMuted}
            disabled={!hasPermissions}
            onChange={(checked) => {
              void toggleAllMute(checked);
            }}
          />
        </div>
      </SettingRow>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      <div className="px-4 pt-4 text-sm text-[var(--sub-text)]">聊天室黑名单</div>
      <div className="px-4 pb-4 pt-2">
        {blacklistedMembers.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无黑名单成员" />
        ) : (
          <div className="space-y-3">
            {blacklistedMembers.map((member) => (
              <div
                key={member.userID}
                className="flex items-center justify-between rounded border border-[var(--gap-text)] px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                  <OIMAvatar src={member.faceURL} text={member.nickname || member.userID} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {member.nickname || member.userID}
                    </div>
                    <div className="truncate text-xs text-[var(--sub-text)]">
                      {member.userID}
                    </div>
                  </div>
                </div>
                {hasPermissions && (
                  <Button type="link" onClick={() => void removeFromBlacklist(member.userID)}>
                    解除拉黑
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Divider className="m-0 border-4 border-[#F4F5F7]" />

      {isOwner && (
        <>
          <Divider className="m-0 border-4 border-[#F4F5F7]" />
          <SettingRow
            className="cursor-pointer"
            title={t("placeholder.transferGroup")}
            rowClick={transferGroup}
          >
            <RightOutlined rev={undefined} />
          </SettingRow>
        </>
      )}

      <div className="flex-1" />
      {isJoinGroup && (
        <div className="flex w-full justify-center pb-3 pt-24">
          {!isOwner ? (
            <Button type="primary" danger ghost onClick={tryQuitGroup}>
              {t("placeholder.exitGroup")}
            </Button>
          ) : (
            <Button type="primary" danger onClick={tryDismissGroup}>
              {t("placeholder.disbandGroup")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(GroupSettings);
