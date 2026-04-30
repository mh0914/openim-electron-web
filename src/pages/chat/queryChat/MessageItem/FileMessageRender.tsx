import { DownloadOutlined, FileOutlined } from "@ant-design/icons";
import { FC } from "react";

import { bytesToSize } from "@/utils/common";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";
import { resolveMessageUrl } from "./messageResource";

const FileMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const fileElem = message.fileElem;
  const fileUrl = resolveMessageUrl(fileElem?.sourceUrl || fileElem?.filePath);

  if (!fileElem) {
    return <div className={styles.bubble}>[File]</div>;
  }

  return (
    <div className={`${styles.bubble} min-w-[220px] max-w-[320px]`}>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-[var(--primary-active)] p-2 text-base text-[var(--primary)]">
          <FileOutlined />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-[var(--text)]">
            {fileElem.fileName}
          </div>
          <div className="mt-1 text-xs text-[var(--sub-text)]">
            {bytesToSize(fileElem.fileSize)}
          </div>
        </div>
        {fileUrl && (
          <a
            className="text-[var(--primary)]"
            download={fileElem.fileName}
            href={fileUrl}
            rel="noreferrer"
            target="_blank"
          >
            <DownloadOutlined />
          </a>
        )}
      </div>
    </div>
  );
};

export default FileMessageRender;
