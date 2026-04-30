import "./index.scss";
import "ckeditor5/ckeditor5.css";

import { ClassicEditor } from "@ckeditor/ckeditor5-editor-classic";
import { Essentials } from "@ckeditor/ckeditor5-essentials";
import { Mention } from "@ckeditor/ckeditor5-mention";
import { Paragraph } from "@ckeditor/ckeditor5-paragraph";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  forwardRef,
  ForwardRefRenderFunction,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type CKEditorRef = {
  focus: (moveToEnd?: boolean) => void;
  insertMention: (mention: MentionFeedItem) => void;
  insertText: (text: string) => void;
};

type MentionUIPlugin = {
  _isUIVisible?: boolean;
  _hideUIAndRemoveMarker?: () => void;
};

export interface MentionFeedItem {
  id: string;
  text: string;
  userId: string;
  displayName: string;
  isAll?: boolean;
}

export interface MentionSelection {
  id: string;
  text: string;
  userId: string;
  displayName: string;
  isAll?: boolean;
}

interface CKEditorProps {
  value: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  mentionItems?: MentionFeedItem[];
  onMentionChange?: (mentions: MentionSelection[]) => void;
  onEnter?: () => void;
}

export interface EmojiData {
  src: string;
  alt: string;
}

const keyCodes = {
  delete: 46,
  backspace: 8,
};

const collectMentionsFromHtml = (html: string): MentionSelection[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const mentionEls = Array.from(doc.querySelectorAll("span.mention[data-user-id]"));
  const mentions: MentionSelection[] = [];
  const seen = new Set<string>();

  mentionEls.forEach((mentionEl) => {
    const userId = mentionEl.getAttribute("data-user-id")?.trim();
    const displayName =
      mentionEl.getAttribute("data-display-name")?.trim() ||
      mentionEl.textContent?.replace(/^@/, "").trim() ||
      "";
    const id = mentionEl.getAttribute("data-mention")?.trim() || `@${displayName}`;
    const text = mentionEl.textContent?.trim() || `@${displayName}`;
    const isAll = mentionEl.getAttribute("data-is-all") === "true";

    if (!userId || seen.has(userId)) {
      return;
    }

    seen.add(userId);
    mentions.push({
      id,
      text,
      userId,
      displayName,
      isAll,
    });
  });

  return mentions;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const appendPlainTextToHtml = (html: string, text: string) => {
  const safeText = escapeHtml(text).replace(/\n/g, "<br>");
  const trimmed = html.trim();

  if (!trimmed) {
    return `<p>${safeText}</p>`;
  }

  if (/<\/p>\s*$/.test(trimmed)) {
    return trimmed.replace(/<\/p>\s*$/, `${safeText}</p>`);
  }

  return `${trimmed}${safeText}`;
};

const Index: ForwardRefRenderFunction<CKEditorRef, CKEditorProps> = (
  { value, placeholder, onChange, mentionItems = [], onMentionChange, onEnter },
  ref,
) => {
  const ckEditor = useRef<ClassicEditor | null>(null);
  const mentionItemsRef = useRef<MentionFeedItem[]>(mentionItems);

  useEffect(() => {
    mentionItemsRef.current = mentionItems;
  }, [mentionItems]);

  const focus = (moveToEnd = false) => {
    const editor = ckEditor.current;

    if (editor) {
      const model = editor.model;
      const view = editor.editing.view;
      const root = model.document.getRoot();
      if (moveToEnd && root) {
        const range = model.createRange(model.createPositionAt(root, "end"));

        model.change((writer) => {
          writer.setSelection(range);
        });
      }
      view.focus();
    }
  };

  const insertMention = (mention: MentionFeedItem) => {
    const editor = ckEditor.current;

    if (!editor) {
      return;
    }

    const mentionUI = editor.plugins.has("MentionUI")
      ? (editor.plugins.get("MentionUI") as MentionUIPlugin)
      : undefined;
    mentionUI?._hideUIAndRemoveMarker?.();

    const mentionPlugin = editor.plugins.get("Mention") as {
      toMentionAttribute: (item: Record<string, unknown>) => Record<string, unknown>;
    };

    const mentionAttribute = mentionPlugin.toMentionAttribute({
      id: mention.id,
      _text: mention.text,
      text: mention.text,
      userId: mention.userId,
      displayName: mention.displayName,
      isAll: mention.isAll,
      uid: `mention:${mention.userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    });

    editor.model.change((writer) => {
      const root = editor.model.document.getRoot();
      if (root) {
        writer.setSelection(writer.createPositionAt(root, "end"));
      }

      const textNode = writer.createText(mention.text, {
        mention: mentionAttribute,
      });

      editor.model.insertContent(textNode);
      editor.model.insertContent(writer.createText(" "));
      writer.setSelection(editor.model.document.selection.getLastPosition()!);
    });

    mentionUI?._hideUIAndRemoveMarker?.();
    focus(true);
  };

  const insertText = (text: string) => {
    const editor = ckEditor.current;

    if (!editor) {
      return;
    }

    const mentionUI = editor.plugins.has("MentionUI")
      ? (editor.plugins.get("MentionUI") as MentionUIPlugin)
      : undefined;
    mentionUI?._hideUIAndRemoveMarker?.();
    const nextHtml = appendPlainTextToHtml(editor.getData(), text);
    editor.setData(nextHtml);

    window.setTimeout(() => {
      mentionUI?._hideUIAndRemoveMarker?.();
      focus(true);
    }, 0);
  };

  const listenKeydown = (editor: ClassicEditor) => {
    editor.editing.view.document.on(
      "keydown",
      (evt, data) => {
        const mentionUI = editor.plugins.has("MentionUI")
          ? (editor.plugins.get("MentionUI") as MentionUIPlugin)
          : undefined;

        if (data.keyCode === 13 && !data.shiftKey) {
          if (mentionUI?._isUIVisible) {
            return;
          }
          data.preventDefault();
          evt.stop();
          onEnter?.();
          return;
        }
        if (data.keyCode === keyCodes.backspace || data.keyCode === keyCodes.delete) {
          const selection = editor.model.document.selection;
          const hasSelectContent = !editor.model.getSelectedContent(selection).isEmpty;
          const hasEditorContent = Boolean(editor.getData());

          if (!hasEditorContent) {
            return;
          }

          if (hasSelectContent) return;
        }
      },
      { priority: "high" },
    );
  };

  useImperativeHandle(
    ref,
    () => ({
      focus,
      insertMention,
      insertText,
    }),
    [],
  );

  return (
    <CKEditor
      editor={ClassicEditor}
      data={value}
      config={{
        placeholder,
        toolbar: [],
        image: {
          toolbar: [],
          insert: {
            type: "inline",
          },
        },
        mention: {
          feeds: [
            {
              marker: "@",
              minimumCharacters: 0,
              feed: (queryText: string) => {
                const keyword = queryText.trim().toLowerCase();
                const sourceItems = mentionItemsRef.current;

                if (!keyword) {
                  return sourceItems;
                }

                return sourceItems.filter((item) => {
                  const displayName = item.displayName.toLowerCase();
                  const userId = item.userId.toLowerCase();
                  return displayName.includes(keyword) || userId.includes(keyword);
                });
              },
            },
          ],
        },
        plugins: [Essentials, Paragraph, Mention],
      }}
      onReady={(editor) => {
        ckEditor.current = editor;
        const mentionPlugin = editor.plugins.get("Mention");

        editor.conversion.for("upcast").elementToAttribute({
          view: {
            name: "span",
            classes: "mention",
            key: "data-mention",
            attributes: {
              "data-user-id": true,
              "data-display-name": true,
              "data-is-all": true,
            },
          },
          model: {
            key: "mention",
            value: (viewElement) =>
              mentionPlugin.toMentionAttribute(viewElement, {
                userId: viewElement.getAttribute("data-user-id"),
                displayName: viewElement.getAttribute("data-display-name"),
                isAll: viewElement.getAttribute("data-is-all") === "true",
              }),
          },
          converterPriority: "high",
        });

        editor.conversion.for("downcast").attributeToElement({
          model: "mention",
          view: (value, { writer }) => {
            if (!value) {
              return;
            }

            return writer.createAttributeElement(
              "span",
              {
                class: "mention",
                "data-mention": value.id,
                "data-user-id": value.userId || "",
                "data-display-name": value.displayName || "",
                "data-is-all": value.isAll ? "true" : "false",
              },
              {
                priority: 20,
                id: value.uid,
              },
            );
          },
          converterPriority: "high",
        });
        listenKeydown(editor);
        focus(true);
      }}
      onChange={(event, editor) => {
        const data = editor.getData();
        onChange?.(data);
        onMentionChange?.(collectMentionsFromHtml(data));
      }}
    />
  );
};

export default memo(forwardRef(Index));
