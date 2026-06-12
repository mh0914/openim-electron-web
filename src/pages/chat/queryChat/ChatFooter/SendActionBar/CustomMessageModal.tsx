import {
  DeleteOutlined,
  FileOutlined,
  PictureOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Button, Input, message as antdMessage, Modal, Upload } from "antd";
import { UploadRequestOption } from "rc-upload/lib/interface";
import { useState } from "react";

import {
  buildRichCustomMessagePayload,
  RichCustomMessageItem,
} from "@/utils/customMessage";
import { bytesToSize } from "@/utils/common";
import { uploadFile } from "@/utils/imCommon";
import { IMSDK } from "@/layout/MainContentWrap";

import { SendMessageParams } from "../useSendMessage";
import { FileWithPath } from "./useFileMessage";

type AttachmentItem = Exclude<RichCustomMessageItem, { type: "text" }>;

const { TextArea } = Input;

const getAttachmentType = (file: File): AttachmentItem["type"] => {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return "file";
};

const getAttachmentIcon = (type: AttachmentItem["type"]) => {
  if (type === "image") {
    return <PictureOutlined />;
  }
  if (type === "video") {
    return <VideoCameraOutlined />;
  }
  return <FileOutlined />;
};

const CustomMessageModal = ({
  open,
  onCancel,
  sendMessage,
}: {
  open: boolean;
  onCancel: () => void;
  sendMessage: (params: SendMessageParams) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const reset = () => {
    setTitle("");
    setContent("");
    setAttachments([]);
    setUploading(false);
    setSending(false);
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleUpload = async (options: UploadRequestOption) => {
    const file = options.file as FileWithPath;
    setUploading(true);

    try {
      const filePath = await window.electronAPI?.saveFileToDisk({
        sync: true,
        file,
      });
      const {
        data: { url },
      } = await uploadFile(file, filePath);
      const type = getAttachmentType(file);

      setAttachments((prev) => [
        ...prev,
        {
          id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type,
          name: file.name,
          url,
          size: file.size,
          contentType: file.type,
        },
      ]);
      options.onSuccess?.({}, file);
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : "附件上传失败");
      options.onError?.(error as Error);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();

    if (!normalizedTitle) {
      antdMessage.warning("请输入标题");
      return;
    }

    if (!normalizedContent && attachments.length === 0) {
      antdMessage.warning("请输入内容或添加附件");
      return;
    }

    setSending(true);
    try {
      const payload = buildRichCustomMessagePayload(
        normalizedTitle,
        normalizedContent,
        attachments,
      );
      const { data: message } = await IMSDK.createCustomMessage({
        data: JSON.stringify(payload),
        description: normalizedTitle,
        extension: payload.hubMessageType,
      });

      await sendMessage({ message });
      reset();
      onCancel();
    } catch (error) {
      antdMessage.error(error instanceof Error ? error.message : "自定义消息发送失败");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      destroyOnClose
      title="自定义消息"
      open={open}
      onCancel={handleCancel}
      width={620}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="send"
          type="primary"
          loading={sending}
          disabled={uploading}
          onClick={handleSend}
        >
          发送
        </Button>,
      ]}
    >
      <div className="space-y-4">
        <Input
          maxLength={40}
          showCount
          placeholder="请输入标题"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <TextArea
          autoSize={{ minRows: 5, maxRows: 10 }}
          maxLength={3000}
          showCount
          placeholder="请输入内容"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        <div>
          <Upload
            customRequest={handleUpload}
            multiple
            showUploadList={false}
            disabled={uploading}
          >
            <Button icon={<UploadOutlined />} loading={uploading}>
              添加图片/视频/文件
            </Button>
          </Upload>
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded border border-[#e5e7eb] px-3 py-2"
                >
                  <div className="text-[var(--primary)]">{getAttachmentIcon(item.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-[var(--text)]">{item.name}</div>
                    <div className="text-xs text-[var(--sub-text)]">
                      {item.type.toUpperCase()} · {bytesToSize(item.size)}
                    </div>
                  </div>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((attachment) => attachment.id !== item.id),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default CustomMessageModal;
