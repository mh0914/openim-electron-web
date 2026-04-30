import {
  AudioOutlined,
  CloseCircleFilled,
  EnvironmentOutlined,
  FileOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { MessageItem } from "@openim/wasm-client-sdk";
import {
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Spin,
  Tooltip,
  Upload,
  message as antdMessage,
} from "antd";
import clsx from "clsx";
import i18n, { t } from "i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { ReactNode, UIEvent, useEffect, useMemo, useRef, useState } from "react";

import image from "@/assets/images/chatFooter/image.png";
import { BusinessUserInfo, searchBusinessUserInfo } from "@/api/login";
import CKEditor, { CKEditorRef } from "@/components/CKEditor";
import { getCleanText } from "@/components/CKEditor/utils";
import OIMAvatar from "@/components/OIMAvatar";
import { IMSDK } from "@/layout/MainContentWrap";
import {
  ensureFileMessageWithinLimit,
  ensureImageMessageWithinLimit,
  ensureTextMessageWithinLimit,
  ensureVideoMessageWithinLimit,
  ensureVoiceMessageWithinLimit,
  MAX_TEXT_MESSAGE_LENGTH,
  MAX_VOICE_MESSAGE_DURATION,
} from "@/pages/chat/queryChat/ChatFooter/limits";
import LocationPickerModal from "@/pages/chat/queryChat/ChatFooter/SendActionBar/LocationPickerModal";
import {
  FileWithPath,
  LocationDraft,
  useFileMessage,
} from "@/pages/chat/queryChat/ChatFooter/SendActionBar/useFileMessage";
import { useUserStore } from "@/store";
import { bytesToSize, feedbackToast, secondsToMS } from "@/utils/common";

const PAGE_SIZE = 100;
const SEND_CONCURRENCY = 10;
const LOAD_MORE_THRESHOLD = 120;
const recordingMessageKey = "broadcast-recording-tip";
const recordingLimitMessageKey = "broadcast-recording-limit-tip";

type BroadcastDraftType = "image" | "voice" | "video" | "file" | "location";

type BroadcastDraft = {
  id: string;
  type: BroadcastDraftType;
  title: string;
  description: string;
  createMessage: () => Promise<MessageItem>;
};

type UploadAction = {
  type: "upload";
  key: BroadcastDraftType;
  title: string;
  accept?: string;
  icon: ReactNode;
  createDraft: (file: FileWithPath) => Promise<BroadcastDraft>;
};

type ClickAction = {
  type: "click";
  key: "voice" | "location";
  title: string;
  icon: ReactNode;
  onClick: () => void;
};

type Action = UploadAction | ClickAction;

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
}

const mergeUsers = (prevUsers: BusinessUserInfo[], nextUsers: BusinessUserInfo[]) => {
  const userMap = new Map<string, BusinessUserInfo>();

  prevUsers.forEach((user) => {
    if (user.userID) {
      userMap.set(user.userID, user);
    }
  });

  nextUsers.forEach((user) => {
    if (user.userID) {
      userMap.set(user.userID, user);
    }
  });

  return Array.from(userMap.values());
};

const getSelectAllLabel = (selectAllUsers: boolean) =>
  (i18n.language || "en").startsWith("zh")
    ? selectAllUsers
      ? "\u53d6\u6d88\u5168\u9009"
      : "\u5168\u9009"
    : selectAllUsers
      ? "Unselect All"
      : "Select All";

const getAllSelectedHint = (count: number) =>
  (i18n.language || "en").startsWith("zh")
    ? `\u5df2\u5168\u9009 ${count} \u4eba`
    : `All ${count} user(s) selected`;

const getDraftListTitle = (count: number) =>
  (i18n.language || "en").startsWith("zh")
    ? `\u5df2\u6dfb\u52a0 ${count} \u6761\u5e7f\u64ad\u5185\u5bb9`
    : `${count} broadcast item(s) ready`;

const getEmptyBroadcastContentError = () =>
  (i18n.language || "en").startsWith("zh")
    ? "\u8bf7\u5148\u8f93\u5165\u6216\u9009\u62e9\u5e7f\u64ad\u5185\u5bb9"
    : "Please enter or choose broadcast content first";

const getDraftTypeLabel = (type: BroadcastDraftType) => {
  switch (type) {
    case "image":
      return t("placeholder.image");
    case "voice":
      return t("placeholder.voice");
    case "video":
      return t("placeholder.video");
    case "file":
      return t("placeholder.file");
    case "location":
      return t("placeholder.location");
    default:
      return "";
  }
};

const getRecordingMimeType = () => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];

  return candidates.find(
    (candidate) =>
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate),
  );
};

const getRecordingExtension = (mimeType: string) => {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
};

const getDraftId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const iconClassName =
  "text-[18px] text-[var(--sub-text)] transition-colors hover:text-[var(--primary)]";
const recordingIconClassName =
  "text-[18px] text-[#ff4d4f] transition-colors hover:text-[#ff4d4f]";

const BroadcastModal = ({ open, onClose }: BroadcastModalProps) => {
  const editorRef = useRef<CKEditorRef>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const listLoadingRef = useRef(false);
  const listLoadingMoreRef = useRef(false);
  const selfUserID = useUserStore((state) => state.selfInfo.userID);
  const {
    getFileMessage,
    getImageMessage,
    getLocationMessage,
    getVideoMessage,
    getVoiceMessage,
  } = useFileMessage();

  const [messageHtml, setMessageHtml] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectAllUsers, setSelectAllUsers] = useState(false);
  const [users, setUsers] = useState<BusinessUserInfo[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Record<string, BusinessUserInfo>>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [drafts, setDrafts] = useState<BroadcastDraft[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const selectedUserIDs = useMemo(() => Object.keys(selectedUsers), [selectedUsers]);
  const hasMore = users.length < total;

  useEffect(() => {
    listLoadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    listLoadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(recordingTimeoutRef.current);
    recordingTimeoutRef.current = null;
  };

  const abortRecording = () => {
    discardRecordingRef.current = true;
    clearRecordingTimeout();
    antdMessage.destroy(recordingMessageKey);
    antdMessage.destroy(recordingLimitMessageKey);

    const recorder = recorderRef.current;
    recorderRef.current = null;
    recordingStartedAtRef.current = null;
    recordingChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const resetState = () => {
    setMessageHtml("");
    setKeyword("");
    setSelectAllUsers(false);
    setUsers([]);
    setSelectedUsers({});
    setPageNumber(1);
    setTotal(0);
    setLoading(false);
    setLoadingMore(false);
    setSending(false);
    setLocationOpen(false);
    setDrafts([]);
    abortRecording();
  };

  const loadUsers = async ({
    nextKeyword = keyword,
    nextPageNumber = 1,
    append = false,
  }: {
    nextKeyword?: string;
    nextPageNumber?: number;
    append?: boolean;
  } = {}) => {
    if (append) {
      if (listLoadingMoreRef.current) {
        return;
      }
      listLoadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      if (listLoadingRef.current) {
        return;
      }
      listLoadingRef.current = true;
      setLoading(true);
    }

    try {
      const {
        data: { total: nextTotal, users: fetchedUsers },
      } = await searchBusinessUserInfo(nextKeyword, PAGE_SIZE, nextPageNumber);

      const normalizedUsers = fetchedUsers.filter((user) => user.userID && user.userID !== selfUserID);
      const shouldExcludeSelfFromTotal = nextKeyword
        ? fetchedUsers.some((user) => user.userID === selfUserID)
        : Boolean(selfUserID);

      setTotal(Math.max(0, nextTotal - (shouldExcludeSelfFromTotal ? 1 : 0)));
      setPageNumber(nextPageNumber);
      setUsers((prev) => (append ? mergeUsers(prev, normalizedUsers) : normalizedUsers));
    } catch (error) {
      feedbackToast({ error });
    } finally {
      if (append) {
        listLoadingMoreRef.current = false;
        setLoadingMore(false);
      } else {
        listLoadingRef.current = false;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadUsers({
      nextKeyword: "",
      nextPageNumber: 1,
      append: false,
    });

    const timer = window.setTimeout(() => {
      editorRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open, selfUserID]);

  useEffect(
    () => () => {
      abortRecording();
    },
    [],
  );

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }

    const timer = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  const handleSearch = async (value?: string) => {
    const nextKeyword = value ?? keyword;
    await loadUsers({
      nextKeyword: nextKeyword.trim(),
      nextPageNumber: 1,
      append: false,
    });
  };

  const toggleUserSelection = (user: BusinessUserInfo) => {
    setSelectedUsers((prev) => {
      const next = { ...prev };

      if (next[user.userID]) {
        delete next[user.userID];
      } else {
        next[user.userID] = user;
      }

      return next;
    });
  };

  const removeDraft = (draftID: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== draftID));
  };

  const appendDraft = async (createDraft: () => Promise<BroadcastDraft>) => {
    try {
      const nextDraft = await createDraft();
      setDrafts((prev) => [...prev, nextDraft]);
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : t("toast.uploadFailed"));
      throw error;
    }
  };

  const createImageDraft = async (file: FileWithPath): Promise<BroadcastDraft> => {
    ensureImageMessageWithinLimit(file);

    return {
      id: getDraftId(),
      type: "image",
      title: file.name,
      description: bytesToSize(file.size),
      createMessage: () => getImageMessage(file),
    };
  };

  const createVideoDraft = async (file: FileWithPath): Promise<BroadcastDraft> => {
    ensureVideoMessageWithinLimit(file);

    return {
      id: getDraftId(),
      type: "video",
      title: file.name,
      description: bytesToSize(file.size),
      createMessage: () => getVideoMessage(file),
    };
  };

  const createFileDraft = async (file: FileWithPath): Promise<BroadcastDraft> => {
    ensureFileMessageWithinLimit(file);

    return {
      id: getDraftId(),
      type: "file",
      title: file.name,
      description: bytesToSize(file.size),
      createMessage: () => getFileMessage(file),
    };
  };

  const createVoiceDraft = async (
    file: FileWithPath,
    savedPath?: string,
    durationSeconds?: number,
  ): Promise<BroadcastDraft> => {
    const duration = durationSeconds ?? 1;
    ensureVoiceMessageWithinLimit(duration);

    return {
      id: getDraftId(),
      type: "voice",
      title: file.name,
      description: `${secondsToMS(duration)} · ${bytesToSize(file.size)}`,
      createMessage: () => getVoiceMessage(file, savedPath, duration),
    };
  };

  const createLocationDraft = async (location: LocationDraft): Promise<BroadcastDraft> => ({
    id: getDraftId(),
    type: "location",
    title: location.description,
    description: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
    createMessage: () => getLocationMessage(location),
  });

  const handleUploadDraft = async (action: UploadAction, options: UploadRequestOption) => {
    try {
      await appendDraft(() => action.createDraft(options.file as FileWithPath));
      options.onSuccess?.({}, options.file as File);
    } catch (error) {
      options.onError?.(error as Error);
    }
  };

  const handleLocationSubmit = async (values: LocationDraft) => {
    await appendDraft(() => createLocationDraft(values));
    setLocationOpen(false);
  };

  const getAllRecipientUserIDs = async () => {
    let targetPageNumber = 1;
    let hasNextPage = true;
    const recipientIDs = new Set<string>();

    while (hasNextPage) {
      const {
        data: { users: fetchedUsers },
      } = await searchBusinessUserInfo("", PAGE_SIZE, targetPageNumber);

      const validUsers = fetchedUsers.filter((user) => user.userID && user.userID !== selfUserID);
      validUsers.forEach((user) => recipientIDs.add(user.userID));

      if (fetchedUsers.length < PAGE_SIZE) {
        hasNextPage = false;
      } else {
        targetPageNumber += 1;
      }
    }

    return Array.from(recipientIDs);
  };

  const sendBroadcastMessages = async (
    recipientUserIDs: string[],
    textContent: string,
    messageDrafts: BroadcastDraft[],
  ) => {
    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < recipientUserIDs.length; index += SEND_CONCURRENCY) {
      const currentChunk = recipientUserIDs.slice(index, index + SEND_CONCURRENCY);
      const results = await Promise.allSettled(
        currentChunk.map(async (recvID) => {
          if (textContent) {
            const { data: textMessage } = await IMSDK.createTextMessage(textContent);
            await IMSDK.sendMessage({
              recvID,
              groupID: "",
              message: textMessage,
            });
          }

          for (const draft of messageDrafts) {
            const message = await draft.createMessage();
            await IMSDK.sendMessage({
              recvID,
              groupID: "",
              message,
            });
          }
        }),
      );

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          successCount += 1;
        } else {
          failedCount += 1;
        }
      });
    }

    return {
      successCount,
      failedCount,
    };
  };

  const handleBroadcast = async () => {
    const cleanText = getCleanText(messageHtml);
    const hasTextContent = Boolean(cleanText);
    const hasDraftContent = drafts.length > 0;

    if (!hasTextContent && !hasDraftContent) {
      antdMessage.warning(getEmptyBroadcastContentError());
      return;
    }

    if (hasTextContent) {
      try {
        ensureTextMessageWithinLimit(cleanText);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : t("toast.textMessageTooLong", { max: MAX_TEXT_MESSAGE_LENGTH });
        antdMessage.warning(errorMessage);
        return;
      }
    }

    if (!selectAllUsers && selectedUserIDs.length === 0) {
      antdMessage.warning(t("toast.selectLeastOne"));
      return;
    }

    setSending(true);
    try {
      const recipientUserIDs = selectAllUsers ? await getAllRecipientUserIDs() : selectedUserIDs;

      if (recipientUserIDs.length === 0) {
        antdMessage.warning(t("broadcast.emptyRecipients"));
        return;
      }

      const { successCount, failedCount } = await sendBroadcastMessages(
        recipientUserIDs,
        cleanText,
        drafts,
      );

      if (failedCount === 0) {
        antdMessage.success(t("broadcast.sendSuccess", { count: successCount }));
      } else {
        antdMessage.warning(
          t("broadcast.sendPartialSuccess", {
            successCount,
            failedCount,
          }),
        );
      }

      onClose();
      resetState();
    } catch (error) {
      feedbackToast({ error });
    } finally {
      setSending(false);
    }
  };

  const handleRecordedVoiceStop = async () => {
    const recorder = recorderRef.current;
    const stream = recordingStreamRef.current;
    const startedAt = recordingStartedAtRef.current;
    recorderRef.current = null;
    recordingStreamRef.current = null;
    recordingStartedAtRef.current = null;
    clearRecordingTimeout();
    setIsRecording(false);
    antdMessage.destroy(recordingMessageKey);

    if (discardRecordingRef.current) {
      discardRecordingRef.current = false;
      recordingChunksRef.current = [];
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }

    if (!recorder) {
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }

    const blob = new Blob(recordingChunksRef.current, {
      type: recorder.mimeType || getRecordingMimeType() || "audio/webm",
    });
    recordingChunksRef.current = [];
    stream?.getTracks().forEach((track) => track.stop());

    if (!blob.size) {
      antdMessage.error(t("toast.recordingEmpty"));
      return;
    }

    const mimeType = blob.type || getRecordingMimeType() || "audio/webm";
    const extension = getRecordingExtension(mimeType);
    const durationSeconds = Math.max(
      1,
      Math.min(
        MAX_VOICE_MESSAGE_DURATION,
        Math.round(((Date.now() - (startedAt ?? Date.now())) / 1000) || 1),
      ),
    );
    const file = new File([blob], `voice-${Date.now()}.${extension}`, {
      type: mimeType,
    }) as FileWithPath;
    let savedPath: string | undefined;

    try {
      if (window.electronAPI) {
        savedPath = await window.electronAPI.saveFileToDisk({
          file,
          sync: true,
        });
      }

      file.recorded = true;
      await appendDraft(() => createVoiceDraft(file, savedPath, durationSeconds));
    } catch (error) {
      console.error("[broadcast] recorded voice draft create failed", {
        error,
        durationSeconds,
        fileName: file.name,
        filePath: savedPath,
        fileType: file.type,
        fileSize: file.size,
      });
      antdMessage.error(
        error instanceof Error ? error.message : t("toast.recordingSendFailed"),
      );
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      antdMessage.error(t("toast.recordNotSupported"));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      discardRecordingRef.current = false;
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        void handleRecordedVoiceStop();
      });

      recorder.start();
      clearRecordingTimeout();
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "inactive") {
          return;
        }

        antdMessage.open({
          key: recordingLimitMessageKey,
          type: "info",
          content: t("toast.recordingReachedLimit", {
            maxDuration: MAX_VOICE_MESSAGE_DURATION,
          }),
          duration: 2,
        });
        recorderRef.current?.stop();
      }, MAX_VOICE_MESSAGE_DURATION * 1000);
      recordingStartedAtRef.current = Date.now();
      setIsRecording(true);
      antdMessage.open({
        key: recordingMessageKey,
        type: "info",
        content: t("toast.recordingStarted"),
        duration: 1.5,
      });
    } catch (error) {
      antdMessage.error(t("toast.recordingStartFailed"));
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    await startRecording();
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (loading || loadingMore || !hasMore) {
      return;
    }

    const target = event.currentTarget;
    const remainHeight = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remainHeight > LOAD_MORE_THRESHOLD) {
      return;
    }

    void loadUsers({
      nextKeyword: keyword.trim(),
      nextPageNumber: pageNumber + 1,
      append: true,
    });
  };

  const actions = useMemo<Action[]>(
    () => [
      {
        type: "upload",
        title: t("placeholder.image"),
        icon: <img src={image} width={20} alt={t("placeholder.image")} />,
        key: "image",
        accept: "image/*",
        createDraft: createImageDraft,
      },
      {
        type: "click",
        title: isRecording ? t("placeholder.stopRecording") : t("placeholder.voice"),
        icon: (
          <AudioOutlined
            className={isRecording ? recordingIconClassName : iconClassName}
          />
        ),
        key: "voice",
        onClick: () => void toggleRecording(),
      },
      {
        type: "upload",
        title: t("placeholder.video"),
        icon: <VideoCameraOutlined className={iconClassName} />,
        key: "video",
        accept: "video/*",
        createDraft: createVideoDraft,
      },
      {
        type: "upload",
        title: t("placeholder.file"),
        icon: <FileOutlined className={iconClassName} />,
        key: "file",
        createDraft: createFileDraft,
      },
      {
        type: "click",
        title: t("placeholder.location"),
        icon: <EnvironmentOutlined className={iconClassName} />,
        key: "location",
        onClick: () => setLocationOpen(true),
      },
    ],
    [isRecording, t],
  );

  return (
    <>
      <Modal
        centered
        destroyOnClose={false}
        footer={null}
        onCancel={() => {
          onClose();
          resetState();
        }}
        open={open}
        title={t("broadcast.title")}
        width={1180}
        styles={{
          body: {
            maxHeight: "calc(100vh - 100px)",
            overflow: "hidden",
            paddingTop: 12,
          },
        }}
      >
        <div
          className="flex min-h-0 flex-col gap-4 overflow-hidden"
          style={{ height: "min(820px, calc(100vh - 160px))" }}
        >
          <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
            <div className="flex min-h-0 min-w-0 flex-[1.4] flex-col overflow-hidden rounded-xl border border-[var(--gap-text)] bg-white">
              <div className="shrink-0 border-b border-[var(--gap-text)] px-4 py-3">
                <div className="text-sm font-medium text-[var(--text)]">{t("broadcast.messageTitle")}</div>
              </div>

              {drafts.length > 0 && (
                <div className="shrink-0 border-b border-[var(--gap-text)] px-4 py-3">
                  <div className="mb-2 text-xs text-[var(--sub-text)]">
                    {getDraftListTitle(drafts.length)}
                  </div>
                  <div className="max-h-[180px] space-y-2 overflow-y-auto pr-1">
                    {drafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--gap-text)] bg-[var(--chat-hover)] px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded border border-[var(--primary)] px-1.5 py-0.5 text-[10px] text-[var(--primary)]">
                              {getDraftTypeLabel(draft.type)}
                            </span>
                            <span className="truncate text-sm font-medium text-[var(--text)]">
                              {draft.title}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs text-[var(--sub-text)]">
                            {draft.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="ml-3 flex h-6 w-6 items-center justify-center text-[var(--sub-text)] transition-colors hover:text-[#ff4d4f]"
                          onClick={() => removeDraft(draft.id)}
                        >
                          <CloseCircleFilled />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 overflow-hidden px-1 py-1">
                  <CKEditor
                    ref={editorRef}
                    onChange={setMessageHtml}
                    onEnter={handleBroadcast}
                    placeholder={t("broadcast.messagePlaceholder")}
                    value={messageHtml}
                  />
                </div>
                <div className="shrink-0 flex items-end justify-between border-t border-[var(--gap-text)] px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center">
                      {actions.map((action) => {
                        if (action.type === "upload") {
                          return (
                            <Upload
                              accept={action.accept}
                              className="mr-5 flex"
                              customRequest={(options) => handleUploadDraft(action, options)}
                              key={action.key}
                              multiple
                              showUploadList={false}
                            >
                              <Tooltip title={action.title}>
                                <ActionTrigger title={action.title}>{action.icon}</ActionTrigger>
                              </Tooltip>
                            </Upload>
                          );
                        }

                        return (
                          <Tooltip key={action.key} title={action.title}>
                            <ActionTrigger onClick={action.onClick} title={action.title}>
                              {action.icon}
                            </ActionTrigger>
                          </Tooltip>
                        );
                      })}
                    </div>
                    {isRecording && (
                      <div className="text-xs text-[#ff4d4f]">
                        {t("placeholder.recordingInProgress", {
                          seconds: recordingSeconds,
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => {
                        onClose();
                        resetState();
                      }}
                    >
                      {t("cancel")}
                    </Button>
                    <Button loading={sending} type="primary" onClick={handleBroadcast}>
                      {t("placeholder.send")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 w-[420px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--gap-text)] bg-white">
              <div className="shrink-0 border-b border-[var(--gap-text)] px-4 py-3">
                <div className="mb-3 text-sm font-medium text-[var(--text)]">
                  {t("broadcast.recipientTitle")}
                </div>
                <div className="flex items-center gap-2">
                  <Input.Search
                    allowClear
                    className="min-w-0 flex-1"
                    onChange={(event) => setKeyword(event.target.value)}
                    onSearch={handleSearch}
                    placeholder={t("broadcast.searchPlaceholder")}
                    value={keyword}
                  />
                  <Button
                    type={selectAllUsers ? "primary" : "default"}
                    onClick={() => setSelectAllUsers((prev) => !prev)}
                  >
                    {getSelectAllLabel(selectAllUsers)}
                  </Button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden">
                {loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                    <Spin />
                  </div>
                )}

                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                  <div className="shrink-0 flex items-center justify-between px-4 py-2 text-xs text-[var(--sub-text)]">
                    <span>
                      {t("broadcast.listSummary", {
                        shown: users.length,
                        total: total || users.length,
                      })}
                    </span>
                    {selectAllUsers ? (
                      <span>{getAllSelectedHint(total || users.length)}</span>
                    ) : (
                      <span>{t("broadcast.selectedUsersHint", { count: selectedUserIDs.length })}</span>
                    )}
                  </div>

                  <div
                    className="min-h-0 flex-1 overflow-y-scroll px-3 pb-3 pr-2"
                    onScroll={handleListScroll}
                    style={{
                      scrollbarGutter: "stable",
                      overscrollBehavior: "contain",
                    }}
                  >
                    {users.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <Empty
                          description={t("broadcast.emptyUsers")}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      </div>
                    ) : (
                      <>
                        {users.map((user) => {
                          const checked = selectAllUsers || Boolean(selectedUsers[user.userID]);
                          const disabled = selectAllUsers;

                          return (
                            <div
                              key={user.userID}
                              className={`mb-2 flex cursor-pointer items-center rounded-lg border px-3 py-1.5 transition-colors ${
                                checked
                                  ? "border-[var(--primary)] bg-[var(--primary-active)]"
                                  : "border-[var(--gap-text)] hover:bg-[var(--chat-hover)]"
                              } ${disabled ? "cursor-default opacity-70" : ""}`}
                              onClick={() => {
                                if (!disabled) {
                                  toggleUserSelection(user);
                                }
                              }}
                            >
                              <Checkbox
                                checked={checked}
                                className="mr-3"
                                disabled={disabled}
                                onClick={(event) => event.stopPropagation()}
                                onChange={() => toggleUserSelection(user)}
                              />
                              <OIMAvatar
                                size={34}
                                src={user.faceURL}
                                text={user.nickname || user.userID}
                              />
                              <div className="ml-3 min-w-0 flex-1">
                                <div className="truncate text-sm font-medium text-[var(--text)]">
                                  {user.nickname || user.userID}
                                </div>
                                <div className="truncate text-xs text-[var(--sub-text)]">
                                  {user.account || user.email || user.phoneNumber || user.userID}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {loadingMore && (
                          <div className="flex items-center justify-center py-2">
                            <Spin size="small" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <LocationPickerModal
        onCancel={() => setLocationOpen(false)}
        onSubmit={handleLocationSubmit}
        open={locationOpen}
      />
    </>
  );
};

export default BroadcastModal;

const ActionTrigger = ({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) => (
  <div
    className={clsx("mr-5 flex cursor-pointer items-center last:mr-0")}
    onClick={onClick}
    title={title}
  >
    {children}
  </div>
);
