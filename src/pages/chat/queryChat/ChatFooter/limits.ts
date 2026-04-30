import { t } from "i18next";

const BYTES_PER_MB = 1024 * 1024;

export const MAX_TEXT_MESSAGE_LENGTH = 1000;
export const MAX_IMAGE_MESSAGE_SIZE = 10 * BYTES_PER_MB;
export const MAX_VOICE_MESSAGE_DURATION = 60;
export const MAX_VIDEO_MESSAGE_SIZE = 50 * BYTES_PER_MB;
export const MAX_FILE_MESSAGE_SIZE = 50 * BYTES_PER_MB;

const formatSizeLabel = (size: number) => `${size / BYTES_PER_MB}MB`;

export const getTextMessageLength = (text: string) => Array.from(text).length;

export const ensureTextMessageWithinLimit = (text: string) => {
  if (getTextMessageLength(text) > MAX_TEXT_MESSAGE_LENGTH) {
    throw new Error(t("toast.textMessageTooLong", { max: MAX_TEXT_MESSAGE_LENGTH }));
  }
};

const ensureFileSizeWithinLimit = (file: File, maxSize: number, messageKey: string) => {
  if (file.size > maxSize) {
    throw new Error(t(messageKey, { maxSize: formatSizeLabel(maxSize) }));
  }
};

export const ensureImageMessageWithinLimit = (file: File) =>
  ensureFileSizeWithinLimit(file, MAX_IMAGE_MESSAGE_SIZE, "toast.imageMessageTooLarge");

export const ensureVoiceMessageWithinLimit = (duration: number) => {
  if (duration > MAX_VOICE_MESSAGE_DURATION) {
    throw new Error(
      t("toast.voiceMessageTooLong", { maxDuration: MAX_VOICE_MESSAGE_DURATION }),
    );
  }
};

export const ensureVideoMessageWithinLimit = (file: File) =>
  ensureFileSizeWithinLimit(file, MAX_VIDEO_MESSAGE_SIZE, "toast.videoMessageTooLarge");

export const ensureFileMessageWithinLimit = (file: File) =>
  ensureFileSizeWithinLimit(file, MAX_FILE_MESSAGE_SIZE, "toast.fileMessageTooLarge");
