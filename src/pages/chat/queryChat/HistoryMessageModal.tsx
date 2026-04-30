import { MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Button, DatePicker, Empty, Input, Modal, Select, Spin } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { t } from "i18next";
import { useEffect, useMemo, useState } from "react";

import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import { feedbackToast } from "@/utils/common";
import { formatMessageByType } from "@/utils/imCommon";

import { HistoryFilterType, isHistoryMessageMatched } from "./chatroom";
import MessageItemView from "./MessageItem";

const PAGE_SIZE = 100;
const PAGE_LIMIT = 3;
const SEARCH_LIMIT = PAGE_SIZE * PAGE_LIMIT;

const dedupeAndSortMessages = (messageList: MessageItem[]) =>
  Array.from(
    new Map(messageList.map((message) => [message.clientMsgID, message])).values(),
  ).sort((left, right) => left.sendTime - right.sendTime);

const normalizeSearchValue = (value?: string) => value?.trim().toLowerCase() ?? "";

const getMessageSearchText = (message: MessageItem) =>
  formatMessageByType(message).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const searchLoadedMessages = (messageList: MessageItem[], keyword: string) => {
  const normalizedKeyword = normalizeSearchValue(keyword);

  if (!normalizedKeyword) {
    return messageList;
  }

  return messageList.filter((message) =>
    normalizeSearchValue(getMessageSearchText(message)).includes(normalizedKeyword),
  );
};

const HistoryMessageModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const currentConversation = useConversationStore((state) => state.currentConversation);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [searchedMessages, setSearchedMessages] = useState<MessageItem[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedType, setSelectedType] = useState<HistoryFilterType>("all");
  const [keyword, setKeyword] = useState("");

  const messageTypeOptions: { label: string; value: HistoryFilterType }[] = [
    { label: t("history.allTypes"), value: "all" },
    { label: t("history.textType"), value: "text" },
    { label: t("history.imageType"), value: "image" },
    { label: t("history.voiceType"), value: "voice" },
    { label: t("history.videoType"), value: "video" },
    { label: t("history.fileType"), value: "file" },
    { label: t("history.locationType"), value: "location" },
  ];

  useEffect(() => {
    if (!open || !currentConversation?.conversationID) {
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      setHistoryLoading(true);
      try {
        let nextStartClientMsgID = "";
        let merged: MessageItem[] = [];

        for (let index = 0; index < PAGE_LIMIT; index += 1) {
          const { data } = await IMSDK.getAdvancedHistoryMessageList({
            count: PAGE_SIZE,
            startClientMsgID: nextStartClientMsgID,
            conversationID: currentConversation.conversationID,
          });

          if (!data.messageList.length) {
            break;
          }

          merged = [...data.messageList, ...merged];
          nextStartClientMsgID = data.messageList[0]?.clientMsgID ?? "";

          if (data.isEnd) {
            break;
          }
        }

        if (!cancelled) {
          setMessages(dedupeAndSortMessages(merged));
        }
      } catch (error) {
        if (!cancelled) {
          feedbackToast({ error, msg: t("toast.getHistoryMessageFailed") });
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadMessages();

    return () => {
      cancelled = true;
    };
  }, [currentConversation?.conversationID, open]);

  useEffect(() => {
    if (!open || !currentConversation?.conversationID) {
      return;
    }

    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      setSearchedMessages(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await IMSDK.searchLocalMessages({
          conversationID: currentConversation.conversationID,
          keywordList: [trimmedKeyword],
          pageIndex: 1,
          count: SEARCH_LIMIT,
        });

        const matchedMessages = dedupeAndSortMessages(
          [...(data.searchResultItems ?? []), ...(data.findResultItems ?? [])].flatMap(
            (item) => item.messageList ?? [],
          ),
        );

        if (!cancelled) {
          setSearchedMessages(matchedMessages);
        }
      } catch (error) {
        if (!cancelled) {
          setSearchedMessages(searchLoadedMessages(messages, trimmedKeyword));
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentConversation?.conversationID, keyword, messages, open]);

  const filteredMessages = useMemo(() => {
    const sourceMessages = keyword.trim() ? searchedMessages ?? [] : messages;

    return sourceMessages.filter((message) => {
      const typeMatched = isHistoryMessageMatched(message.contentType, selectedType);
      if (!typeMatched) {
        return false;
      }

      if (!selectedDate) {
        return true;
      }

      return dayjs(message.sendTime).isSame(selectedDate, "day");
    });
  }, [keyword, messages, searchedMessages, selectedDate, selectedType]);

  const resetFilters = () => {
    setSelectedDate(null);
    setSelectedType("all");
    setKeyword("");
    setSearchedMessages(null);
  };

  return (
    <Modal
      destroyOnClose
      footer={null}
      open={open}
      title={t("placeholder.messageHistory")}
      width={760}
      style={{ maxWidth: "88vw" }}
      onCancel={onClose}
      afterClose={resetFilters}
    >
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <Input
          allowClear
          className="min-w-[220px] flex-1 basis-[220px]"
          placeholder={t("history.searchContent")}
          spellCheck={false}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <DatePicker
          allowClear
          className="w-[180px]"
          placeholder={t("history.dateFilter")}
          value={selectedDate}
          onChange={(value) => setSelectedDate(value)}
        />
        <Select
          className="w-[160px]"
          options={messageTypeOptions}
          value={selectedType}
          onChange={(value) => setSelectedType(value)}
        />
        <Button onClick={resetFilters}>{t("history.resetFilters")}</Button>
        <div className="ml-auto text-xs text-[var(--sub-text)]">
          {t("history.currentCount", { count: filteredMessages.length })}
        </div>
      </div>

      <div className="h-[500px] overflow-y-auto rounded border border-[var(--gap-text)] bg-[#fafafa] py-2">
        {historyLoading || searchLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spin />
          </div>
        ) : filteredMessages.length === 0 ? (
          <Empty className="mt-20" description={t("history.empty")} />
        ) : (
          filteredMessages.map((message) => (
            <MessageItemView
              key={message.clientMsgID}
              conversationID={currentConversation?.conversationID}
              isSender={message.sendID === selfUserID}
              message={message}
            />
          ))
        )}
      </div>
    </Modal>
  );
};

export default HistoryMessageModal;
