import { AudioOutlined } from "@ant-design/icons";
import { FC, useEffect, useRef, useState } from "react";

import { secondsToMS } from "@/utils/common";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";
import { resolveMessageUrl } from "./messageResource";

const VoiceMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const soundElem = message.soundElem;
  const audioSrc = resolveMessageUrl(soundElem?.sourceUrl || soundElem?.soundPath);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      audio.currentTime = 0;
    };

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audioSrc]);

  if (!soundElem) {
    return <div className={styles.bubble}>[Voice]</div>;
  }

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    if (audio.paused) {
      await audio.play();
      return;
    }

    audio.pause();
  };

  return (
    <div
      className={`${styles.bubble} min-w-[180px] max-w-[260px] ${isPlaying ? "border border-[var(--primary)]" : ""}`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-transparent text-left"
        onClick={() => void togglePlayback()}
      >
        <AudioOutlined className={isPlaying ? "text-[var(--primary)]" : ""} />
        <span className="text-xs text-[var(--sub-text)]">
          {secondsToMS(soundElem.duration)}
        </span>
      </button>
      <audio hidden preload="metadata" ref={audioRef} src={audioSrc} />
    </div>
  );
};

export default VoiceMessageRender;
