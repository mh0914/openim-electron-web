import { MessageItem } from "@openim/wasm-client-sdk";
import { v4 as uuidV4 } from "uuid";

import { IMSDK } from "@/layout/MainContentWrap";

import {
  ensureFileMessageWithinLimit,
  ensureImageMessageWithinLimit,
  ensureVideoMessageWithinLimit,
  ensureVoiceMessageWithinLimit,
} from "../limits";

export interface FileWithPath extends File {
  path?: string;
  recorded?: boolean;
}

export interface LocationDraft {
  description: string;
  longitude: number;
  latitude: number;
}

type ImageInfo = {
  width: number;
  height: number;
};

type AudioInfo = {
  duration: number;
};

type VideoInfo = {
  duration: number;
  width: number;
  height: number;
  snapshotFile: File;
  snapshotUrl: string;
};

const getImageInfo = (file: File): Promise<ImageInfo> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
      URL.revokeObjectURL(url);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    img.src = url;
  });

const getAudioInfo = (file: File): Promise<AudioInfo> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");

    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration)
        ? Math.max(1, Math.round(audio.duration))
        : 1;
      resolve({ duration });
      URL.revokeObjectURL(url);
    };

    audio.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    audio.src = url;
  });

const canvasToFile = (
  canvas: HTMLCanvasElement,
  fileName: string,
  type = "image/png",
): Promise<File> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create snapshot blob."));
        return;
      }

      resolve(new File([blob], fileName, { type }));
    }, type);
  });

const getVideoInfo = (file: File): Promise<VideoInfo> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = async () => {
      try {
        const width = video.videoWidth || 320;
        const height = video.videoHeight || 180;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Failed to create snapshot canvas.");
        }

        context.drawImage(video, 0, 0, width, height);
        const snapshotFile = await canvasToFile(
          canvas,
          `${file.name.replace(/\.[^.]+$/, "") || "video"}-snapshot.png`,
        );
        const duration = Number.isFinite(video.duration)
          ? Math.max(1, Math.round(video.duration))
          : 1;

        resolve({
          duration,
          width,
          height,
          snapshotFile,
          snapshotUrl: URL.createObjectURL(snapshotFile),
        });
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    video.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    video.src = url;
  });

export function useFileMessage() {
  const getImageMessage = async (file: FileWithPath) => {
    ensureImageMessageWithinLimit(file);
    const { width, height } = await getImageInfo(file);
    const sourceUrl = URL.createObjectURL(file);
    const baseInfo = {
      uuid: uuidV4(),
      type: file.type,
      size: file.size,
      width,
      height,
      url: sourceUrl,
    };

    if (window.electronAPI && file.path) {
      const imageMessage = (await IMSDK.createImageMessageFromFullPath(file.path)).data;
      imageMessage.pictureElem!.sourcePicture.url = baseInfo.url;
      imageMessage.pictureElem!.sourcePicture.width = width;
      imageMessage.pictureElem!.sourcePicture.height = height;
      imageMessage.pictureElem!.sourcePicture.size = file.size;
      return imageMessage;
    }

    return (
      await IMSDK.createImageMessageByFile({
        sourcePicture: baseInfo,
        bigPicture: baseInfo,
        snapshotPicture: baseInfo,
        sourcePath: file.name,
        file,
      })
    ).data;
  };

  const getVoiceMessage = async (
    file: FileWithPath,
    fullPath?: string,
    durationOverride?: number,
  ) => {
    const fallbackAudioInfo = durationOverride ? undefined : await getAudioInfo(file);
    const duration = Math.max(1, durationOverride ?? fallbackAudioInfo?.duration ?? 1);
    ensureVoiceMessageWithinLimit(duration);
    const sourceUrl = URL.createObjectURL(file);

    if (window.electronAPI && fullPath) {
      const message = (
        await IMSDK.createSoundMessageFromFullPath({
          soundPath: fullPath,
          duration,
        })
      ).data;

      if (message.soundElem) {
        message.soundElem.sourceUrl = sourceUrl;
        message.soundElem.dataSize = file.size;
        message.soundElem.duration = duration;
      }

      return message;
    }

    return (
      await IMSDK.createSoundMessageByFile({
        uuid: uuidV4(),
        soundPath: file.name,
        sourceUrl,
        dataSize: file.size,
        duration,
        soundType: file.type,
        file,
      })
    ).data;
  };

  const getVideoMessage = async (file: FileWithPath) => {
    ensureVideoMessageWithinLimit(file);
    const { duration, width, height, snapshotFile, snapshotUrl } = await getVideoInfo(file);
    const videoUrl = URL.createObjectURL(file);

    if (window.electronAPI && file.path) {
      const snapshotPath = await window.electronAPI.saveFileToDisk({
        file: snapshotFile,
        sync: true,
      });

      const message = (
        await IMSDK.createVideoMessageFromFullPath({
          videoPath: file.path,
          videoType: file.type,
          duration,
          snapshotPath,
        })
      ).data;

      if (message.videoElem) {
        message.videoElem.videoUrl = videoUrl;
        message.videoElem.videoSize = file.size;
        message.videoElem.snapshotUrl = snapshotUrl;
        message.videoElem.snapshotSize = snapshotFile.size;
        message.videoElem.snapshotWidth = width;
        message.videoElem.snapshotHeight = height;
      }

      return message;
    }

    return (
      await IMSDK.createVideoMessageByFile({
        videoPath: file.name,
        duration,
        videoType: file.type,
        snapshotPath: snapshotFile.name,
        videoUUID: uuidV4(),
        videoUrl,
        videoSize: file.size,
        snapshotUUID: uuidV4(),
        snapshotSize: snapshotFile.size,
        snapshotUrl,
        snapshotWidth: width,
        snapshotHeight: height,
        snapShotType: snapshotFile.type,
        videoFile: file,
        snapshotFile,
      })
    ).data;
  };

  const getFileMessage = async (file: FileWithPath) => {
    ensureFileMessageWithinLimit(file);
    if (window.electronAPI && file.path) {
      const message = (
        await IMSDK.createFileMessageFromFullPath({
          filePath: file.path,
          fileName: file.name,
        })
      ).data;

      if (message.fileElem) {
        message.fileElem.fileSize = file.size;
      }

      return message;
    }

    return (
      await IMSDK.createFileMessageByFile({
        filePath: file.name,
        fileName: file.name,
        uuid: uuidV4(),
        sourceUrl: URL.createObjectURL(file),
        fileSize: file.size,
        fileType: file.type,
        file,
      })
    ).data;
  };

  const getLocationMessage = async (location: LocationDraft) =>
    (await IMSDK.createLocationMessage(location)).data;

  return {
    getImageMessage,
    getVoiceMessage,
    getVideoMessage,
    getFileMessage,
    getLocationMessage,
  };
}
