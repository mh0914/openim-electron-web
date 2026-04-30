import { t } from "i18next";
import { FC } from "react";

import { IMessageItemProps } from ".";
import styles from "./message-item.module.scss";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildMentionHtml = (message: IMessageItemProps["message"]) => {
  const text = message.atTextElem?.text ?? message.textElem?.content ?? "";
  const atUsersInfo = message.atTextElem?.atUsersInfo ?? [];

  let content = escapeHtml(text);
  const mentionLabels = atUsersInfo
    .map((item) => ({
      label: `@${item.groupNickname}`,
      userId: item.atUserID,
    }))
    .filter((item, index, array) => array.findIndex((target) => target.label === item.label) === index)
    .sort((a, b) => b.label.length - a.label.length);

  mentionLabels.forEach((item) => {
    const label = escapeRegExp(escapeHtml(item.label));
    content = content.replace(
      new RegExp(label, "g"),
      `<span class="cursor-pointer font-medium text-[#1677ff]" onclick="userClick('${item.userId}','${message.groupID ?? ""}')">${escapeHtml(item.label)}</span>`,
    );
  });

  return content.replace(/\n/g, "<br>");
};

const TextMessageRender: FC<IMessageItemProps> = ({ message }) => {
  const content = buildMentionHtml(message);

  return (
    <div className="flex max-w-full flex-col">
      {message.atTextElem?.isAtSelf && (
        <div className="mb-1 w-fit rounded bg-[#fff2e8] px-2 py-0.5 text-[10px] text-[#fa541c]">
          @{t("me") === "I" ? "Me" : t("me")}
        </div>
      )}
      <div className={styles.bubble} dangerouslySetInnerHTML={{ __html: content }}></div>
    </div>
  );
};

export default TextMessageRender;
