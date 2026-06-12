import {
  FileTextOutlined,
  DownloadOutlined,
  FileOutlined,
  PictureOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Image, Modal } from "antd";
import { FC, useState } from "react";

import { bytesToSize } from "@/utils/common";
import { parseRichCustomMessagePayload } from "@/utils/customMessage";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";
import { resolveMessageUrl } from "./messageResource";

const CustomMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const [open, setOpen] = useState(false);
  const payload = parseRichCustomMessagePayload(message.customElem?.data);

  if (!payload) {
    return (
      <div className={`${styles.bubble} max-w-[280px]`}>
        {message.customElem?.description || "[Custom Message]"}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.bubble} flex min-w-[220px] max-w-[320px] items-center gap-3 text-left transition hover:border-[var(--primary)]`}
        onClick={() => setOpen(true)}
      >
        <div className="rounded-md bg-[var(--primary-active)] p-2 text-lg text-[var(--primary)]">
          <FileTextOutlined />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--text)]">
            {payload.title}
          </div>
          <div className="mt-1 text-xs text-[var(--sub-text)]">自定义消息</div>
        </div>
      </button>

      <Modal
        title={payload.title}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={720}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {payload.items.map((item) => {
            if (item.type === "text") {
              return (
                <div
                  key={item.id}
                  className="whitespace-pre-wrap rounded bg-[#f7f8fa] px-3 py-2 text-sm leading-6 text-[var(--text)]"
                >
                  {item.text}
                </div>
              );
            }

            const url = resolveMessageUrl(item.url);

            if (item.type === "image") {
              return (
                <div key={item.id} className="rounded border border-[#e5e7eb] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm text-[var(--sub-text)]">
                    <PictureOutlined />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <Image className="max-h-[360px] rounded" src={url} />
                </div>
              );
            }

            if (item.type === "video") {
              return (
                <div key={item.id} className="rounded border border-[#e5e7eb] p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm text-[var(--sub-text)]">
                    <VideoCameraOutlined />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <video
                    className="max-h-[380px] w-full rounded bg-black"
                    controls
                    preload="metadata"
                    src={url}
                  />
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded border border-[#e5e7eb] p-3"
              >
                <div className="rounded-md bg-[var(--primary-active)] p-2 text-lg text-[var(--primary)]">
                  <FileOutlined />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[var(--text)]">
                    {item.name}
                  </div>
                  <div className="mt-1 text-xs text-[var(--sub-text)]">
                    {bytesToSize(item.size)}
                  </div>
                </div>
                <a
                  className="text-[var(--primary)]"
                  download={item.name}
                  href={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <DownloadOutlined />
                </a>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
};

export default CustomMessageRender;
