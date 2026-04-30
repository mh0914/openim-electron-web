import { CloseOutlined } from "@ant-design/icons";
import { GroupItem, WSEvent } from "@openim/wasm-client-sdk/lib/types/entity";
import { Button, Input, InputRef } from "antd";
import { t } from "i18next";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useRef,
  useState,
} from "react";

import { message } from "@/AntdGlobalComp";
import { BusinessUserInfo, searchBusinessUserInfo } from "@/api/login";
import OIMAvatar from "@/components/OIMAvatar";
import DraggableModalWrap from "@/components/DraggableModalWrap";
import { OverlayVisibleHandle, useOverlayVisible } from "@/hooks/useOverlayVisible";
import { CardInfo } from "@/pages/common/UserCardModal";
import { useContactStore } from "@/store";
import { feedbackToast } from "@/utils/common";

import { IMSDK } from "../MainContentWrap";

interface ISearchUserOrGroupProps {
  isSearchGroup: boolean;
  openUserCardWithData: (data: CardInfo) => void;
  openGroupCardWithData: (data: GroupItem) => void;
}

const userSearchFields = [
  "userID",
  "phoneNumber",
  "nickname",
  "account",
  "email",
] as const;

const normalizeSearchValue = (value?: string) => value?.trim().toLowerCase() ?? "";

const getUserSearchScore = (
  user: BusinessUserInfo,
  normalizedKeyword: string,
) => {
  let bestScore = Number.MAX_SAFE_INTEGER;

  userSearchFields.forEach((field, index) => {
    const currentValue = normalizeSearchValue(user[field]);

    if (!currentValue) {
      return;
    }

    if (currentValue === normalizedKeyword) {
      bestScore = Math.min(bestScore, index);
      return;
    }

    if (currentValue.includes(normalizedKeyword)) {
      bestScore = Math.min(bestScore, userSearchFields.length + index);
    }
  });

  return bestScore;
};

const getSearchedUsers = (users: BusinessUserInfo[], keyword: string) => {
  const normalizedKeyword = normalizeSearchValue(keyword);

  if (!normalizedKeyword) {
    return [];
  }

  const userMap = new Map<
    string,
    {
      user: BusinessUserInfo;
      score: number;
    }
  >();

  users.forEach((user) => {
    const score = getUserSearchScore(user, normalizedKeyword);
    if (score === Number.MAX_SAFE_INTEGER || !user.userID) {
      return;
    }

    const previousUser = userMap.get(user.userID);
    if (!previousUser || score < previousUser.score) {
      userMap.set(user.userID, {
        user,
        score,
      });
    }
  });

  return Array.from(userMap.values())
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }

      return (left.user.nickname || left.user.userID).localeCompare(
        right.user.nickname || right.user.userID,
      );
    })
    .map((item) => item.user);
};

const getUserSecondaryText = (user: BusinessUserInfo) =>
  user.phoneNumber || user.email || user.account || "";

const SearchUserOrGroup: ForwardRefRenderFunction<
  OverlayVisibleHandle,
  ISearchUserOrGroupProps
> = ({ isSearchGroup, openUserCardWithData, openGroupCardWithData }, ref) => {
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [userResults, setUserResults] = useState<BusinessUserInfo[]>([]);
  const inputRef = useRef<InputRef>(null);
  const { isOverlayOpen, closeOverlay } = useOverlayVisible(ref);

  useEffect(() => {
    if (isOverlayOpen) {
      setTimeout(() => inputRef.current?.focus());
    }
  }, [isOverlayOpen]);

  const openUserResult = (user: BusinessUserInfo) => {
    const friendInfo = useContactStore
      .getState()
      .friendList.find((friend) => friend.userID === user.userID);

    openUserCardWithData({
      ...(friendInfo ?? {}),
      ...user,
    });
  };

  const searchData = async () => {
    const searchKeyword = keyword.trim();
    if (!searchKeyword) return;
    setLoading(true);
    if (isSearchGroup) {
      setUserResults([]);
      try {
        const { data } = await IMSDK.getSpecifiedGroupsInfo([searchKeyword]);
        const groupInfo = data[0];
        setLoading(false);
        if (!groupInfo) {
          message.warning(t("empty.noSearchResults"));
          return;
        }
        openGroupCardWithData(groupInfo);
      } catch (error) {
        setLoading(false);
        if ((error as WSEvent).errCode === 1004) {
          message.warning(t("empty.noSearchResults"));
          return;
        }
        feedbackToast({ error });
      }
    } else {
      try {
        const {
          data: { total, users },
        } = await searchBusinessUserInfo(searchKeyword);
        setLoading(false);
        const searchedUsers = getSearchedUsers(users, searchKeyword);
        if (!total || searchedUsers.length === 0) {
          setUserResults([]);
          message.warning(t("empty.noSearchResults"));
          return;
        }
        setUserResults(searchedUsers);
      } catch (error) {
        setLoading(false);
        if ((error as WSEvent).errCode === 1004) {
          setUserResults([]);
          message.warning(t("empty.noSearchResults"));
          return;
        }
        feedbackToast({ error });
      }
    }
  };

  return (
    <DraggableModalWrap
      title={null}
      footer={null}
      open={isOverlayOpen}
      closable={false}
      width={332}
      onCancel={closeOverlay}
      styles={{
        mask: {
          opacity: 0,
          transition: "none",
        },
      }}
      afterClose={() => {
        setKeyword("");
        setUserResults([]);
      }}
      ignoreClasses=".ignore-drag, .cursor-pointer"
      className="no-padding-modal"
      maskTransitionName=""
    >
      <div className="flex h-12 items-center justify-between bg-[var(--gap-text)] px-5.5">
        <div>
          {isSearchGroup ? t("placeholder.addGroup") : t("placeholder.addFriends")}
        </div>
        <CloseOutlined
          className="cursor-pointer text-[var(--sub-text)]"
          rev={undefined}
          onClick={closeOverlay}
        />
      </div>
      <div className="ignore-drag">
        <div className="border-b border-[var(--gap-text)] px-5.5 py-6">
          <Input.Search
            ref={inputRef}
            className="no-addon-search"
            placeholder={t("placeholder.pleaseEnter")}
            value={keyword}
            addonAfter={null}
            spellCheck={false}
            onChange={(e) => {
              const nextValue = e.target.value;
              setKeyword(nextValue);
              setUserResults([]);
            }}
            onSearch={searchData}
          />
        </div>
        {!isSearchGroup && userResults.length > 0 && (
          <div className="px-5.5 pb-4 pt-3">
            <div className="mb-2 text-xs text-[var(--sub-text)]">
              {t("placeholder.selectUser")}
            </div>
            <div className="max-h-60 overflow-y-auto">
              {userResults.map((user) => (
                <div
                  key={user.userID}
                  className="mb-1 flex cursor-pointer items-center rounded-lg px-2 py-2 hover:bg-[var(--primary-active)]"
                  onClick={() => openUserResult(user)}
                >
                  <OIMAvatar
                    size={40}
                    src={user.faceURL}
                    text={user.nickname || user.userID}
                  />
                  <div className="ml-3 min-w-0 flex-1">
                    <div
                      className="truncate text-sm font-medium"
                      title={user.nickname || user.userID}
                    >
                      {user.nickname || user.userID}
                    </div>
                    <div className="truncate text-xs text-[var(--sub-text)]" title={user.userID}>
                      {user.userID}
                    </div>
                    {!!getUserSecondaryText(user) && (
                      <div
                        className="truncate text-xs text-[var(--sub-text)]"
                        title={getUserSecondaryText(user)}
                      >
                        {getUserSecondaryText(user)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end px-5.5 py-2.5">
          <Button
            loading={loading}
            className="px-6"
            type="primary"
            disabled={!keyword}
            onClick={searchData}
          >
            {t("confirm")}
          </Button>
          <Button
            className="ml-3 border-0 bg-[var(--chat-bubble)] px-6"
            onClick={closeOverlay}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </DraggableModalWrap>
  );
};

export default memo(forwardRef(SearchUserOrGroup));
