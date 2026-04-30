import { GroupItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { t } from "i18next";
import { useCallback, useRef } from "react";

import { modal } from "@/AntdGlobalComp";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore } from "@/store";
import { useContactStore } from "@/store/contact";
import { feedbackToast } from "@/utils/common";

export type PermissionField = "applyMemberFriend" | "lookMemberInfo";

export function useGroupSettings({ closeOverlay }: { closeOverlay: () => void }) {
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const updateCurrentGroupInfo = useConversationStore((state) => state.updateCurrentGroupInfo);
  const updateCurrentConversation = useConversationStore(
    (state) => state.updateCurrentConversation,
  );
  const updateGroup = useContactStore((state) => state.updateGroup);

  const modalRef = useRef<{
    destroy: () => void;
  } | null>(null);

  const syncGroupInfo = useCallback(
    (value: Partial<GroupItem>) => {
      if (!currentGroupInfo) return undefined;

      const nextGroupInfo = {
        ...currentGroupInfo,
        ...value,
      } as GroupItem;

      updateCurrentGroupInfo(nextGroupInfo);
      updateGroup(nextGroupInfo);

      if (
        currentConversation?.groupID === currentGroupInfo.groupID &&
        (value.groupName !== undefined || value.faceURL !== undefined)
      ) {
        void updateCurrentConversation({
          ...currentConversation,
          showName: value.groupName ?? currentConversation.showName,
          faceURL: value.faceURL ?? currentConversation.faceURL,
        });
      }

      return nextGroupInfo;
    },
    [
      currentConversation,
      currentGroupInfo,
      updateCurrentConversation,
      updateCurrentGroupInfo,
      updateGroup,
    ],
  );

  const updateGroupInfo = useCallback(
    async (value: Partial<GroupItem>) => {
      if (!currentGroupInfo) return;
      await IMSDK.setGroupInfo({
        ...value,
        groupID: currentGroupInfo.groupID,
      });

      return syncGroupInfo(value);
    },
    [currentGroupInfo, syncGroupInfo],
  );

  const tryDismissGroup = () => {
    if (!currentGroupInfo || modalRef.current) return;

    modalRef.current = modal.confirm({
      title: t("placeholder.disbandGroup"),
      content: (
        <div className="flex items-baseline">
          <div>{t("toast.confirmDisbandGroup")}</div>
          <span className="text-xs text-[var(--sub-text)]">
            {t("placeholder.disbandGroupToast")}
          </span>
        </div>
      ),
      onOk: async () => {
        try {
          await IMSDK.dismissGroup(currentGroupInfo.groupID);
          closeOverlay();
        } catch (error) {
          feedbackToast({ error });
        }
        modalRef.current = null;
      },
      onCancel: () => {
        modalRef.current = null;
      },
    });
  };

  const tryQuitGroup = () => {
    if (!currentGroupInfo || modalRef.current) return;

    modalRef.current = modal.confirm({
      title: t("placeholder.exitGroup"),
      content: (
        <div className="flex items-baseline">
          <div>{t("toast.confirmExitGroup")}</div>
          <span className="text-xs text-[var(--sub-text)]">
            {t("placeholder.exitGroupToast")}
          </span>
        </div>
      ),
      onOk: async () => {
        try {
          await IMSDK.quitGroup(currentGroupInfo.groupID);
          closeOverlay();
        } catch (error) {
          feedbackToast({ error });
        }
        modalRef.current = null;
      },
      onCancel: () => {
        modalRef.current = null;
      },
    });
  };

  return {
    currentGroupInfo,
    syncGroupInfo,
    updateGroupInfo,
    tryQuitGroup,
    tryDismissGroup,
  };
}
