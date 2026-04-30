import {
  AudioOutlined,
  EnvironmentOutlined,
  FileOutlined,
  HistoryOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { MessageItem } from "@openim/wasm-client-sdk";
import { message as antdMessage, Tooltip, Upload } from "antd";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { memo, ReactNode, useEffect, useMemo, useRef, useState } from "react";

import image from "@/assets/images/chatFooter/image.png";

import { MAX_VOICE_MESSAGE_DURATION } from "../limits";
import { SendMessageParams } from "../useSendMessage";
import LocationPickerModal from "./LocationPickerModal";
import { FileWithPath, LocationDraft } from "./useFileMessage";

type UploadAction = {
  type: "upload";
  key: string;
  title: string;
  accept?: string;
  icon: ReactNode;
  createMessage: (file: FileWithPath) => Promise<MessageItem>;
};

type ClickAction = {
  type: "click";
  key: string;
  title: string;
  icon: ReactNode;
  onClick: () => void;
};

type Action = UploadAction | ClickAction;

const iconClassName =
  "text-[18px] text-[var(--sub-text)] transition-colors hover:text-[var(--primary)]";
const recordingIconClassName =
  "text-[18px] text-[#ff4d4f] transition-colors hover:text-[#ff4d4f]";
const recordingMessageKey = "recording-tip";
const recordingLimitMessageKey = "recording-limit-tip";

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

const SendActionBar = ({
  disabled,
  disabledReason,
  sendMessage,
  getFileMessage,
  getImageMessage,
  getLocationMessage,
  getVideoMessage,
  getVoiceMessage,
  historyDisabled,
  onOpenHistory,
}: {
  disabled?: boolean;
  disabledReason?: string;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  getImageMessage: (file: FileWithPath) => Promise<MessageItem>;
  getVoiceMessage: (
    file: FileWithPath,
    fullPath?: string,
    durationOverride?: number,
  ) => Promise<MessageItem>;
  getVideoMessage: (file: FileWithPath) => Promise<MessageItem>;
  getFileMessage: (file: FileWithPath) => Promise<MessageItem>;
  getLocationMessage: (location: LocationDraft) => Promise<MessageItem>;
  historyDisabled?: boolean;
  onOpenHistory?: () => void;
}) => {
  const { t } = useTranslation();
  const [locationOpen, setLocationOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(recordingTimeoutRef.current);
    recordingTimeoutRef.current = null;
  };

  const guardDisabled = () => {
    if (!disabled) {
      return false;
    }

    antdMessage.error(disabledReason || "当前无法发送消息");
    return true;
  };

  useEffect(
    () => () => {
      antdMessage.destroy(recordingMessageKey);
      antdMessage.destroy(recordingLimitMessageKey);
      clearRecordingTimeout();
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      recordingStreamRef.current = null;
      recordingStartedAtRef.current = null;
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

  const handleUpload = async (action: UploadAction, options: UploadRequestOption) => {
    if (guardDisabled()) {
      options.onError?.(new Error(disabledReason || "当前无法发送消息"));
      return;
    }

    try {
      const message = await action.createMessage(options.file as FileWithPath);
      await sendMessage({ message });
      options.onSuccess?.({}, options.file as File);
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : t("toast.uploadFailed"));
      options.onError?.(error as Error);
    }
  };

  const handleLocationSubmit = async (values: LocationDraft) => {
    if (guardDisabled()) {
      return;
    }

    try {
      const message = await getLocationMessage(values);
      await sendMessage({ message });
      setLocationOpen(false);
    } catch (error) {
      antdMessage.error(t("toast.accessFailed"));
      throw error;
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

      const message = await getVoiceMessage(file, savedPath, durationSeconds);
      await sendMessage({ message });
    } catch (error) {
      console.error("[voice] recorded voice send failed", {
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
    if (guardDisabled()) {
      return;
    }

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
    if (!isRecording && guardDisabled()) {
      return;
    }

    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

    await startRecording();
  };

  const actions = useMemo<Action[]>(
    () => [
      {
        type: "upload",
        title: t("placeholder.image"),
        icon: <img src={image} width={20} alt={t("placeholder.image")} />,
        key: "image",
        accept: "image/*",
        createMessage: getImageMessage,
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
        createMessage: getVideoMessage,
      },
      {
        type: "upload",
        title: t("placeholder.file"),
        icon: <FileOutlined className={iconClassName} />,
        key: "file",
        createMessage: getFileMessage,
      },
      {
        type: "click",
        title: t("placeholder.location"),
        icon: <EnvironmentOutlined className={iconClassName} />,
        key: "location",
        onClick: () => setLocationOpen(true),
      },
    ],
    [
      getFileMessage,
      getImageMessage,
      getLocationMessage,
      getVideoMessage,
      isRecording,
      t,
    ],
  );

  return (
    <>
      <div className="flex items-center justify-between px-4.5 pt-1.5">
        <div className="flex items-center">
          {actions.map((action) => {
            if (action.type === "upload") {
              return (
                <Upload
                  accept={action.accept}
                  className="mr-5 flex"
                  customRequest={(options) => handleUpload(action, options)}
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
        <Tooltip title="聊天消息历史">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--gap-text)] text-[18px] text-[var(--sub-text)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={historyDisabled}
            onClick={onOpenHistory}
          >
            <HistoryOutlined rev={undefined} />
          </button>
        </Tooltip>
      </div>
      {isRecording && (
        <div className="px-4.5 pb-0.5 text-xs text-[#ff4d4f]">
          {t("placeholder.recordingInProgress", {
            seconds: recordingSeconds,
          })}
        </div>
      )}

      <LocationPickerModal
        onCancel={() => setLocationOpen(false)}
        onSubmit={handleLocationSubmit}
        open={locationOpen}
      />
    </>
  );
};

export default memo(SendActionBar);

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
