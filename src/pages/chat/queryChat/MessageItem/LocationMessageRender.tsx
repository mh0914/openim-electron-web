import { EnvironmentOutlined } from "@ant-design/icons";
import { FC } from "react";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const LocationMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const locationElem = message.locationElem;

  if (!locationElem) {
    return <div className={styles.bubble}>[Location]</div>;
  }

  const { description, latitude, longitude } = locationElem;
  const locationName = encodeURIComponent(description || "Pinned Location");
  const mapUrl = `https://uri.amap.com/marker?position=${longitude},${latitude}&name=${locationName}&coordinate=gaode`;

  return (
    <a
      className={`${styles.bubble} block min-w-[220px] max-w-[320px] text-[inherit] no-underline`}
      href={mapUrl}
      rel="noreferrer"
      target="_blank"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-[var(--primary-active)] p-2 text-base text-[var(--primary)]">
          <EnvironmentOutlined />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--text)]">
            {description || `${latitude}, ${longitude}`}
          </div>
          <div className="mt-1 text-xs text-[var(--sub-text)]">
            {latitude.toFixed(6)}, {longitude.toFixed(6)}
          </div>
        </div>
      </div>
    </a>
  );
};

export default LocationMessageRender;
