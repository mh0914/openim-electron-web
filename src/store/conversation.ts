import {
  ConversationItem,
  GroupItem,
  GroupMemberItem,
  MessageItem,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { t } from "i18next";
import { create } from "zustand";

import { IMSDK } from "@/layout/MainContentWrap";
import { feedbackToast } from "@/utils/common";
import {
  conversationSort,
  getFilteredConversationUnreadCount,
  isGroupSession,
  sanitizeConversationSidebarReminder,
} from "@/utils/imCommon";

import { ConversationListUpdateType, ConversationStore } from "./type";
import { useUserStore } from "./user";

const CONVERSATION_SPLIT_COUNT = 500;

export const useConversationStore = create<ConversationStore>()((set, get) => ({
  conversationList: [],
  currentConversation: undefined,
  unReadCount: 0,
  currentGroupInfo: undefined,
  currentMemberInGroup: undefined,
  currentGroupMemberList: [],
  getConversationListByReq: async (isOffset?: boolean) => {
    let tmpConversationList = [] as ConversationItem[];
    try {
      const { data } = await IMSDK.getConversationListSplit({
        offset: isOffset ? get().conversationList.length : 0,
        count: CONVERSATION_SPLIT_COUNT,
      });
      tmpConversationList = data;
    } catch (error) {
      feedbackToast({ error, msg: t("toast.getConversationFailed") });
      return true;
    }
    const previousConversationList = get().conversationList;
    const nextConversationList = [
      ...(isOffset ? previousConversationList : []),
      ...tmpConversationList.map((conversation) =>
        sanitizeConversationSidebarReminder(
          conversation,
          previousConversationList.find(
            (item) => item.conversationID === conversation.conversationID,
          ),
        ),
      ),
    ];
    set(() => ({
      conversationList: nextConversationList,
      unReadCount: getFilteredConversationUnreadCount(nextConversationList),
    }));
    return tmpConversationList.length === CONVERSATION_SPLIT_COUNT;
  },
  updateConversationList: (
    list: ConversationItem[],
    type: ConversationListUpdateType,
  ) => {
    const currentConversationList = get().conversationList;
    const normalizedList = list.map((conversation) =>
      sanitizeConversationSidebarReminder(
        conversation,
        currentConversationList.find(
          (item) => item.conversationID === conversation.conversationID,
        ),
      ),
    );
    const idx = normalizedList.findIndex(
      (c) => c.conversationID === get().currentConversation?.conversationID,
    );
    if (idx > -1) get().updateCurrentConversation(normalizedList[idx]);

    if (type === "filter") {
      set((state) => {
        const nextConversationList = conversationSort(
          [...normalizedList, ...state.conversationList],
          state.conversationList,
        );
        return {
          conversationList: nextConversationList,
          unReadCount: getFilteredConversationUnreadCount(nextConversationList),
        };
      });
      return;
    }
    let filterArr: ConversationItem[] = [];
    const chids = normalizedList.map((ch) => ch.conversationID);
    filterArr = get().conversationList.filter(
      (tc) => !chids.includes(tc.conversationID),
    );

    const nextConversationList = conversationSort([...normalizedList, ...filterArr]);
    set(() => ({
      conversationList: nextConversationList,
      unReadCount: getFilteredConversationUnreadCount(nextConversationList),
    }));
  },
  removeConversation: (conversationID: string) => {
    set((state) => {
      const nextConversationList = state.conversationList.filter(
        (item) => item.conversationID !== conversationID,
      );
      return {
        conversationList: nextConversationList,
        unReadCount: getFilteredConversationUnreadCount(nextConversationList),
      };
    });
  },
  updateCurrentConversation: async (
    conversation?: ConversationItem,
    isJump?: boolean,
  ) => {
    if (!conversation) {
      set(() => ({
        currentConversation: undefined,
        quoteMessage: undefined,
        currentGroupInfo: undefined,
        currentMemberInGroup: undefined,
        currentGroupMemberList: [],
      }));
      return;
    }
    const prevConversation = get().currentConversation;

    const toggleNewConversation =
      conversation.conversationID !== prevConversation?.conversationID;
    if (toggleNewConversation && isGroupSession(conversation.conversationType)) {
      get().getCurrentGroupInfoByReq(conversation.groupID);
      await get().getCurrentMemberInGroupByReq(conversation.groupID);
      await get().getCurrentGroupMemberListByReq(conversation.groupID);
    }
    if (toggleNewConversation && !isGroupSession(conversation.conversationType)) {
      set(() => ({ currentGroupMemberList: [] }));
    }
    set(() => ({ currentConversation: { ...conversation } }));
  },
  getUnReadCountByReq: async () => {
    const count = getFilteredConversationUnreadCount(get().conversationList);
    set(() => ({ unReadCount: count }));
    return count;
  },
  updateUnReadCount: (count: number) => {
    set(() => ({ unReadCount: count }));
  },
  getCurrentGroupInfoByReq: async (groupID: string) => {
    let groupInfo: GroupItem;
    try {
      const { data } = await IMSDK.getSpecifiedGroupsInfo([groupID]);
      groupInfo = data[0];
    } catch (error) {
      feedbackToast({ error, msg: t("toast.getGroupInfoFailed") });
      return;
    }
    set(() => ({ currentGroupInfo: { ...groupInfo } }));
  },
  updateCurrentGroupInfo: (groupInfo: GroupItem) => {
    set(() => ({ currentGroupInfo: { ...groupInfo } }));
  },
  getCurrentMemberInGroupByReq: async (groupID: string) => {
    let memberInfo: GroupMemberItem;
    const selfID = useUserStore.getState().selfInfo.userID;
    try {
      const { data } = await IMSDK.getSpecifiedGroupMembersInfo({
        groupID,
        userIDList: [selfID],
      });
      memberInfo = data[0];
    } catch (error) {
      set(() => ({ currentMemberInGroup: undefined }));
      feedbackToast({ error, msg: t("toast.getGroupMemberFailed") });
      return;
    }
    set(() => ({ currentMemberInGroup: memberInfo ? { ...memberInfo } : undefined }));
  },
  setCurrentMemberInGroup: (memberInfo?: GroupMemberItem) => {
    set(() => ({ currentMemberInGroup: memberInfo }));
  },
  tryUpdateCurrentMemberInGroup: (member: GroupMemberItem) => {
    const currentMemberInGroup = get().currentMemberInGroup;
    if (
      member.groupID === currentMemberInGroup?.groupID &&
      member.userID === currentMemberInGroup?.userID
    ) {
      set(() => ({ currentMemberInGroup: { ...member } }));
    }
  },
  getCurrentGroupMemberListByReq: async (groupID: string) => {
    try {
      const { data } = await IMSDK.getGroupMemberList({
        groupID,
        offset: 0,
        count: 500,
        filter: 0,
      });
      set(() => ({ currentGroupMemberList: data ?? [] }));
    } catch (error) {
      feedbackToast({ error, msg: t("toast.getGroupMemberFailed") });
      set(() => ({ currentGroupMemberList: [] }));
    }
  },
  setCurrentGroupMemberList: (members: GroupMemberItem[]) => {
    set(() => ({ currentGroupMemberList: members }));
  },
  clearConversationStore: () => {
    set(() => ({
      conversationList: [],
      currentConversation: undefined,
      unReadCount: 0,
      currentGroupInfo: undefined,
      currentMemberInGroup: undefined,
      currentGroupMemberList: [],
      quoteMessage: undefined,
    }));
  },
}));
