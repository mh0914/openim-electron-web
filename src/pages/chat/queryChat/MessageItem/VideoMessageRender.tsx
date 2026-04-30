import { FC } from "react";

import { secondsToMS } from "@/utils/common";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";
import { resolveMessageUrl } from "./messageResource";

const VideoMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const videoElem = message.videoElem;
  const videoSrc = resolveMessageUrl(videoElem?.videoUrl || videoElem?.videoPath);
  const posterSrc = resolveMessageUrl(videoElem?.snapshotUrl || videoElem?.snapshotPath);

  if (!videoElem) {
    return <div className={styles.bubble}>[Video]</div>;
  }

  return (
    <div className={`${styles.bubble} max-w-[280px] p-2`}>
      <video
        className="max-h-[240px] w-full rounded-md bg-black"
        controls
        poster={posterSrc || undefined}
        preload="metadata"
        src={videoSrc}
      />
      <div className="mt-2 text-xs text-[var(--sub-text)]">
        {secondsToMS(videoElem.duration)}
      </div>
    </div>
  );
};

export default VideoMessageRender;
