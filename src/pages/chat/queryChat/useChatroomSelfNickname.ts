import { useEffect, useState } from "react";

import { useUserStore } from "@/store";

import {
  getChatroomSelfNickname,
  saveChatroomSelfNickname,
} from "./GroupSetting/groupProfileExtra";

export function useChatroomSelfNickname(groupID?: string) {
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadNickname = async () => {
      const value = await getChatroomSelfNickname(groupID, selfUserID);
      if (!cancelled) {
        setNickname(value);
      }
    };

    void loadNickname();

    return () => {
      cancelled = true;
    };
  }, [groupID, selfUserID]);

  const saveNickname = async (value: string) => {
    const nextValue = await saveChatroomSelfNickname(groupID, selfUserID, value);
    setNickname(nextValue);
    return nextValue;
  };

  return {
    selfNickname: nickname,
    saveSelfNickname: saveNickname,
  };
}
