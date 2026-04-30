import { CbEvents, MessageType } from "@openim/wasm-client-sdk";
import {
  GroupItem,
  MessageItem,
  RtcInvite,
  WSEvent,
} from "@openim/wasm-client-sdk/lib/types/entity";
import { useCallback, useEffect, useRef, useState } from "react";

import { getBusinessUserInfo } from "@/api/login";
import { CustomType } from "@/constants";
import { OverlayVisibleHandle } from "@/hooks/useOverlayVisible";
import ChooseModal, { ChooseModalState } from "@/pages/common/ChooseModal";
import GroupCardModal from "@/pages/common/GroupCardModal";
import RtcCallModal from "@/pages/common/RtcCallModal";
import { InviteData } from "@/pages/common/RtcCallModal/data";
import UserCardModal, { CardInfo } from "@/pages/common/UserCardModal";
import { useContactStore, useUserStore } from "@/store";
import emitter, { OpenUserCardParams } from "@/utils/events";

import { IMSDK } from "../MainContentWrap";
import SearchUserOrGroup from "./SearchUserOrGroup";

type UserCardState = OpenUserCardParams & {
  cardInfo?: CardInfo;
};

const TopSearchBar = () => {
  const userCardRef = useRef<OverlayVisibleHandle>(null);
  const groupCardRef = useRef<OverlayVisibleHandle>(null);
  const chooseModalRef = useRef<OverlayVisibleHandle>(null);
  const searchModalRef = useRef<OverlayVisibleHandle>(null);
  const rtcRef = useRef<OverlayVisibleHandle>(null);
  const [chooseModalState, setChooseModalState] = useState<ChooseModalState>({
    type: "CRATE_GROUP",
  });
  const [userCardState, setUserCardState] = useState<UserCardState>();
  const [groupCardData, setGroupCardData] = useState<
    GroupItem & { inGroup?: boolean }
  >();
  const [isSearchGroup, setIsSearchGroup] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData>({} as InviteData);

  useEffect(() => {
    const userCardHandler = (params: OpenUserCardParams) => {
      setUserCardState({ ...params });
      userCardRef.current?.openOverlay();
    };
    const chooseModalHandler = (params: ChooseModalState) => {
      setChooseModalState({ ...params });
      chooseModalRef.current?.openOverlay();
    };
    const searchModalHandler = (searchGroup: boolean) => {
      setIsSearchGroup(searchGroup);
      searchModalRef.current?.openOverlay();
    };
    const callRtcHandler = (inviteData: InviteData) => {
      if (rtcRef.current?.isOverlayOpen) return;
      setInviteData(inviteData);
      rtcRef.current?.openOverlay();
    };
    const newMessageHandler = ({ data }: WSEvent<MessageItem[]>) => {
      if (rtcRef.current?.isOverlayOpen) return;
      let rtcInvite = undefined as undefined | RtcInvite;
      data.map((message) => {
        if (message.contentType === MessageType.CustomMessage) {
          const customData = JSON.parse(message.customElem!.data);
          if (customData.customType === CustomType.CallingInvite) {
            rtcInvite = customData.data;
          }
        }
      });
      if (rtcInvite) {
        getBusinessUserInfo([rtcInvite.inviterUserID]).then(({ data: { users } }) => {
          if (users.length === 0) return;
          setInviteData({
            invitation: rtcInvite,
            participant: {
              userInfo: {
                nickname: users[0].nickname,
                faceURL: users[0].faceURL,
                userID: users[0].userID,
                ex: "",
              },
            },
          });
          rtcRef.current?.openOverlay();
        });
      }
    };

    emitter.on("OPEN_USER_CARD", userCardHandler);
    emitter.on("OPEN_GROUP_CARD", openGroupCardWithData);
    emitter.on("OPEN_CHOOSE_MODAL", chooseModalHandler);
    emitter.on("OPEN_SEARCH_USER_OR_GROUP", searchModalHandler);
    emitter.on("OPEN_RTC_MODAL", callRtcHandler);
    IMSDK.on(CbEvents.OnRecvNewMessages, newMessageHandler);
    return () => {
      emitter.off("OPEN_USER_CARD", userCardHandler);
      emitter.off("OPEN_GROUP_CARD", openGroupCardWithData);
      emitter.off("OPEN_CHOOSE_MODAL", chooseModalHandler);
      emitter.off("OPEN_SEARCH_USER_OR_GROUP", searchModalHandler);
      emitter.off("OPEN_RTC_MODAL", callRtcHandler);
      IMSDK.off(CbEvents.OnRecvNewMessages, newMessageHandler);
    };
  }, []);

  const openUserCardWithData = useCallback((cardInfo: CardInfo) => {
    searchModalRef.current?.closeOverlay();
    setUserCardState({
      userID: cardInfo.userID,
      cardInfo,
      isSelf: cardInfo.userID === useUserStore.getState().selfInfo.userID,
    });
    userCardRef.current?.openOverlay();
  }, []);

  const openGroupCardWithData = useCallback((group: GroupItem) => {
    searchModalRef.current?.closeOverlay();
    const inGroup = useContactStore
      .getState()
      .groupList.some((g) => g.groupID === group.groupID);
    setGroupCardData({ ...group, inGroup });
    groupCardRef.current?.openOverlay();
  }, []);

  return (
    <>
      <UserCardModal ref={userCardRef} {...userCardState} />
      <GroupCardModal ref={groupCardRef} groupData={groupCardData} />
      <ChooseModal ref={chooseModalRef} state={chooseModalState} />
      <SearchUserOrGroup
        ref={searchModalRef}
        isSearchGroup={isSearchGroup}
        openUserCardWithData={openUserCardWithData}
        openGroupCardWithData={openGroupCardWithData}
      />
      <RtcCallModal ref={rtcRef} inviteData={inviteData} />
    </>
  );
};

export default TopSearchBar;
