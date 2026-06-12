import { Avatar as AntdAvatar, AvatarProps } from "antd";
import clsx from "clsx";
import * as React from "react";
import { useMemo } from "react";

import default_group from "@/assets/images/contact/group.png";
import { avatarList, getDefaultAvatar } from "@/utils/avatar";

const default_avatars = avatarList.map((item) => item.name);

interface IOIMAvatarProps extends AvatarProps {
  text?: string;
  color?: string;
  bgColor?: string;
  isgroup?: boolean;
  isnotification?: boolean;
  disabled?: boolean;
  size?: number;
}

const escapeSvgText = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildAvatarText = (rawText?: string) => {
  const text = rawText?.trim() || "";
  if (!text) {
    return "";
  }

  const segments = text
    .split(/[\s\-_/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const candidate = segments.at(-1) || text;
  const compact = candidate.replace(/\s+/g, "");

  if (!compact) {
    return "";
  }

  if (/^[a-z0-9]+$/i.test(compact)) {
    return compact.slice(0, 2).toUpperCase();
  }

  return Array.from(compact).slice(0, 2).join("");
};

const createTextAvatarDataUrl = ({
  text,
  size,
  bgColor,
  color,
}: {
  text: string;
  size: number;
  bgColor: string;
  color: string;
}) => {
  const safeText = escapeSvgText(text || "?");
  const fontSize = /^[a-z0-9]+$/i.test(text)
    ? Math.floor(size * 0.38)
    : Math.floor(size * 0.42);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="8" ry="8" fill="${bgColor}" />
      <text
        x="50%"
        y="50%"
        text-anchor="middle"
        dominant-baseline="central"
        font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="${color}"
      >${safeText}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const OIMAvatar: React.FC<IOIMAvatarProps> = (props) => {
  const {
    src,
    text,
    size = 42,
    color = "#fff",
    bgColor = "#0289FA",
    isgroup = false,
    isnotification,
    disabled = false,
    style,
    className,
    ...restProps
  } = props;
  const [errorHolder, setErrorHolder] = React.useState<string>();
  const [loadFailed, setLoadFailed] = React.useState(false);

  const getAvatarUrl = useMemo(() => {
    if (loadFailed && !isgroup) {
      return undefined;
    }

    if (src) {
      if (default_avatars.includes(src as string))
        return getDefaultAvatar(src as string);

      return src;
    }
    return isgroup ? default_group : undefined;
  }, [loadFailed, src, isgroup, isnotification]);

  const mergedStyle = {
    "--hub-avatar-bg": bgColor,
    "--hub-avatar-color": color,
    backgroundColor: bgColor,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    lineHeight: `${size - 2}px`,
    color,
    filter: disabled ? "grayscale(1)" : undefined,
    opacity: disabled ? 0.55 : undefined,
    ...(style ?? {}),
  };

  React.useEffect(() => {
    setLoadFailed(false);
    if (!isgroup) {
      setErrorHolder(undefined);
    }
  }, [isgroup, src]);

  const errorHandler = () => {
    if (isgroup) {
      setErrorHolder(default_group);
      return;
    }

    setLoadFailed(true);
  };

  const avatarClassName = clsx(
    {
      "cursor-pointer": Boolean(props.onClick),
    },
    className,
  );
  const avatarText = buildAvatarText(text);

  if (!(errorHolder ?? getAvatarUrl)) {
    return (
      <AntdAvatar
        {...restProps}
        shape="square"
        style={{
          ...mergedStyle,
          backgroundColor: "transparent",
        }}
        className={avatarClassName}
        src={createTextAvatarDataUrl({
          text: avatarText,
          size,
          bgColor,
          color,
        })}
      />
    );
  }

  return (
    <AntdAvatar
      {...restProps}
      shape="square"
      style={mergedStyle}
      className={avatarClassName}
      src={errorHolder ?? getAvatarUrl}
      onError={errorHandler as any}
    >
      {avatarText}
    </AntdAvatar>
  );
};

export default OIMAvatar;
