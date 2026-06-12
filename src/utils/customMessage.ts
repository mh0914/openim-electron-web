export const RICH_CUSTOM_MESSAGE_TYPE = "hubmessage_rich_custom_message";

export type RichCustomMessageItem =
  | {
      id: string;
      type: "text";
      text: string;
    }
  | {
      id: string;
      type: "image";
      name: string;
      url: string;
      size: number;
      contentType: string;
    }
  | {
      id: string;
      type: "video";
      name: string;
      url: string;
      size: number;
      contentType: string;
    }
  | {
      id: string;
      type: "file";
      name: string;
      url: string;
      size: number;
      contentType: string;
    };

export type RichCustomMessagePayload = {
  hubMessageType: typeof RICH_CUSTOM_MESSAGE_TYPE;
  version: 1;
  title: string;
  items: RichCustomMessageItem[];
};

export const buildRichCustomMessagePayload = (
  title: string,
  text: string,
  attachments: Exclude<RichCustomMessageItem, { type: "text" }>[],
): RichCustomMessagePayload => {
  const items: RichCustomMessageItem[] = [];
  const normalizedText = text.trim();

  if (normalizedText) {
    items.push({
      id: `text-${Date.now()}`,
      type: "text",
      text: normalizedText,
    });
  }

  items.push(...attachments);

  return {
    hubMessageType: RICH_CUSTOM_MESSAGE_TYPE,
    version: 1,
    title: title.trim(),
    items,
  };
};

export const parseRichCustomMessagePayload = (
  raw?: string,
): RichCustomMessagePayload | undefined => {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RichCustomMessagePayload>;
    if (
      parsed.hubMessageType !== RICH_CUSTOM_MESSAGE_TYPE ||
      parsed.version !== 1 ||
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.items)
    ) {
      return undefined;
    }

    return parsed as RichCustomMessagePayload;
  } catch {
    return undefined;
  }
};
