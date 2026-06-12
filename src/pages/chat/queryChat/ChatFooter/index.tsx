import { useLatest } from "ahooks";
import { Button } from "antd";
import { AtUsersInfoItem, GroupMemberItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import CKEditor, {
  CKEditorRef,
  MentionFeedItem,
  MentionSelection,
} from "@/components/CKEditor";
import { getCleanText } from "@/components/CKEditor/utils";
import { useCurrentMemberRole } from "@/hooks/useCurrentMemberRole";
import i18n from "@/i18n";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import emitter, { InsertMentionParams } from "@/utils/events";

import SendActionBar from "./SendActionBar";
import { ensureTextMessageWithinLimit, MAX_TEXT_MESSAGE_LENGTH } from "./limits";
import { useFileMessage } from "./SendActionBar/useFileMessage";
import {
  canEditChatroomProfile,
  getChatroomSpeakBlockedReason,
  isChatroomAllMuted,
  isChatroomSpeakBlocked,
  normalizeMuteEndTime,
} from "../chatroom";
import {
  formatMuteRemainDuration,
  getChatroomVisitorIdentity,
  getChatroomMuteRemainSeconds,
  isChatroomClosed,
  isChatroomTemporaryMuted,
  parseGroupProfileExtra,
} from "../GroupSetting/groupProfileExtra";
import HistoryMessageModal from "../HistoryMessageModal";
import { useSendMessage } from "./useSendMessage";

const sendActions = [
  { label: t("placeholder.sendWithEnter"), key: "enter" },
  { label: t("placeholder.sendWithShiftEnter"), key: "enterwithshift" },
];

i18n.on("languageChanged", () => {
  sendActions[0].label = t("placeholder.sendWithEnter");
  sendActions[1].label = t("placeholder.sendWithShiftEnter");
});

const AT_ALL_USER_ID = "AtAllTag";
const getAtAllDisplayName = () =>
  (i18n.language || "zh-CN").startsWith("zh") ? "\u5168\u4f53\u6210\u5458" : i18n.t("placeholder.mentionAll");

const getMentionDisplayName = (member: GroupMemberItem) =>
  member.nickname?.trim() || member.userID;

const ChatFooter: ForwardRefRenderFunction<unknown, unknown> = (_, ref) => {
  const editorRef = useRef<CKEditorRef>(null);
  const mentionRetryGroupIDRef = useRef("");
  const [html, setHtml] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mentions, setMentions] = useState<MentionSelection[]>([]);
  const [, setMuteTick] = useState(Date.now());
  const latestHtml = useLatest(html);
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const currentGroupInfo = useConversationStore((state) => state.currentGroupInfo);
  const currentGroupMemberList = useConversationStore((state) => state.currentGroupMemberList);
  const getCurrentGroupMemberListByReq = useConversationStore(
    (state) => state.getCurrentGroupMemberListByReq,
  );
  const setCurrentGroupMemberList = useConversationStore(
    (state) => state.setCurrentGroupMemberList,
  );
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const { currentIsMuted, currentMemberInGroup, currentRolevel } = useCurrentMemberRole();

  const {
    getFileMessage,
    getImageMessage,
    getLocationMessage,
    getVideoMessage,
    getVoiceMessage,
  } = useFileMessage();
  const { sendMessage } = useSendMessage();
  const profileExtra = useMemo(
    () => parseGroupProfileExtra(currentGroupInfo?.ex),
    [currentGroupInfo?.ex],
  );
  const chatroomClosed = isChatroomClosed(profileExtra);
  const temporaryMuted = isChatroomTemporaryMuted(profileExtra);
  const temporaryMuteRemainSeconds = getChatroomMuteRemainSeconds(profileExtra);
  const allMuted = isChatroomAllMuted(currentGroupInfo?.status);
  const isBlacklisted = Boolean(
    profileExtra.blacklistedMembers?.some((member) => member.userID === selfUserID),
  );
  const visitorIdentity = getChatroomVisitorIdentity(
    profileExtra,
    selfUserID,
    currentMemberInGroup?.ex,
  );
  const isVisitor = Boolean(visitorIdentity);
  const currentMuteEndTime = normalizeMuteEndTime(currentMemberInGroup?.muteEndTime);

  useEffect(() => {
    setMentions([]);
    mentionRetryGroupIDRef.current = "";

    if (currentConversation?.groupID) {
      void getCurrentGroupMemberListByReq(currentConversation.groupID);
      return;
    }

    setCurrentGroupMemberList([]);
  }, [
    currentConversation?.conversationID,
    currentConversation?.groupID,
    getCurrentGroupMemberListByReq,
    setCurrentGroupMemberList,
  ]);

  useEffect(() => {
    if (!currentConversation?.groupID) {
      mentionRetryGroupIDRef.current = "";
      return;
    }

    if (currentGroupMemberList.length > 0) {
      return;
    }

    if (mentionRetryGroupIDRef.current === currentConversation.groupID) {
      return;
    }

    mentionRetryGroupIDRef.current = currentConversation.groupID;
    const timer = window.setTimeout(() => {
      void getCurrentGroupMemberListByReq(currentConversation.groupID!);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    currentConversation?.groupID,
    currentGroupMemberList.length,
    getCurrentGroupMemberListByReq,
  ]);

  useEffect(() => {
    if (!temporaryMuted && currentMuteEndTime <= Date.now()) {
      return;
    }

    const timer = window.setInterval(() => {
      setMuteTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentMuteEndTime, temporaryMuted]);
  const blockedReason = getChatroomSpeakBlockedReason({
    currentRoleLevel: currentRolevel,
    currentMuteEndTime: currentMemberInGroup?.muteEndTime,
    groupStatus: currentGroupInfo?.status,
    profileExtra,
    isBlacklisted,
    isVisitor,
  });
  const messageBlocked = Boolean(
    currentConversation?.groupID &&
      isChatroomSpeakBlocked({
        currentRoleLevel: currentRolevel,
        currentMuteEndTime: currentMemberInGroup?.muteEndTime,
        groupStatus: currentGroupInfo?.status,
        profileExtra,
        isBlacklisted,
        isVisitor,
      }),
  );
  const chatroomMuteStatusText = chatroomClosed
    ? "\u7fa4\u804a\u5df2\u5173\u95ed\uff0c\u6240\u6709\u4eba\u6682\u65f6\u65e0\u6cd5\u53d1\u8a00"
    : allMuted
      ? "聊天室当前处于全员禁言状态，仅创建者和管理员可发言"
      : temporaryMuted
        ? `聊天室当前处于临时禁言状态，剩余 ${formatMuteRemainDuration(temporaryMuteRemainSeconds)}，仅创建者和管理员可发言`
        : "";
  const hideBlockedReasonWhenStatusShown =
    Boolean(chatroomMuteStatusText) &&
    (chatroomClosed ||
      (!isBlacklisted &&
        !currentIsMuted &&
        !isVisitor &&
        !canEditChatroomProfile(currentRolevel)));

  const guardedSendMessage = useCallback(
    async (params: Parameters<typeof sendMessage>[0]) => {
      if (messageBlocked) {
        const reason =
          blockedReason ||
          "\u7fa4\u804a\u5df2\u5173\u95ed\uff0c\u6682\u65f6\u65e0\u6cd5\u53d1\u9001\u6d88\u606f";
        feedbackToast({ msg: reason, error: reason });
        throw new Error(reason);
      }

      await sendMessage(params);
    },
    [blockedReason, messageBlocked, sendMessage],
  );

  const onChange = (value: string) => {
    if (messageBlocked) {
      return;
    }
    setHtml(value);
  };

  const mentionItems = useMemo<MentionFeedItem[]>(() => {
    if (!currentConversation?.groupID) {
      return [];
    }

    const memberItems = currentGroupMemberList.map((member) => {
      const displayName = getMentionDisplayName(member);

      return {
        id: `@${displayName}`,
        text: `@${displayName}`,
        userId: member.userID,
        displayName,
      };
    });

    return [
      {
        id: `@${getAtAllDisplayName()}`,
        text: `@${getAtAllDisplayName()}`,
        userId: AT_ALL_USER_ID,
        displayName: getAtAllDisplayName(),
        isAll: true,
      },
      ...memberItems,
    ];
  }, [currentConversation?.groupID, currentGroupMemberList]);

  useEffect(() => {
    const handleInsertMention = ({ userID, displayName, isAll }: InsertMentionParams) => {
      if (!currentConversation?.groupID || messageBlocked) {
        return;
      }

      const mention =
        mentionItems.find((item) => item.userId === userID) ??
        ({
          id: `@${displayName}`,
          text: `@${displayName}`,
          userId: userID,
          displayName,
          isAll,
        } satisfies MentionFeedItem);

      editorRef.current?.insertText(`${mention.text} `);
      setMentions((prev) => {
        if (prev.some((item) => item.userId === mention.userId)) {
          return prev;
        }

        return [
          ...prev,
          {
            id: mention.id,
            text: mention.text,
            userId: mention.userId,
            displayName: mention.displayName,
            isAll: mention.isAll,
          },
        ];
      });
    };

    emitter.on("INSERT_MENTION", handleInsertMention);
    return () => {
      emitter.off("INSERT_MENTION", handleInsertMention);
    };
  }, [currentConversation?.groupID, mentionItems, messageBlocked]);

  const buildAtPayload = (selectedMentions: MentionSelection[]) => {
    const hasAtAll = selectedMentions.some((item) => item.userId === AT_ALL_USER_ID);
    const normalizedMentions = hasAtAll
      ? selectedMentions.filter((item) => item.userId === AT_ALL_USER_ID)
      : selectedMentions.filter((item) => item.userId !== AT_ALL_USER_ID);
    const uniqueMentions = normalizedMentions.filter(
      (item, index, array) =>
        array.findIndex((target) => target.userId === item.userId) === index,
    );

    return {
      atUserIDList: uniqueMentions.map((item) => item.userId),
      atUsersInfo: uniqueMentions.map<AtUsersInfoItem>((item) => ({
        atUserID: item.userId,
        groupNickname: item.displayName,
      })),
    };
  };

  const enterToSend = async () => {
    if (messageBlocked) {
      feedbackToast({ msg: blockedReason, error: blockedReason });
      return;
    }
    const cleanText = getCleanText(latestHtml.current);
    if (!cleanText) return;
    try {
      ensureTextMessageWithinLimit(cleanText);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t("toast.textMessageTooLong", { max: MAX_TEXT_MESSAGE_LENGTH });
      feedbackToast({ msg: errorMessage, error: errorMessage });
      return;
    }
    const mentionPayload =
      currentConversation?.groupID && mentions.length > 0
        ? buildAtPayload(mentions)
        : undefined;
    const message = mentionPayload
      ? (
        await IMSDK.createTextAtMessage({
          text: cleanText,
          atUserIDList: mentionPayload.atUserIDList,
          atUsersInfo: mentionPayload.atUsersInfo,
        })
      ).data
      : (await IMSDK.createTextMessage(cleanText)).data;

    setHtml("");
    setMentions([]);

    await guardedSendMessage({ message });
  };

  return (
    <footer className="relative h-full min-h-0 bg-white">
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-t-[var(--gap-text)]">
        <SendActionBar
          disabled={messageBlocked}
          disabledReason={blockedReason}
          sendMessage={guardedSendMessage}
          getFileMessage={getFileMessage}
          getImageMessage={getImageMessage}
          getLocationMessage={getLocationMessage}
          getVideoMessage={getVideoMessage}
          getVoiceMessage={getVoiceMessage}
          historyDisabled={!currentConversation?.conversationID}
          onOpenHistory={() => setHistoryOpen(true)}
        />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {chatroomMuteStatusText && (
            <div className="shrink-0 px-4.5 pt-2 text-xs text-[#fa8c16]">
              {chatroomMuteStatusText}
            </div>
          )}
          {messageBlocked && !hideBlockedReasonWhenStatusShown && (
            <div className="shrink-0 px-4.5 pt-2 text-xs text-[#ff4d4f]">{blockedReason}</div>
          )}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <CKEditor
              ref={editorRef}
              mentionItems={mentionItems}
              onChange={onChange}
              onEnter={enterToSend}
              onMentionChange={setMentions}
              disabled={messageBlocked}
              value={html}
            />
          </div>
          <div className="shrink-0 flex items-center justify-end gap-2 pb-2 pt-1.5 pr-3">
            <Button
              className="w-fit px-6 py-1"
              disabled={messageBlocked}
              type="primary"
              onClick={enterToSend}
            >
              {t("placeholder.send")}
            </Button>
          </div>
        </div>
      </div>
      <HistoryMessageModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </footer>
  );
};

export default memo(forwardRef(ChatFooter));

