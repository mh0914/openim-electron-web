import { LoadingOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { ConversationItem as ConversationItemType, MessageItem } from "@openim/wasm-client-sdk/lib/types/entity";
import { Empty, Input, Popover } from "antd";
import clsx from "clsx";
import { t } from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import add_friend from "@/assets/images/topSearchBar/add_friend.png";
import add_group from "@/assets/images/topSearchBar/add_group.png";
import create_group from "@/assets/images/topSearchBar/create_group.png";
import sync from "@/assets/images/common/sync.png";
import sync_error from "@/assets/images/common/sync_error.png";
import FlexibleSider from "@/components/FlexibleSider";
import { usePlatformOperators } from "@/hooks/usePlatformOperators";
import { useSmartCustomerServices } from "@/hooks/useSmartCustomerServices";
import { IMSDK } from "@/layout/MainContentWrap";
import { useConversationStore, useUserStore } from "@/store";
import { emit } from "@/utils/events";
import { getConversationContent } from "@/utils/imCommon";

import ConversationItemComp from "./ConversationItem";
import styles from "./index.module.scss";

const normalizeSearchValue = (value?: string) => value?.trim().toLowerCase() ?? "";
const isSingleConversation = (conversation: ConversationItemType) =>
  !conversation.groupID && Boolean(conversation.userID);
const getSingleConversationUserID = (conversation: ConversationItemType) =>
  isSingleConversation(conversation) ? conversation.userID : "";

const stripHtmlTags = (value?: string) =>
  value?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";

const getConversationPreview = (conversation: ConversationItemType) => {
  if (conversation.draftText) {
    return conversation.draftText;
  }

  if (!conversation.latestMsg) {
    return "";
  }

  try {
    const latestMsg = JSON.parse(conversation.latestMsg) as MessageItem;
    return stripHtmlTags(getConversationContent(latestMsg));
  } catch (error) {
    return "";
  }
};

const searchConversationMessages = async (
  keyword: string,
  conversationList: ConversationItemType[],
  shouldStop: () => boolean,
) => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword || conversationList.length === 0) {
    return [];
  }

  try {
    const { data } = await IMSDK.searchLocalMessages({
      conversationID: "",
      keywordList: [normalizedKeyword],
      pageIndex: 1,
      count: Math.max(conversationList.length, 100),
    });

    return Array.from(
      new Set((data.searchResultItems ?? []).map((item) => item.conversationID)),
    );
  } catch (error) {
    const matchedConversationIDs = new Set<string>();
    const batchSize = 20;

    for (let index = 0; index < conversationList.length; index += batchSize) {
      if (shouldStop()) {
        break;
      }

      const currentBatch = conversationList.slice(index, index + batchSize);
      const searchResult = await Promise.allSettled(
        currentBatch.map((conversation) =>
          IMSDK.searchLocalMessages({
            conversationID: conversation.conversationID,
            keywordList: [normalizedKeyword],
            pageIndex: 1,
            count: 1,
          }),
        ),
      );

      if (shouldStop()) {
        break;
      }

      searchResult.forEach((result, resultIndex) => {
        if (result.status !== "fulfilled") {
          return;
        }

        const matchedCount =
          result.value.data.totalCount || result.value.data.searchResultItems?.length || 0;

        if (matchedCount > 0) {
          matchedConversationIDs.add(currentBatch[resultIndex].conversationID);
        }
      });
    }

    return Array.from(matchedConversationIDs);
  }
};

const ConnectBar = () => {
  const userStore = useUserStore();
  const showLoading =
    userStore.syncState === "loading" || userStore.connectState === "loading";
  const showFailed =
    userStore.syncState === "failed" || userStore.connectState === "failed";

  const loadingTip =
    userStore.syncState === "loading" ? t("connect.syncing") : t("connect.connecting");

  const errorTip =
    userStore.syncState === "failed"
      ? t("connect.syncFailed")
      : t("connect.connectFailed");

  if (userStore.reinstall) {
    return null;
  }

  return (
    <>
      {showLoading && (
        <div className="flex h-6 items-center justify-center bg-[#0089FF] bg-opacity-10">
          <img
            src={sync}
            alt="sync"
            className={clsx("mr-1 h-3 w-3 ", styles.loading)}
          />
          <span className=" text-xs text-[#0089FF]">{loadingTip}</span>
        </div>
      )}
      {showFailed && (
        <div className="flex h-6 items-center justify-center bg-[#FF381F] bg-opacity-15">
          <img src={sync_error} alt="sync" className="mr-1 h-3 w-3" />
          <span className=" text-xs text-[#FF381F]">{errorTip}</span>
        </div>
      )}
    </>
  );
};

const ConversationHeader = ({
  keyword,
  setKeyword,
  searchingMessages,
}: {
  keyword: string;
  setKeyword: (value: string) => void;
  searchingMessages: boolean;
}) => {
  const [actionVisible, setActionVisible] = useState(false);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const selfOperatorUserSet = usePlatformOperators(selfUserID ? [selfUserID] : []);
  const canManageContacts =
    Boolean(selfUserID) && selfOperatorUserSet.has(selfUserID);
  const actionMenuList = [
    {
      idx: 0,
      title: t("placeholder.addFriends"),
      icon: add_friend,
      onClick: () => emit("OPEN_SEARCH_USER_OR_GROUP", false),
    },
    {
      idx: 1,
      title: t("placeholder.addGroup"),
      icon: add_group,
      onClick: () => emit("OPEN_SEARCH_USER_OR_GROUP", true),
    },
    {
      idx: 2,
      title: t("placeholder.createGroup"),
      icon: create_group,
      onClick: () => emit("OPEN_CHOOSE_MODAL", { type: "CRATE_GROUP" }),
    },
  ];

  return (
    <div className="mb-3 flex items-center gap-2 px-1 pt-1">
      <Input
        allowClear
        size="large"
        value={keyword}
        spellCheck={false}
        placeholder={t("placeholder.search")}
        className="rounded-xl border-0 bg-[#f5f6f8] shadow-none"
        prefix={<SearchOutlined className="text-[var(--sub-text)]" rev={undefined} />}
        suffix={
          searchingMessages ? (
            <LoadingOutlined className="text-[var(--sub-text)]" rev={undefined} />
          ) : null
        }
        onChange={(event) => setKeyword(event.target.value)}
      />
      {canManageContacts && (
        <Popover
          content={
            <div className="p-1">
              {actionMenuList.map((action) => (
                <div
                  className="flex cursor-pointer items-center rounded px-3 py-2 text-xs hover:bg-[var(--primary-active)]"
                  key={action.idx}
                  onClick={() => {
                    action.onClick();
                    setActionVisible(false);
                  }}
                >
                  <img width={20} src={action.icon} alt={action.title} />
                  <div className="ml-3">{action.title}</div>
                </div>
              ))}
            </div>
          }
          arrow={false}
          title={null}
          trigger="click"
          placement="bottomRight"
          open={actionVisible}
          onOpenChange={(visible) => setActionVisible(visible)}
        >
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9e2ee] bg-white text-[var(--sub-text)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <PlusOutlined rev={undefined} />
          </button>
        </Popover>
      )}
    </div>
  );
};

const ConversationSider = () => {
  const { conversationID } = useParams();
  const conversationList = useConversationStore((state) => state.conversationList);
  const getConversationListByReq = useConversationStore(
    (state) => state.getConversationListByReq,
  );
  const virtuoso = useRef<VirtuosoHandle>(null);
  const hasmore = useRef(true);
  const loading = useRef(false);
  const [keyword, setKeyword] = useState("");
  const [matchedConversationIDs, setMatchedConversationIDs] = useState<string[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const trimmedKeyword = keyword.trim();

  useEffect(() => {
    if (!trimmedKeyword) {
      setMatchedConversationIDs([]);
      setSearchingMessages(false);
      return;
    }

    let stopped = false;
    const timer = window.setTimeout(async () => {
      setSearchingMessages(true);
      const result = await searchConversationMessages(
        trimmedKeyword,
        conversationList,
        () => stopped,
      );

      if (stopped) {
        return;
      }

      setMatchedConversationIDs(result);
      setSearchingMessages(false);
    }, 250);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [trimmedKeyword, conversationList]);

  const filteredConversationList = useMemo(() => {
    if (!trimmedKeyword) {
      return conversationList;
    }

    const normalizedKeyword = normalizeSearchValue(trimmedKeyword);
    const matchedIDSet = new Set(matchedConversationIDs);

    return conversationList.filter((conversation) => {
      const nameMatched = normalizeSearchValue(conversation.showName).includes(
        normalizedKeyword,
      );
      const previewMatched = normalizeSearchValue(
        getConversationPreview(conversation),
      ).includes(normalizedKeyword);

      return (
        nameMatched ||
        previewMatched ||
        matchedIDSet.has(conversation.conversationID)
      );
    });
  }, [conversationList, matchedConversationIDs, trimmedKeyword]);
  const visibleSingleChatUserIDs = useMemo(
    () =>
      filteredConversationList
        .map(getSingleConversationUserID)
        .filter(Boolean),
    [filteredConversationList],
  );
  const operatorUserSet = usePlatformOperators(visibleSingleChatUserIDs);
  const smartCustomerServiceUserSet = useSmartCustomerServices(visibleSingleChatUserIDs);
  const renderedConversationList = useMemo(
    () =>
      filteredConversationList.map((conversation) => {
        const singleConversationUserID = getSingleConversationUserID(conversation);

        return {
          conversation,
          isPlatformOperator:
            Boolean(singleConversationUserID) &&
            operatorUserSet.has(singleConversationUserID),
          isSmartCustomerService:
            Boolean(singleConversationUserID) &&
            smartCustomerServiceUserSet.has(singleConversationUserID),
        };
      }),
    [filteredConversationList, operatorUserSet, smartCustomerServiceUserSet],
  );

  const endReached = async () => {
    if (!hasmore.current || loading.current || trimmedKeyword) return;
    loading.current = true;
    hasmore.current = await getConversationListByReq(true);
    loading.current = false;
  };

  return (
    <div>
      <ConnectBar />
      <FlexibleSider
        needHidden={Boolean(conversationID)}
        wrapClassName="left-2 right-2 top-1.5 flex flex-col"
      >
        <div className="flex h-full flex-col">
          <ConversationHeader
            keyword={keyword}
            setKeyword={setKeyword}
            searchingMessages={searchingMessages}
          />
          {renderedConversationList.length > 0 ? (
            <Virtuoso
              className="min-h-0 flex-1"
              data={renderedConversationList}
              ref={virtuoso}
              endReached={endReached}
              components={{
                Footer: () => <div className="h-4" />,
              }}
              computeItemKey={(_, item) =>
                `${item.conversation.conversationID}-${item.isPlatformOperator ? "operator" : "default"}-${item.isSmartCustomerService ? "smart" : "normal"}`
              }
              itemContent={(_, item) => (
                <ConversationItemComp
                  key={`${item.conversation.conversationID}-${item.isPlatformOperator ? "operator" : "default"}-${item.isSmartCustomerService ? "smart" : "normal"}`}
                  allowDelete
                  isActive={conversationID === item.conversation.conversationID}
                  conversation={item.conversation}
                  isPlatformOperator={item.isPlatformOperator}
                  isSmartCustomerService={item.isSmartCustomerService}
                />
              )}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-4">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={trimmedKeyword ? t("empty.noSearchResults") : null}
              />
            </div>
          )}
        </div>
      </FlexibleSider>
    </div>
  );
};

export default ConversationSider;
